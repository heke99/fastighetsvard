import { describe, it, expect } from "vitest";
import { registerExistingTenant } from "@/lib/services/tenants";
import {
  submitApplication,
  changeApplicationStatus,
  sendOffer,
  respondToOffer,
} from "@/lib/services/applications";
import { signContract, requestTermination, calculateEarliestEndDate } from "@/lib/services/contracts";
import {
  createTestOrg,
  createTestProperty,
  createTestUnit,
  createPublishedListing,
  prisma,
} from "./helpers";

describe("befintlig hyresgäst söker ny lägenhet (intern flytt)", () => {
  it("hyresgäst med aktivt avtal blockeras INTE och flaggas som intern omflyttning", async () => {
    const org = await createTestOrg();
    const property = await createTestProperty(org.id);
    const currentUnit = await createTestUnit(org.id, property.id, "IF-100");
    const newUnit = await createTestUnit(org.id, property.id, "IF-101");

    const { person } = await registerExistingTenant(org.id, {
      firstName: "Hilda",
      lastName: "Hyresgäst",
      email: "hilda@example.com",
      unitId: currentUnit.id,
      contractStartDate: new Date("2020-01-01"),
      rent: 7000,
    });

    const listing = await createPublishedListing(org.id, newUnit.id, "if101");

    const application = await submitApplication(org.id, {
      listingId: listing.id,
      personId: person.id,
      employment: "anstalld",
      monthlyIncome: 32000,
    });

    expect(application.status).toBe("SUBMITTED");
    expect(application.isInternalTransfer).toBe(true); // automatisk flagga
  });

  it("dubblettskydd: samma person kan inte ha två aktiva ansökningar på samma annons", async () => {
    const org = await createTestOrg();
    const property = await createTestProperty(org.id);
    const unit = await createTestUnit(org.id, property.id, "IF-200");
    const person = await prisma.person.create({
      data: { organizationId: org.id, firstName: "Sara", lastName: "S", email: "sara-if@example.com" },
    });
    const listing = await createPublishedListing(org.id, unit.id, "if200");

    await submitApplication(org.id, { listingId: listing.id, personId: person.id });
    await expect(
      submitApplication(org.id, { listingId: listing.id, personId: person.id })
    ).rejects.toThrow(/redan en aktiv ansökan/i);
  });

  it("fullt flöde: erbjudande → accept → nytt avtal + gammalt uppsagt med samordnade datum, historik bevaras", async () => {
    const org = await createTestOrg();
    const property = await createTestProperty(org.id);
    const oldUnit = await createTestUnit(org.id, property.id, "IF-300");
    const newUnit = await createTestUnit(org.id, property.id, "IF-301");

    const { person, contract: oldContract } = await registerExistingTenant(org.id, {
      firstName: "Nils",
      lastName: "Nilsson",
      email: "nils@example.com",
      unitId: oldUnit.id,
      contractStartDate: new Date("2019-05-01"),
      rent: 6900,
    });

    const listing = await createPublishedListing(org.id, newUnit.id, "if301");
    const application = await submitApplication(org.id, {
      listingId: listing.id,
      personId: person.id,
      desiredMoveInDate: new Date(Date.now() + 120 * 24 * 3600 * 1000),
    });
    expect(application.isInternalTransfer).toBe(true);

    // Handläggning: mottagen → granskning → kvalificerad
    await changeApplicationStatus(org.id, application.id, "RECEIVED");
    await changeApplicationStatus(org.id, application.id, "UNDER_REVIEW");
    await changeApplicationStatus(org.id, application.id, "QUALIFIED");

    const offer = await sendOffer(org.id, application.id);
    expect(offer.isInternalTransfer).toBe(true);

    // Fel person kan inte svara på erbjudandet.
    const otherPerson = await prisma.person.create({
      data: { organizationId: org.id, firstName: "Annan", lastName: "Person", email: "annan-if@example.com" },
    });
    await expect(
      respondToOffer(org.id, offer.id, otherPerson.id, true)
    ).rejects.toThrow(/tillhör inte dig/i);

    // Rätt person accepterar.
    const result = await respondToOffer(org.id, offer.id, person.id, true);
    expect(result.contractId).toBeTruthy();
    expect(result.terminationId).toBeTruthy();

    // Nytt avtal skickat för signering, kopplat till gamla avtalet.
    const newContract = await prisma.contract.findUnique({
      where: { id: result.contractId! },
      include: { parties: true },
    });
    expect(newContract?.status).toBe("SENT_FOR_SIGNING");
    expect(newContract?.replacesContractId).toBe(oldContract.id);
    expect(newContract?.parties.some((p) => p.personId === person.id)).toBe(true);

    // Gamla avtalet uppsagt – men historiken (avtalet, parterna) finns kvar.
    const terminated = await prisma.contract.findUnique({
      where: { id: oldContract.id },
      include: { parties: true, statusHistory: true },
    });
    expect(terminated?.status).toBe("TERMINATED");
    expect(terminated?.parties.some((p) => p.personId === person.id)).toBe(true);
    expect(terminated?.statusHistory.length).toBeGreaterThan(1);

    // Uppsägningen är samordnad med nya avtalet.
    const termination = await prisma.termination.findUnique({
      where: { id: result.terminationId! },
    });
    expect(termination?.isInternalTransfer).toBe(true);
    expect(termination?.newContractId).toBe(result.contractId);

    // Gamla objektet blir kommande ledigt.
    const oldUnitAfter = await prisma.unit.findUnique({ where: { id: oldUnit.id } });
    expect(oldUnitAfter?.status).toBe("UPCOMING");

    // Hyresgästen signerar nya avtalet → SIGNED (enda icke-hyresvärdsparten).
    const signed = await signContract(org.id, result.contractId!, person.id);
    expect(signed.status).toBe("SIGNED");
  });
});

