import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { decryptSecret } from "@/lib/crypto";
import {
  createProvider,
  type AccountingProvider,
  type ExternalCustomer,
  type ExternalInvoice,
  type ExternalPayment,
} from "./provider";
import "./mock-provider";
import type { InvoiceStatus, Prisma } from "@prisma/client";
import { canTransition, invoiceTransitions } from "@/lib/state-machines";

/**
 * Synkronisering mot bokföringssystem.
 *
 * Principer:
 * - Bokföringssystemet kan vara master för kunder/fakturor/betalningar
 *   (MasterDataConfig). Då skapar plattformen aldrig egna fakturor.
 * - Idempotent: samma externa post (system, typ, externt id) skapar aldrig
 *   dubbletter – ExternalReference har unikt index.
 * - Försiktig matchning: säkra nycklar (externt kund-ID, personnummer,
 *   avtalsnummer) matchas automatiskt. Osäkra (endast namn) hamnar i
 *   granskningskön SyncReviewItem.
 */

const externalToInternalInvoiceStatus: Record<ExternalInvoice["status"], InvoiceStatus> = {
  draft: "DRAFT",
  sent: "SENT",
  partially_paid: "PARTIALLY_PAID",
  paid: "PAID",
  overdue: "OVERDUE",
  reminded: "REMINDED",
  collection: "COLLECTION",
  credited: "CREDITED",
  cancelled: "CANCELLED",
};

export async function getProviderForConnection(connectionId: string): Promise<{
  provider: AccountingProvider;
  connection: { id: string; organizationId: string; provider: string };
}> {
  const connection = await prisma.integrationConnection.findUnique({
    where: { id: connectionId },
  });
  if (!connection || !connection.isActive) {
    throw new Error("Integrationen finns inte eller är inaktiv.");
  }
  const credentials = connection.credentialsEncrypted
    ? (JSON.parse(decryptSecret(connection.credentialsEncrypted)) as Record<string, string>)
    : {};
  const provider = createProvider(
    connection.provider,
    credentials,
    (connection.settings as Record<string, unknown>) ?? undefined
  );
  return { provider, connection };
}

interface SyncCounters {
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}

/**
 * Matcha extern kund mot intern person.
 * Ordning (säkrast först): externt ID → personnummer/orgnummer → e-post.
 * Osäker matchning (flera kandidater eller ingen träff) → granskningskö.
 */
export async function matchCustomer(
  organizationId: string,
  externalSystem: string,
  customer: ExternalCustomer
): Promise<{ personId: string | null; certain: boolean; reason?: string }> {
  const existingRef = await prisma.externalReference.findUnique({
    where: {
      organizationId_externalSystem_entityType_externalId: {
        organizationId,
        externalSystem,
        entityType: "customer",
        externalId: customer.externalId,
      },
    },
  });
  if (existingRef?.personId) return { personId: existingRef.personId, certain: true };

  if (customer.personalNumber) {
    const normalized = customer.personalNumber.replace(/[^0-9]/g, "");
    const matches = await prisma.person.findMany({
      where: { organizationId, personalNumber: normalized },
      take: 2,
    });
    if (matches.length === 1) return { personId: matches[0].id, certain: true };
    if (matches.length > 1) {
      return { personId: null, certain: false, reason: "Flera personer med samma personnummer." };
    }
  }
  if (customer.orgNumber) {
    const matches = await prisma.person.findMany({
      where: { organizationId, orgNumber: customer.orgNumber },
      take: 2,
    });
    if (matches.length === 1) return { personId: matches[0].id, certain: true };
  }
  if (customer.email) {
    const matches = await prisma.person.findMany({
      where: { organizationId, email: customer.email.toLowerCase().trim() },
      take: 2,
    });
    if (matches.length === 1) return { personId: matches[0].id, certain: true };
    if (matches.length > 1) {
      return { personId: null, certain: false, reason: "Flera personer med samma e-post." };
    }
  }
  return {
    personId: null,
    certain: false,
    reason: "Ingen säker matchning (saknar externt ID, personnummer och e-postträff).",
  };
}

