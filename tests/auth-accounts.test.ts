import { describe, it, expect, beforeAll } from "vitest";
import { registerAccount, activateInvitation } from "@/lib/services/accounts";
import { registerExistingTenant, createInvitation } from "@/lib/services/tenants";
import { login, AuthError, hashPassword, verifyPassword } from "@/lib/auth";
import {
  createTestOrg,
  createTestProperty,
  createTestUnit,
  prisma,
} from "./helpers";

describe("kontoregistrering", () => {
  beforeAll(async () => {
    // registerAccount använder default-organisationen (äldsta) – se till att en finns.
    const count = await prisma.organization.count();
    if (count === 0) await createTestOrg("Default org");
  });

  it("skapar konto med person och APPLICANT-roll", async () => {
    const email = `konto-${Date.now()}@example.com`;
    const { user } = await registerAccount({
      firstName: "Ny",
      lastName: "Användare",
      email,
      password: "superhemligt123",
    });
    expect(user.email).toBe(email);

    const person = await prisma.person.findFirst({ where: { email }, include: { roles: true } });
    expect(person).not.toBeNull();
    expect(person?.roles.map((r) => r.role)).toContain("APPLICANT");
  });

  it("återanvänder befintlig person med samma e-post (ingen dubblett)", async () => {
    const org = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
    const email = `befintlig-${Date.now()}@example.com`;
    const existing = await prisma.person.create({
      data: { organizationId: org!.id, firstName: "Redan", lastName: "Registrerad", email },
    });

    await registerAccount({
      firstName: "Redan",
      lastName: "Registrerad",
      email,
      password: "superhemligt123",
    });

    const count = await prisma.person.count({ where: { email } });
    expect(count).toBe(1);
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user?.personId).toBe(existing.id);
  });

  it("blockerar dubbla konton på samma e-post", async () => {
    const email = `dubbelkonto-${Date.now()}@example.com`;
    await registerAccount({ firstName: "A", lastName: "B", email, password: "superhemligt123" });
    await expect(
      registerAccount({ firstName: "A", lastName: "B", email, password: "superhemligt123" })
    ).rejects.toThrow(/redan ett konto/i);
  });
});

describe("inloggning och brute force-skydd", () => {
  it("felaktigt lösenord ger fel och låser efter 5 försök", async () => {
    const email = `laskonto-${Date.now()}@example.com`;
    await registerAccount({ firstName: "Lås", lastName: "Test", email, password: "ratt-losenord-123" });

    for (let i = 0; i < 5; i++) {
      await expect(login(email, "fel-losenord")).rejects.toThrow(AuthError);
    }
    // Sjätte försöket – även med RÄTT lösenord – blockeras av låsningen.
    await expect(login(email, "ratt-losenord-123")).rejects.toThrow(/låst/i);
  });

  it("lyckad inloggning ger sessionstoken och nollställer räknaren", async () => {
    const email = `okkonto-${Date.now()}@example.com`;
    await registerAccount({ firstName: "Ok", lastName: "Test", email, password: "ratt-losenord-123" });
    await expect(login(email, "fel")).rejects.toThrow();
    const { token, user } = await login(email, "ratt-losenord-123");
    expect(token).toBeTruthy();
    const fresh = await prisma.user.findUnique({ where: { id: user.id } });
    expect(fresh?.failedLoginAttempts).toBe(0);
  });

  it("lösenord hashas och verifieras korrekt", async () => {
    const hash = await hashPassword("test-losenord-abc");
    expect(hash).not.toContain("test-losenord");
    expect(await verifyPassword("test-losenord-abc", hash)).toBe(true);
    expect(await verifyPassword("fel", hash)).toBe(false);
  });
});

describe("inbjudan till Mina sidor för befintlig hyresgäst", () => {
  it("fullt flöde: registrera hyresgäst → bjud in → aktivera konto", async () => {
    const org = await createTestOrg();
    const property = await createTestProperty(org.id);
    const unit = await createTestUnit(org.id, property.id, "INB-100");
    const email = `inbjudan-${Date.now()}@example.com`;

    const { person, contract } = await registerExistingTenant(org.id, {
      firstName: "Inga",
      lastName: "Inbjudan",
      email,
      unitId: unit.id,
      contractStartDate: new Date("2021-01-01"),
      rent: 7100,
    });

    const { activationUrl } = await createInvitation(org.id, person.id);
    const token = activationUrl.split("/aktivera/")[1];
    expect(token).toBeTruthy();

    const { user } = await activateInvitation(token, "hemligt-losen-123");
    expect(user.personId).toBe(person.id);
    expect(user.organizationId).toBe(org.id);

    // Kontot är kopplat till hyresförhållandet: avtalet syns via personen.
    const contracts = await prisma.contract.findMany({
      where: { parties: { some: { personId: person.id } } },
    });
    expect(contracts.map((c) => c.id)).toContain(contract.id);

    // Token kan inte användas två gånger.
    await expect(activateInvitation(token, "annat-losen-123")).rejects.toThrow(/ogiltig/i);
  });

  it("kan inte bjuda in person som redan har konto", async () => {
    const org = await createTestOrg();
    const property = await createTestProperty(org.id);
    const unit = await createTestUnit(org.id, property.id, "INB-200");
    const email = `harkonto-${Date.now()}@example.com`;
    const { person } = await registerExistingTenant(org.id, {
      firstName: "Har",
      lastName: "Konto",
      email,
      unitId: unit.id,
      contractStartDate: new Date("2021-01-01"),
      rent: 7100,
    });
    await prisma.user.create({
      data: {
        organizationId: org.id,
        personId: person.id,
        email,
        passwordHash: await hashPassword("nagot-losen-123"),
      },
    });
    await expect(createInvitation(org.id, person.id)).rejects.toThrow(/redan ett konto/i);
  });
});

describe("tenant-isolering", () => {
  it("fakturor filtrerade på person läcker aldrig mellan personer", async () => {
    const org = await createTestOrg();
    const property = await createTestProperty(org.id);
    const unitA = await createTestUnit(org.id, property.id, "ISO-1");
    const unitB = await createTestUnit(org.id, property.id, "ISO-2");
    const a = await registerExistingTenant(org.id, {
      firstName: "Person",
      lastName: "A",
      email: `iso-a-${Date.now()}@example.com`,
      unitId: unitA.id,
      contractStartDate: new Date("2021-01-01"),
      rent: 7000,
    });
    const b = await registerExistingTenant(org.id, {
      firstName: "Person",
      lastName: "B",
      email: `iso-b-${Date.now()}@example.com`,
      unitId: unitB.id,
      contractStartDate: new Date("2021-01-01"),
      rent: 7000,
    });

    await prisma.invoice.create({
      data: {
        organizationId: org.id,
        personId: a.person.id,
        invoiceNumber: `ISO-INV-${Date.now()}`,
        status: "SENT",
        invoiceDate: new Date(),
        dueDate: new Date(),
        totalAmount: 7000,
      },
    });

    // Samma mönster som Mina sidor: findFirst med personId-filter.
    const asB = await prisma.invoice.findFirst({
      where: { organizationId: org.id, personId: b.person.id },
    });
    expect(asB).toBeNull();

    const asA = await prisma.invoice.findFirst({
      where: { organizationId: org.id, personId: a.person.id },
    });
    expect(asA).not.toBeNull();
  });
});
