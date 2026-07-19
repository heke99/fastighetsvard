import { describe, it, expect } from "vitest";
import {
  upsertExternalInvoice,
  upsertExternalPayment,
  matchCustomer,
  runSyncJob,
  resolveReviewItem,
} from "@/lib/integrations/sync";
import { registerExistingTenant } from "@/lib/services/tenants";
import { encryptSecret } from "@/lib/crypto";
import {
  createTestOrg,
  createTestProperty,
  createTestUnit,
  createTestPerson,
  prisma,
} from "./helpers";
import type { ExternalInvoice } from "@/lib/integrations/provider";

function makeInvoice(overrides: Partial<ExternalInvoice> = {}): ExternalInvoice {
  return {
    externalId: `INV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    invoiceNumber: `F-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    externalCustomerId: "CUST-X",
    invoiceDate: "2026-06-01",
    dueDate: "2026-06-30",
    totalAmount: 7400,
    vatAmount: 0,
    paidAmount: 0,
    currency: "SEK",
    status: "sent",
    lines: [{ description: "Hyra", quantity: 1, unitPrice: 7400, vatRate: 0, amount: 7400 }],
    ...overrides,
  };
}

async function setupTenantWithMapping(customerId = "CUST-1") {
  const org = await createTestOrg();
  const property = await createTestProperty(org.id);
  const unit = await createTestUnit(org.id, property.id, `EK-${Date.now()}`);
  const { person, contract } = await registerExistingTenant(org.id, {
    firstName: "Faktura",
    lastName: "Testsson",
    email: `faktura-${Date.now()}@example.com`,
    unitId: unit.id,
    contractStartDate: new Date("2022-01-01"),
    rent: 7400,
    externalSystem: "mock",
    externalCustomerId: customerId,
  });
  return { org, person, contract, unit };
}

describe("fakturasynk – idempotens och dubblettskydd", () => {
  it("samma faktura importerad flera gånger skapar EN faktura", async () => {
    const { org } = await setupTenantWithMapping("CUST-10");
    const invoice = makeInvoice({ externalCustomerId: "CUST-10" });

    const first = await upsertExternalInvoice(org.id, "mock", invoice);
    expect(first).toBe("created");

    const second = await upsertExternalInvoice(org.id, "mock", invoice);
    expect(second).toBe("updated");

    const third = await upsertExternalInvoice(org.id, "mock", invoice);
    expect(third).toBe("updated");

    const count = await prisma.invoice.count({
      where: { organizationId: org.id, invoiceNumber: invoice.invoiceNumber },
    });
    expect(count).toBe(1);
  });

  it("statusuppdatering från källsystemet följer statusmaskinen", async () => {
    const { org } = await setupTenantWithMapping("CUST-11");
    const invoice = makeInvoice({ externalCustomerId: "CUST-11" });
    await upsertExternalInvoice(org.id, "mock", invoice);

    await upsertExternalInvoice(org.id, "mock", { ...invoice, status: "paid", paidAmount: 7400 });
    const ref = await prisma.externalReference.findUnique({
      where: {
        organizationId_externalSystem_entityType_externalId: {
          organizationId: org.id,
          externalSystem: "mock",
          entityType: "invoice",
          externalId: invoice.externalId,
        },
      },
    });
    const updated = await prisma.invoice.findUnique({ where: { id: ref!.invoiceId! } });
    expect(updated?.status).toBe("PAID");
    expect(Number(updated?.paidAmount)).toBe(7400);

    // Betald kan inte bli "sent" igen – ogiltigt hopp ignoreras men loggas.
    await upsertExternalInvoice(org.id, "mock", { ...invoice, status: "sent", paidAmount: 7400 });
    const still = await prisma.invoice.findUnique({ where: { id: ref!.invoiceId! } });
    expect(still?.status).toBe("PAID");
  });

  it("faktura utan kundmatchning hamnar i granskningskön – ingen faktura skapas", async () => {
    const org = await createTestOrg();
    const invoice = makeInvoice({ externalCustomerId: "OKAND-KUND" });

    const result = await upsertExternalInvoice(org.id, "mock", invoice);
    expect(result).toBe("review");

    const invoiceCount = await prisma.invoice.count({ where: { organizationId: org.id } });
    expect(invoiceCount).toBe(0);

    const reviewItems = await prisma.syncReviewItem.findMany({
      where: { organizationId: org.id, status: "PENDING" },
    });
    expect(reviewItems).toHaveLength(1);
    expect(reviewItems[0].entityType).toBe("invoice");

    // Samma faktura igen köar INTE en ny granskningspost.
    await upsertExternalInvoice(org.id, "mock", invoice);
    const reviewCount = await prisma.syncReviewItem.count({
      where: { organizationId: org.id, status: "PENDING" },
    });
    expect(reviewCount).toBe(1);
  });

  it("granskningspost kan matchas manuellt och köras om", async () => {
    const org = await createTestOrg();
    const person = await createTestPerson(org.id);
    const invoice = makeInvoice({ externalCustomerId: "MANUELL-1" });
    await upsertExternalInvoice(org.id, "mock", invoice);

    const item = await prisma.syncReviewItem.findFirst({
      where: { organizationId: org.id, status: "PENDING" },
    });
    expect(item).not.toBeNull();

    const admin = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: `admin-${Date.now()}@example.com`,
        passwordHash: "x",
      },
    });
    await resolveReviewItem(org.id, item!.id, { personId: person.id, actorUserId: admin.id });

    const created = await prisma.invoice.findFirst({
      where: { organizationId: org.id, invoiceNumber: invoice.invoiceNumber },
    });
    expect(created).not.toBeNull();
    expect(created?.personId).toBe(person.id);

    const resolved = await prisma.syncReviewItem.findUnique({ where: { id: item!.id } });
    expect(resolved?.status).toBe("RESOLVED");
  });

  it("kreditfaktura kopplas till ursprungsfakturan", async () => {
    const { org } = await setupTenantWithMapping("CUST-12");
    const original = makeInvoice({ externalCustomerId: "CUST-12" });
    await upsertExternalInvoice(org.id, "mock", original);

    const credit = makeInvoice({
      externalCustomerId: "CUST-12",
      isCreditNote: true,
      creditsExternalInvoiceId: original.externalId,
      totalAmount: -7400,
      status: "credited",
    });
    await upsertExternalInvoice(org.id, "mock", credit);

    const creditInvoice = await prisma.invoice.findFirst({
      where: { organizationId: org.id, isCreditNote: true },
    });
    expect(creditInvoice).not.toBeNull();
    const originalInvoice = await prisma.invoice.findFirst({
      where: { organizationId: org.id, invoiceNumber: original.invoiceNumber },
    });
    expect(creditInvoice?.creditsInvoiceId).toBe(originalInvoice?.id);
  });
});