async function queueForReview(
  organizationId: string,
  syncJobId: string | null,
  entityType: string,
  externalSystem: string,
  externalId: string,
  payload: unknown,
  reason: string
) {
  // Unik per (org, system, typ, externt id, status=PENDING) – ingen dubbelkö.
  const existing = await prisma.syncReviewItem.findFirst({
    where: { organizationId, externalSystem, entityType, externalId, status: "PENDING" },
  });
  if (existing) return existing;
  return prisma.syncReviewItem.create({
    data: {
      organizationId,
      syncJobId,
      entityType,
      externalSystem,
      externalId,
      payload: payload as Prisma.InputJsonValue,
      reason,
    },
  });
}

/** Synka kunder från externt system. Idempotent. */
export async function syncCustomers(
  organizationId: string,
  connectionId: string,
  opts: { syncJobId?: string } = {}
): Promise<SyncCounters> {
  const { provider, connection } = await getProviderForConnection(connectionId);
  const counters: SyncCounters = { processed: 0, created: 0, updated: 0, skipped: 0, failed: 0 };
  const customers = await provider.fetchCustomers();

  for (const customer of customers) {
    counters.processed++;
    try {
      const match = await matchCustomer(organizationId, connection.provider, customer);
      if (!match.certain) {
        await queueForReview(
          organizationId,
          opts.syncJobId ?? null,
          "customer",
          connection.provider,
          customer.externalId,
          customer,
          match.reason ?? "Osäker matchning."
        );
        counters.skipped++;
        continue;
      }
      let personId = match.personId;
      if (!personId) {
        counters.skipped++;
        continue;
      }
      await prisma.externalReference.upsert({
        where: {
          organizationId_externalSystem_entityType_externalId: {
            organizationId,
            externalSystem: connection.provider,
            entityType: "customer",
            externalId: customer.externalId,
          },
        },
        create: {
          organizationId,
          externalSystem: connection.provider,
          entityType: "customer",
          externalId: customer.externalId,
          personId,
          syncStatus: "synced",
          lastSyncedAt: new Date(),
          sourceVersion: customer.sourceVersion ?? null,
          sourceUpdatedAt: customer.sourceUpdatedAt ? new Date(customer.sourceUpdatedAt) : null,
          metadata: { customerNumber: customer.customerNumber ?? null },
        },
        update: {
          personId,
          syncStatus: "synced",
          lastSyncedAt: new Date(),
          sourceVersion: customer.sourceVersion ?? null,
          sourceUpdatedAt: customer.sourceUpdatedAt ? new Date(customer.sourceUpdatedAt) : null,
        },
      });
      counters.updated++;
    } catch {
      counters.failed++;
    }
  }
  return counters;
}

/**
 * Synka fakturor. Bokföringssystemet är master: befintlig faktura uppdateras
 * (aldrig dubblett), ny faktura skapas kopplad till matchad person och om
 * möjligt till avtal/objekt via externt avtals-ID eller fakturareferens.
 */
export async function syncInvoices(
  organizationId: string,
  connectionId: string,
  opts: { syncJobId?: string } = {}
): Promise<SyncCounters> {
  const { provider, connection } = await getProviderForConnection(connectionId);
  const counters: SyncCounters = { processed: 0, created: 0, updated: 0, skipped: 0, failed: 0 };
  const invoices = await provider.fetchInvoices();

  for (const inv of invoices) {
    counters.processed++;
    try {
      const result = await upsertExternalInvoice(organizationId, connection.provider, inv, {
        syncJobId: opts.syncJobId,
      });
      if (result === "created") counters.created++;
      else if (result === "updated") counters.updated++;
      else counters.skipped++;
    } catch {
      counters.failed++;
    }
  }
  return counters;
}

