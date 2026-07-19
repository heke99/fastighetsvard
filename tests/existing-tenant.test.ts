import { describe, it, expect } from "vitest";
import {
  registerExistingTenant,
  findExistingPerson,
  parseTenantCsv,
  previewTenantImport,
  runTenantImport,
} from "@/lib/services/tenants";
import {
  createTestOrg,
  createTestProperty,
  createTestUnit,
  createTestPerson,
  prisma,
} from "./helpers";

describe("befintlig hyresgäst – efterhandsregistrering", () => {
  it("skapar person, aktivt avtal och markerar objektet som uthyrt", async () => {
    const org = await createTestOrg();
    const property = await createTestProperty(org.id);
    const unit = await createTestUnit(org.id, property.id, "T-100");

    const result = await registerExistingTenant(org.id, {
      firstName: "Karin",
      lastName: "Karlsson",
      email: "karin@example.com",
      personalNumber: "19900101-1234",
      unitId: unit.id,
      contractStartDate: new Date("2021-06-01"),
      rent: 8000,
      externalSystem: "fortnox",
      externalCustomerId: "F-2001",
      externalContractId: "FA-3001",
    });

    expect(result.personCreated).toBe(true);
    expect(result.contract.status).toBe("ACTIVE");
    expect(result.contract.isImported).toBe(true);

    const updatedUnit = await prisma.unit.findUnique({ where: { id: unit.id } });
    expect(updatedUnit?.status).toBe("RENTED");

    // Roll TENANT satt
    const roles = await prisma.personRole.findMany({ where: { personId: result.person.id } });
    expect(roles.map((r) => r.role)).toContain("TENANT");

    // Externa referenser mappade
    const refs = await prisma.externalReference.findMany({
      where: { organizationId: org.id, externalSystem: "fortnox" },
    });
    expect(refs).toHaveLength(2);
    expect(refs.find((r) => r.entityType === "customer")?.personId).toBe(result.person.id);
    expect(refs.find((r) => r.entityType === "contract")?.contractId).toBe(result.contract.id);
  });

  it("matchar befintlig person via e-post – skapar INTE dubblett (samma person finns redan)", async () => {
    const org = await createTestOrg();
    const property = await createTestProperty(org.id);
    const unit1 = await createTestUnit(org.id, property.id, "T-201");
    const unit2 = await createTestUnit(org.id, property.id, "T-202");

    const first = await registerExistingTenant(org.id, {
      firstName: "Erik",
      lastName: "Eriksson",
      email: "erik@example.com",
      unitId: unit1.id,
      contractStartDate: new Date("2020-01-01"),
      rent: 6500,
    });

    const second = await registerExistingTenant(org.id, {
      firstName: "Erik",
      lastName: "Eriksson",
      email: "ERIK@example.com", // annan skiftläge – ska ändå matcha
      unitId: unit2.id,
      contractStartDate: new Date("2023-01-01"),
      rent: 900,
    });

    expect(second.personCreated).toBe(false);
    expect(second.person.id).toBe(first.person.id);

    const personCount = await prisma.person.count({
      where: { organizationId: org.id, email: "erik@example.com" },
    });
    expect(personCount).toBe(1);
  });

  it("matchar via personnummer", async () => {
    const org = await createTestOrg();
    await createTestPerson(org.id, {
      personalNumber: "198811223344",
      email: "gammal-epost@example.com",
    });
    const match = await findExistingPerson(org.id, {
      personalNumber: "19881122-3344",
    });
    expect(match).not.toBeNull();
    expect(match?.matchedBy).toBe("personalNumber");
  });

  it("blockerar dubbla aktiva avtal på samma objekt", async () => {
    const org = await createTestOrg();
    const property = await createTestProperty(org.id);
    const unit = await createTestUnit(org.id, property.id, "T-300");

    await registerExistingTenant(org.id, {
      firstName: "Anna",
      lastName: "A",
      email: "anna-t300@example.com",
      unitId: unit.id,
      contractStartDate: new Date("2022-01-01"),
      rent: 7000,
    });

    await expect(
      registerExistingTenant(org.id, {
        firstName: "Bertil",
        lastName: "B",
        email: "bertil-t300@example.com",
        unitId: unit.id,
        contractStartDate: new Date("2023-01-01"),
        rent: 7200,
      })
    ).rejects.toThrow(/aktivt avtal/i);
  });
});

describe("CSV-import av hyresgäster", () => {
  it("tolkar CSV med semikolon och validerar kolumner", () => {
    const { rows, errors } = parseTenantCsv(
      "firstName;lastName;unitNumber;contractStartDate;rent\nLisa;Larsson;T-400;2022-05-01;7500"
    );
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0].firstName).toBe("Lisa");
  });

  it("rapporterar saknade kolumner", () => {
    const { errors } = parseTenantCsv("firstName;lastName\nLisa;Larsson");
    expect(errors.length).toBeGreaterThan(0);
  });

  it("förhandsgranskning validerar utan att skriva", async () => {
    const org = await createTestOrg();
    const property = await createTestProperty(org.id);
    await createTestUnit(org.id, property.id, "T-500");

    const results = await previewTenantImport(org.id, [
      { firstName: "Maja", lastName: "M", unitNumber: "T-500", contractStartDate: "2022-01-01", rent: "7000" },
      { firstName: "Fel", lastName: "F", unitNumber: "FINNS-EJ", contractStartDate: "2022-01-01", rent: "7000" },
      { firstName: "", lastName: "Namnlös", unitNumber: "T-500", contractStartDate: "2022-01-01", rent: "7000" },
    ]);
    expect(results[0].status).toBe("created");
    expect(results[1].status).toBe("error");
    expect(results[2].status).toBe("error");

    // Inget har skrivits.
    const contracts = await prisma.contract.count({ where: { organizationId: org.id } });
    expect(contracts).toBe(0);
  });

  it("importen är omkörningssäker – samma import två gånger skapar inga dubbletter", async () => {
    const org = await createTestOrg();
    const property = await createTestProperty(org.id);
    await createTestUnit(org.id, property.id, "T-600");

    const rows = [
      {
        firstName: "Olle",
        lastName: "Olsson",
        email: "olle@example.com",
        unitNumber: "T-600",
        contractStartDate: "2021-09-01",
        rent: "6800",
      },
    ];

    const first = await runTenantImport(org.id, rows);
    expect(first.job.successRows).toBe(1);

    const second = await runTenantImport(org.id, rows);
    expect(second.job.successRows).toBe(0);
    expect(second.job.skippedRows).toBe(1);

    const contracts = await prisma.contract.count({ where: { organizationId: org.id } });
    const persons = await prisma.person.count({
      where: { organizationId: org.id, email: "olle@example.com" },
    });
    expect(contracts).toBe(1);
    expect(persons).toBe(1);
  });
});