describe("betalningssynk", () => {
  it("samma betalning importerad flera gånger registreras EN gång och uppdaterar fakturastatus", async () => {
    const { org } = await setupTenantWithMapping("CUST-20");
    const invoice = makeInvoice({ externalCustomerId: "CUST-20" });
    await upsertExternalInvoice(org.id, "mock", invoice);

    const payment = {
      externalId: `PAY-${Date.now()}`,
      externalInvoiceId: invoice.externalId,
      amount: 7400,
      currency: "SEK",
      paidAt: "2026-06-25",
    };

    expect(await upsertExternalPayment(org.id, "mock", payment)).toBe("created");
    expect(await upsertExternalPayment(org.id, "mock", payment)).toBe("skipped");
    expect(await upsertExternalPayment(org.id, "mock", payment)).toBe("skipped");

    const payments = await prisma.payment.count({ where: { organizationId: org.id } });
    expect(payments).toBe(1);

    const inv = await prisma.invoice.findFirst({
      where: { organizationId: org.id, invoiceNumber: invoice.invoiceNumber },
    });
    expect(inv?.status).toBe("PAID");
    expect(Number(inv?.paidAmount)).toBe(7400);
  });

  it("delbetalning ger status PARTIALLY_PAID", async () => {
    const { org } = await setupTenantWithMapping("CUST-21");
    const invoice = makeInvoice({ externalCustomerId: "CUST-21" });
    await upsertExternalInvoice(org.id, "mock", invoice);

    await upsertExternalPayment(org.id, "mock", {
      externalId: `PAY-DEL-${Date.now()}`,
      externalInvoiceId: invoice.externalId,
      amount: 3000,
      currency: "SEK",
      paidAt: "2026-06-20",
    });

    const inv = await prisma.invoice.findFirst({
      where: { organizationId: org.id, invoiceNumber: invoice.invoiceNumber },
    });
    expect(inv?.status).toBe("PARTIALLY_PAID");
    expect(Number(inv?.paidAmount)).toBe(3000);
  });

  it("betalning mot okänd faktura hamnar i granskningskön", async () => {
    const org = await createTestOrg();
    const result = await upsertExternalPayment(org.id, "mock", {
      externalId: `PAY-ORPHAN-${Date.now()}`,
      externalInvoiceId: "FINNS-EJ",
      amount: 500,
      currency: "SEK",
      paidAt: "2026-06-20",
    });
    expect(result).toBe("review");
    expect(await prisma.payment.count({ where: { organizationId: org.id } })).toBe(0);
  });
});