/**
 * Idempotent upsert av extern faktura. Returnerar "created" | "updated" | "review".
 * Används både av batchsynk och inkommande webhooks – samma kodväg, samma skydd.
 */
export async function upsertExternalInvoice(
  organizationId: string,
  externalSystem: string,
  inv: ExternalInvoice,
  opts: { syncJobId?: string } = {}
): Promise<"created" | "updated" | "review"> {
  // Finns fakturan redan (via externt ID)?
  const existingRef = await prisma.externalReference.findUnique({
    where: {
      organizationId_externalSystem_entityType_externalId: {
        organizationId,
        externalSystem,
        entityType: inv.isCreditNote ? "credit_note" : "invoice",
        externalId: inv.externalId,
      },
    },
  });

  const newStatus = externalToInternalInvoiceStatus[inv.status];

  if (existingRef?.invoiceId) {
    // Uppdatera befintlig – aldrig dubblett.
    const current = await prisma.invoice.findUnique({ where: { id: existingRef.invoiceId } });
    if (!current) throw new Error("Referens pekar på borttagen faktura.");
    // Statusövergång enligt statusmaskin; källsystemets status vinner men
    // ologiska hopp loggas i stället för att tyst skrivas över.
    const statusOk = current.status === newStatus || canTransition(invoiceTransitions, current.status, newStatus);
    await prisma.invoice.update({
      where: { id: current.id },
      data: {
        status: statusOk ? newStatus : current.status,
        paidAmount: inv.paidAmount,
        dueDate: new Date(inv.dueDate),
        ocr: inv.ocr ?? current.ocr,
        reference: inv.reference ?? current.reference,
      },
    });
    if (current.status !== newStatus && statusOk) {
      await prisma.invoiceStatusEvent.create({
        data: {
          invoiceId: current.id,
          fromStatus: current.status,
          toStatus: newStatus,
          source: "sync",
        },
      });
    }
    if (!statusOk) {
      await audit({
        organizationId,
        actorType: "system",
        action: "invoice_status_conflict",
        entityType: "invoice",
        entityId: current.id,
        after: { internal: current.status, external: newStatus, externalSystem },
      });
    }
    await prisma.externalReference.update({
      where: { id: existingRef.id },
      data: {
        lastSyncedAt: new Date(),
        syncStatus: "synced",
        sourceVersion: inv.sourceVersion ?? null,
        sourceUpdatedAt: inv.sourceUpdatedAt ? new Date(inv.sourceUpdatedAt) : null,
      },
    });
    return "updated";
  }

  // Ny faktura: hitta person via extern kundreferens.
  const customerRef = await prisma.externalReference.findUnique({
    where: {
      organizationId_externalSystem_entityType_externalId: {
        organizationId,
        externalSystem,
        entityType: "customer",
        externalId: inv.externalCustomerId,
      },
    },
  });

  if (!customerRef?.personId) {
    await queueForReview(
      organizationId,
      opts.syncJobId ?? null,
      "invoice",
      externalSystem,
      inv.externalId,
      inv,
      `Fakturan saknar matchad kund (extern kund ${inv.externalCustomerId}).`
    );
    return "review";
  }

  // Koppla till avtal: via externt avtals-ID eller fakturareferens.
  let contractId: string | null = null;
  let unitId: string | null = null;
  if (inv.externalContractId) {
    const contractRef = await prisma.externalReference.findUnique({
      where: {
        organizationId_externalSystem_entityType_externalId: {
          organizationId,
          externalSystem,
          entityType: "contract",
          externalId: inv.externalContractId,
        },
      },
    });
    contractId = contractRef?.contractId ?? null;
  }
  if (!contractId && inv.reference) {
    const byNumber = await prisma.contract.findFirst({
      where: {
        organizationId,
        OR: [{ contractNumber: inv.reference }, { invoiceReference: inv.reference }],
      },
    });
    contractId = byNumber?.id ?? null;
  }
  if (!contractId) {
    // Fallback: personens enda aktiva avtal.
    const active = await prisma.contract.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        parties: { some: { personId: customerRef.personId, role: { in: ["TENANT", "CO_TENANT"] } } },
      },
      take: 2,
    });
    if (active.length === 1) contractId = active[0].id;
  }
  if (contractId) {
    const c = await prisma.contract.findUnique({ where: { id: contractId } });
    unitId = c?.unitId ?? null;
  }

  // Unikhet på fakturanummer inom organisationen skyddar också mot dubbletter.
  const dupNumber = await prisma.invoice.findFirst({
    where: { organizationId, invoiceNumber: inv.invoiceNumber },
  });
  if (dupNumber) {
    // Samma nummer men annat externt ID → kräver manuell granskning.
    await queueForReview(
      organizationId,
      opts.syncJobId ?? null,
      "invoice",
      externalSystem,
      inv.externalId,
      inv,
      `Fakturanummer ${inv.invoiceNumber} finns redan internt (id ${dupNumber.id}).`
    );
    return "review";
  }

  let creditsInvoiceId: string | null = null;
  if (inv.isCreditNote && inv.creditsExternalInvoiceId) {
    const origRef = await prisma.externalReference.findUnique({
      where: {
        organizationId_externalSystem_entityType_externalId: {
          organizationId,
          externalSystem,
          entityType: "invoice",
          externalId: inv.creditsExternalInvoiceId,
        },
      },
    });
    creditsInvoiceId = origRef?.invoiceId ?? null;
  }

  const created = await prisma.invoice.create({
    data: {
      organizationId,
      personId: customerRef.personId,
      contractId,
      unitId,
      invoiceNumber: inv.invoiceNumber,
      status: newStatus,
      invoiceDate: new Date(inv.invoiceDate),
      dueDate: new Date(inv.dueDate),
      periodStart: inv.periodStart ? new Date(inv.periodStart) : null,
      periodEnd: inv.periodEnd ? new Date(inv.periodEnd) : null,
      totalAmount: inv.totalAmount,
      vatAmount: inv.vatAmount,
      paidAmount: inv.paidAmount,
      currency: inv.currency,
      ocr: inv.ocr ?? null,
      bankgiro: inv.bankgiro ?? null,
      reference: inv.reference ?? null,
      isCreditNote: inv.isCreditNote ?? false,
      creditsInvoiceId,
      lines: {
        create: inv.lines.map((l, i) => ({
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          vatRate: l.vatRate,
          amount: l.amount,
          sortOrder: i,
        })),
      },
      statusHistory: {
        create: [{ toStatus: newStatus, source: "sync" }],
      },
    },
  });

  await prisma.externalReference.create({
    data: {
      organizationId,
      externalSystem,
      entityType: inv.isCreditNote ? "credit_note" : "invoice",
      externalId: inv.externalId,
      invoiceId: created.id,
      syncStatus: "synced",
      lastSyncedAt: new Date(),
      sourceVersion: inv.sourceVersion ?? null,
      sourceUpdatedAt: inv.sourceUpdatedAt ? new Date(inv.sourceUpdatedAt) : null,
    },
  });

  return "created";
}