describe("uppsägning", () => {
  it("beräknar tidigaste slutdatum utifrån uppsägningstid (kalendermånader)", () => {
    const from = new Date(Date.UTC(2026, 0, 15)); // 15 jan 2026
    const earliest = calculateEarliestEndDate(3, from);
    // 3 månaders uppsägningstid från nästa månadsskifte → 30 april 2026
    expect(earliest.toISOString().slice(0, 10)).toBe("2026-04-30");
  });

  it("hyresgäst kan säga upp sitt avtal, objektet blir kommande ledigt", async () => {
    const org = await createTestOrg();
    const property = await createTestProperty(org.id);
    const unit = await createTestUnit(org.id, property.id, "UPP-100");
    const { person, contract } = await registerExistingTenant(org.id, {
      firstName: "Ulla",
      lastName: "U",
      email: "ulla@example.com",
      unitId: unit.id,
      contractStartDate: new Date("2020-01-01"),
      rent: 7000,
    });

    const termination = await requestTermination(
      org.id,
      contract.id,
      person.id,
      new Date(Date.now() + 200 * 24 * 3600 * 1000)
    );
    expect(termination.status).toBe("REQUESTED");

    const after = await prisma.contract.findUnique({ where: { id: contract.id } });
    expect(after?.status).toBe("TERMINATED");

    const unitAfter = await prisma.unit.findUnique({ where: { id: unit.id } });
    expect(unitAfter?.status).toBe("UPCOMING");
  });

  it("icke-part kan inte säga upp någon annans avtal", async () => {
    const org = await createTestOrg();
    const property = await createTestProperty(org.id);
    const unit = await createTestUnit(org.id, property.id, "UPP-200");
    const { contract } = await registerExistingTenant(org.id, {
      firstName: "Ville",
      lastName: "V",
      email: "ville@example.com",
      unitId: unit.id,
      contractStartDate: new Date("2020-01-01"),
      rent: 7000,
    });
    const outsider = await prisma.person.create({
      data: { organizationId: org.id, firstName: "Obehörig", lastName: "O", email: "obehorig@example.com" },
    });
    await expect(
      requestTermination(org.id, contract.id, outsider.id, new Date())
    ).rejects.toThrow(/inte part/i);
  });
});