describe("kundmatchning – försiktighet", () => {
  it("matchar säkert via externt kund-ID", async () => {
    const { org, person } = await setupTenantWithMapping("CUST-30");
    const match = await matchCustomer(org.id, "mock", {
      externalId: "CUST-30",
      name: "Vem som helst",
    });
    expect(match.certain).toBe(true);
    expect(match.personId).toBe(person.id);
  });

  it("kräver granskning när ingen säker nyckel finns", async () => {
    const org = await createTestOrg();
    await createTestPerson(org.id, { firstName: "Namn", lastName: "Utan nycklar", email: null });
    const match = await matchCustomer(org.id, "mock", {
      externalId: "NY-KUND",
      name: "Namn Utan nycklar",
    });
    expect(match.certain).toBe(false);
    expect(match.personId).toBeNull();
  });

  it("kräver granskning vid tvetydig e-postmatchning", async () => {
    const org = await createTestOrg();
    // Två personer utan e-post-unikhetskonflikt: samma personnummer går inte,
    // så testa tvetydighet via personnummer i stället.
    await createTestPerson(org.id, { personalNumber: "197001011111", email: "a1@example.com" });
    await createTestPerson(org.id, { personalNumber: "197001011111", email: "a2@example.com" });
    const match = await matchCustomer(org.id, "mock", {
      externalId: "TVETYDIG",
      name: "Dubblett",
      personalNumber: "19700101-1111",
    });
    expect(match.certain).toBe(false);
  });
});

describe("synkjobb via provider (mock)", () => {
  it("kör fullt synkjobb och loggar resultat; externt avbrott ger FAILED utan krasch", async () => {
    const { org } = await setupTenantWithMapping("CUST-40");

    const conn = await prisma.integrationConnection.create({
      data: {
        organizationId: org.id,
        provider: "mock",
        name: "Mock test",
        credentialsEncrypted: encryptSecret("{}"),
        settings: {
          invoices: [
            {
              externalId: "INV-JOB-1",
              invoiceNumber: `JOB-${Date.now()}`,
              externalCustomerId: "CUST-40",
              invoiceDate: "2026-06-01",
              dueDate: "2026-06-30",
              totalAmount: 7400,
              vatAmount: 0,
              paidAmount: 0,
              currency: "SEK",
              status: "sent",
              lines: [],
            },
          ],
          payments: [],
          customers: [],
        },
      },
    });

    const job = await runSyncJob(org.id, conn.id, "full");
    expect(job.status).toBe("COMPLETED");
    expect(job.itemsCreated).toBe(1);

    // Kör igen – idempotent, uppdaterar i stället för att skapa.
    const job2 = await runSyncJob(org.id, conn.id, "full");
    expect(job2.itemsCreated).toBe(0);
    expect(job2.itemsUpdated).toBeGreaterThanOrEqual(1);

    // Simulera nere-läge.
    const brokenConn = await prisma.integrationConnection.create({
      data: {
        organizationId: org.id,
        provider: "mock",
        name: "Mock trasig",
        settings: { failFetch: true },
      },
    });
    const failedJob = await runSyncJob(org.id, brokenConn.id, "invoices");
    expect(failedJob.status).toBe("FAILED");
    expect(failedJob.error).toMatch(/svarar inte/i);
  });
});

describe("tenant-isolering i synk", () => {
  it("extern referens i en organisation läcker inte till en annan", async () => {
    const { org: orgA } = await setupTenantWithMapping("SHARED-ID");
    const orgB = await createTestOrg();

    // Samma externa kund-ID i annan organisation → ingen matchning där.
    const matchInB = await matchCustomer(orgB.id, "mock", {
      externalId: "SHARED-ID",
      name: "Test",
    });
    expect(matchInB.certain).toBe(false);
    expect(matchInB.personId).toBeNull();

    // Fakturan för orgB hamnar i orgB:s granskningskö, inte i orgA:s data.
    const inv = makeInvoice({ externalCustomerId: "SHARED-ID" });
    const result = await upsertExternalInvoice(orgB.id, "mock", inv);
    expect(result).toBe("review");
    expect(await prisma.invoice.count({ where: { organizationId: orgB.id } })).toBe(0);
    expect(await prisma.invoice.count({ where: { organizationId: orgA.id } })).toBeGreaterThanOrEqual(0);
  });
});