/** Synka betalningar. Idempotent per externt betalnings-ID. */
export async function syncPayments(
  organizationId: string,
  connectionId: string,
  opts: { syncJobId?: string } = {}
): Promise<SyncCounters> {
  const { provider, connection } = await getProviderForConnection(connectionId);
  const counters: SyncCounters = { processed: 0, created: 0, updated: 0, skipped: 0, failed: 0 };
  const payments = await provider.fetchPayments();

  for (const p of payments) {
    counters.processed++;
    try {
      const result = await upsertExternalPayment(organizationId, connection.provider, p, opts);
      if (result === "created") counters.created++;
      else if (result === "skipped") counters.skipped++;
      else counters.updated++;
    } catch {
      counters.failed++;
    }
  }
  return counters;
}

export async function upsertExternalPayment(
  organizationId: string,
  externalSystem: string,
  p: ExternalPayment,
  opts: { syncJobId?: string } = {}
): Promise<"created" | "updated" | "skipped" | "review"> {
  const existingRef = await prisma.externalReference.findUnique({
    where: {
      organizationId_externalSystem_entityType_externalId: {
        organizationId,
        externalSystem,
        entityType: "payment",
        externalId: p.externalId,
      },
    },
  });
  if (existingRef) return "skipped"; // redan importerad – idempotent

  const invoiceRef = await prisma.externalReference.findUnique({
    where: {
      organizationId_externalSystem_entityType_externalId: {
        organizationId,
        externalSystem,
        entityType: "invoice",
        externalId: p.externalInvoiceId,
      },
    },
  });
  if (!invoiceRef?.invoiceId) {
    await queueForReview(
      organizationId,
      opts.syncJobId ?? null,
      "payment",
      externalSystem,
      p.externalId,
      p,
      `Betalningen refererar till okänd faktura (${p.externalInvoiceId}).`
    );
    return "review";
  }

  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        organizationId,
        amount: p.amount,
        currency: p.currency,
        paidAt: new Date(p.paidAt),
        method: p.method ?? null,
        reference: p.reference ?? null,
        allocations: {
          create: [{ invoiceId: invoiceRef.invoiceId!, amount: p.amount }],
        },
      },
    });
    await tx.externalReference.create({
      data: {
        organizationId,
        externalSystem,
        entityType: "payment",
        externalId: p.externalId,
        paymentId: payment.id,
        syncStatus: "synced",
        lastSyncedAt: new Date(),
      },
    });

    // Uppdatera fakturans betalstatus.
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceRef.invoiceId! },
      include: { paymentAllocations: true },
    });
    if (invoice) {
      const paid = invoice.paymentAllocations.reduce((sum, a) => sum + Number(a.amount), 0);
      const total = Number(invoice.totalAmount);
      const newStatus: InvoiceStatus = paid >= total ? "PAID" : "PARTIALLY_PAID";
      if (invoice.status !== newStatus && canTransition(invoiceTransitions, invoice.status, newStatus)) {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: newStatus, paidAmount: paid },
        });
        await tx.invoiceStatusEvent.create({
          data: { invoiceId: invoice.id, fromStatus: invoice.status, toStatus: newStatus, source: "sync" },
        });
      } else {
        await tx.invoice.update({ where: { id: invoice.id }, data: { paidAmount: paid } });
      }
    }
  });
  return "created";
}

