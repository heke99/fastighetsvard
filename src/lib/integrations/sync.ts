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
import type { InvoiceStatus } from "@/lib/database-types";
import { applyExternalPayment } from "@/lib/repositories/integration-operations";
import {
  findActiveContractsForPerson,
  findContractByReference,
  findExternalReferenceRecord,
  findIntegrationPersonMatches,
  finishIntegrationSyncJob,
  getIntegrationConnectionRecord,
  getIntegrationContract,
  getIntegrationInvoice,
  getPendingSyncReview,
  persistExternalInvoiceRecord,
  queueSyncReviewRecord,
  resolveSyncReviewRecord,
  startIntegrationSyncJob,
  upsertExternalReferenceRecord,
} from "@/lib/repositories/integration-records";

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

export async function getProviderForConnection(
  connectionId: string,
  organizationId: string
): Promise<{
  provider: AccountingProvider;
  connection: { id: string; organizationId: string; provider: string };
}> {
  const connection = await getIntegrationConnectionRecord(connectionId, organizationId);
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
  return {
    provider,
    connection: connection as {
      id: string;
      organizationId: string;
      provider: string;
    },
  };
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
  const existingRef = await findExternalReferenceRecord(
    organizationId,
    externalSystem,
    "customer",
    customer.externalId
  );
  if (existingRef?.personId) return { personId: existingRef.personId, certain: true };

  if (customer.personalNumber) {
    const normalized = customer.personalNumber.replace(/[^0-9]/g, "");
    const matches = await findIntegrationPersonMatches(organizationId, "personalNumber", normalized);
    if (matches.length === 1) return { personId: matches[0].id, certain: true };
    if (matches.length > 1) {
      return { personId: null, certain: false, reason: "Flera personer med samma personnummer." };
    }
  }
  if (customer.orgNumber) {
    const matches = await findIntegrationPersonMatches(organizationId, "orgNumber", customer.orgNumber);
    if (matches.length === 1) return { personId: matches[0].id, certain: true };
  }
  if (customer.email) {
    const matches = await findIntegrationPersonMatches(
      organizationId,
      "email",
      customer.email.toLowerCase().trim()
    );
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
  return queueSyncReviewRecord({
    organizationId,
    syncJobId,
    entityType,
    externalSystem,
    externalId,
    payload,
    reason,
  });
}

/** Synka kunder från externt system. Idempotent. */
export async function syncCustomers(
  organizationId: string,
  connectionId: string,
  opts: { syncJobId?: string } = {}
): Promise<SyncCounters> {
  const { provider, connection } = await getProviderForConnection(connectionId, organizationId);
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
      await upsertExternalReferenceRecord({
        organizationId,
        externalSystem: connection.provider,
        entityType: "customer",
        externalId: customer.externalId,
        personId,
        syncStatus: "synced",
        sourceVersion: customer.sourceVersion ?? null,
        sourceUpdatedAt: customer.sourceUpdatedAt ? new Date(customer.sourceUpdatedAt) : null,
        metadata: { customerNumber: customer.customerNumber ?? null },
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
  const { provider, connection } = await getProviderForConnection(connectionId, organizationId);
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
  const entityType = inv.isCreditNote ? "credit_note" : "invoice";
  const existingRef = await findExternalReferenceRecord(
    organizationId,
    externalSystem,
    entityType,
    inv.externalId
  );
  const newStatus = externalToInternalInvoiceStatus[inv.status];
  const current = existingRef?.invoiceId
    ? await getIntegrationInvoice(existingRef.invoiceId)
    : null;
  if (existingRef?.invoiceId && !current) {
    throw new Error("Referens pekar på borttagen faktura.");
  }

  const customerRef = current
    ? null
    : await findExternalReferenceRecord(
        organizationId,
        externalSystem,
        "customer",
        inv.externalCustomerId
      );
  const personId = current?.personId ?? customerRef?.personId ?? null;
  if (!personId) {
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
  let contractId: string | null = current?.contractId ?? null;
  let unitId: string | null = current?.unitId ?? null;
  if (!current && inv.externalContractId) {
    const contractRef = await findExternalReferenceRecord(
      organizationId,
      externalSystem,
      "contract",
      inv.externalContractId
    );
    contractId = contractRef?.contractId ?? null;
  }
  if (!current && !contractId && inv.reference) {
    const contract = await findContractByReference(organizationId, inv.reference);
    contractId = contract?.id ?? null;
    unitId = contract?.unitId ?? null;
  }
  if (!current && !contractId) {
    const active = await findActiveContractsForPerson(organizationId, personId);
    if (active.length === 1) {
      contractId = active[0].id;
      unitId = active[0].unitId ?? null;
    }
  }
  if (!current && contractId && !unitId) {
    const contract = await getIntegrationContract(organizationId, contractId);
    unitId = contract?.unitId ?? null;
  }

  let creditsInvoiceId: string | null = null;
  if (inv.isCreditNote && inv.creditsExternalInvoiceId) {
    const origRef = await findExternalReferenceRecord(
      organizationId,
      externalSystem,
      "invoice",
      inv.creditsExternalInvoiceId
    );
    creditsInvoiceId = origRef?.invoiceId ?? null;
  }

  const result = await persistExternalInvoiceRecord({
    organizationId,
    externalSystem,
    entityType,
    externalId: inv.externalId,
    personId,
    contractId,
    unitId,
    creditsInvoiceId,
    status: newStatus,
    invoice: inv,
    sourceVersion: inv.sourceVersion ?? null,
    sourceUpdatedAt: inv.sourceUpdatedAt ? new Date(inv.sourceUpdatedAt) : null,
  });
  if (result.status === "review") {
    await queueForReview(
      organizationId,
      opts.syncJobId ?? null,
      "invoice",
      externalSystem,
      inv.externalId,
      inv,
      `Fakturanummer ${inv.invoiceNumber} finns redan internt.`
    );
  }
  if (result.statusConflict) {
    await audit({
      organizationId,
      actorType: "system",
      action: "invoice_status_conflict",
      entityType: "invoice",
      entityId: result.invoiceId,
      after: {
        internal: result.internalStatus,
        external: result.externalStatus,
        externalSystem,
      },
    });
  }
  return result.status;
}

/** Synka betalningar. Idempotent per externt betalnings-ID. */
export async function syncPayments(
  organizationId: string,
  connectionId: string,
  opts: { syncJobId?: string } = {}
): Promise<SyncCounters> {
  const { provider, connection } = await getProviderForConnection(connectionId, organizationId);
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
  const result = await applyExternalPayment({
    organizationId,
    externalSystem,
    externalPaymentId: p.externalId,
    externalInvoiceId: p.externalInvoiceId,
    amount: p.amount,
    currency: p.currency,
    paidAt: new Date(p.paidAt),
    method: p.method,
    reference: p.reference,
  });
  if (result.status === "review") {
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
  return result.status;
}

/** Kör fullt synkjobb med loggning. */
export async function runSyncJob(
  organizationId: string,
  connectionId: string,
  jobType: "customers" | "invoices" | "payments" | "full",
  actorUserId?: string
) {
  await getProviderForConnection(connectionId, organizationId);
  const job = await startIntegrationSyncJob({
    organizationId,
    connectionId,
    jobType,
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

  const finished = await finishIntegrationSyncJob({
    organizationId,
    jobId: job.id,
    connectionId,
    values: {
      status: error ? "FAILED" : totals.failed > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
      itemsProcessed: totals.processed,
      itemsCreated: totals.created,
      itemsUpdated: totals.updated,
      itemsSkipped: totals.skipped,
      itemsFailed: totals.failed,
      log,
      error,
    },
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
  const item = await getPendingSyncReview(organizationId, reviewItemId);
  if (!item) throw new Error("Granskningsposten hittades inte.");

  if (resolution.reject) {
    return resolveSyncReviewRecord({
      organizationId,
      itemId: item.id,
      actorUserId: resolution.actorUserId,
      status: "REJECTED",
      note: resolution.note,
    });
  }

  if (item.entityType === "customer" && resolution.personId) {
    await upsertExternalReferenceRecord({
      organizationId,
      externalSystem: item.externalSystem,
      entityType: "customer",
      externalId: item.externalId,
      personId: resolution.personId,
      syncStatus: "synced",
    });
  } else if (item.entityType === "invoice") {
    if (resolution.personId) {
      const payload = item.payload as unknown as ExternalInvoice;
      await upsertExternalReferenceRecord({
        organizationId,
        externalSystem: item.externalSystem,
        entityType: "customer",
        externalId: payload.externalCustomerId,
        personId: resolution.personId,
        syncStatus: "synced",
      });
      await upsertExternalInvoice(organizationId, item.externalSystem, payload);
    }
  } else if (item.entityType === "payment") {
    const payload = item.payload as unknown as ExternalPayment;
    await upsertExternalPayment(organizationId, item.externalSystem, payload);
  }

  const resolved = await resolveSyncReviewRecord({
    organizationId,
    itemId: item.id,
    actorUserId: resolution.actorUserId,
    status: "RESOLVED",
    note: resolution.note,
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