/** Kör fullt synkjobb med loggning. */
export async function runSyncJob(
  organizationId: string,
  connectionId: string,
  jobType: "customers" | "invoices" | "payments" | "full",
  actorUserId?: string
) {
  const job = await prisma.integrationSyncJob.create({
    data: {
      organizationId,
      connectionId,
      jobType,
      status: "RUNNING",
      startedAt: new Date(),
      correlationId: `sync_${Date.now()}`,
    },
  });

  const totals: SyncCounters = { processed: 0, created: 0, updated: 0, skipped: 0, failed: 0 };
  const log: Record<string, SyncCounters> = {};
  let error: string | null = null;

  try {
    if (jobType === "customers" || jobType === "full") {
      const c = await syncCustomers(organizationId, connectionId, { syncJobId: job.id });
      log.customers = c;
      addCounters(totals, c);
    }
    if (jobType === "invoices" || jobType === "full") {
      const c = await syncInvoices(organizationId, connectionId, { syncJobId: job.id });
      log.invoices = c;
      addCounters(totals, c);
    }
    if (jobType === "payments" || jobType === "full") {
      const c = await syncPayments(organizationId, connectionId, { syncJobId: job.id });
      log.payments = c;
      addCounters(totals, c);
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Okänt fel";
  }

  const finished = await prisma.integrationSyncJob.update({
    where: { id: job.id },
    data: {
      status: error ? "FAILED" : totals.failed > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
      finishedAt: new Date(),
      itemsProcessed: totals.processed,
      itemsCreated: totals.created,
      itemsUpdated: totals.updated,
      itemsSkipped: totals.skipped,
      itemsFailed: totals.failed,
      log: log as unknown as Prisma.InputJsonValue,
      error,
    },
  });

  await prisma.integrationConnection.update({
    where: { id: connectionId },
    data: { lastSyncAt: new Date() },
  });

  await audit({
    organizationId,
    userId: actorUserId,
    actorType: actorUserId ? "user" : "system",
    action: "integration_sync",
    entityType: "integration_sync_job",
    entityId: job.id,
    after: { jobType, ...totals, error },
  });

  return finished;
}

function addCounters(target: SyncCounters, source: SyncCounters) {
  target.processed += source.processed;
  target.created += source.created;
  target.updated += source.updated;
  target.skipped += source.skipped;
  target.failed += source.failed;
}

/** Manuell rättning av granskningspost: koppla till person och kör om. */
export async function resolveReviewItem(
  organizationId: string,
  reviewItemId: string,
  resolution: { personId?: string; actorUserId: string; note?: string; reject?: boolean }
) {
  const item = await prisma.syncReviewItem.findFirst({
    where: { id: reviewItemId, organizationId, status: "PENDING" },
  });
  if (!item) throw new Error("Granskningsposten hittades inte.");

  if (resolution.reject) {
    return prisma.syncReviewItem.update({
      where: { id: item.id },
      data: {
        status: "REJECTED",
        resolvedByUserId: resolution.actorUserId,
        resolvedAt: new Date(),
        resolutionNote: resolution.note ?? null,
      },
    });
  }

  if (item.entityType === "customer" && resolution.personId) {
    await prisma.externalReference.upsert({
      where: {
        organizationId_externalSystem_entityType_externalId: {
          organizationId,
          externalSystem: item.externalSystem,
          entityType: "customer",
          externalId: item.externalId,
        },
      },
      create: {
        organizationId,
        externalSystem: item.externalSystem,
        entityType: "customer",
        externalId: item.externalId,
        personId: resolution.personId,
        syncStatus: "synced",
        lastSyncedAt: new Date(),
      },
      update: { personId: resolution.personId, syncStatus: "synced", lastSyncedAt: new Date() },
    });
  } else if (item.entityType === "invoice") {
    if (resolution.personId) {
      const payload = item.payload as unknown as ExternalInvoice;
      await prisma.externalReference.upsert({
        where: {
          organizationId_externalSystem_entityType_externalId: {
            organizationId,
            externalSystem: item.externalSystem,
            entityType: "customer",
            externalId: payload.externalCustomerId,
          },
        },
        create: {
          organizationId,
          externalSystem: item.externalSystem,
          entityType: "customer",
          externalId: payload.externalCustomerId,
          personId: resolution.personId,
          syncStatus: "synced",
          lastSyncedAt: new Date(),
        },
        update: { personId: resolution.personId },
      });
      await upsertExternalInvoice(organizationId, item.externalSystem, payload);
    }
  } else if (item.entityType === "payment") {
    const payload = item.payload as unknown as ExternalPayment;
    await upsertExternalPayment(organizationId, item.externalSystem, payload);
  }

  const resolved = await prisma.syncReviewItem.update({
    where: { id: item.id },
    data: {
      status: "RESOLVED",
      resolvedByUserId: resolution.actorUserId,
      resolvedAt: new Date(),
      resolutionNote: resolution.note ?? null,
    },
  });

  await audit({
    organizationId,
    userId: resolution.actorUserId,
    action: "sync_review_resolved",
    entityType: "sync_review_item",
    entityId: item.id,
    after: { personId: resolution.personId ?? null, rejected: resolution.reject ?? false },
  });

  return resolved;
}
