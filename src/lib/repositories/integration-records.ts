import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { InvoiceStatus } from "@/lib/database-types";

type Row = Record<string, any>;

function fail(operation: string, error: { code?: string } | null): never {
  throw new Error(`${operation} misslyckades (${error?.code ?? "database_error"}).`);
}

export async function getIntegrationConnectionRecord(
  connectionId: string,
  organizationId?: string
) {
  let query = createAdminClient()
    .from("IntegrationConnection")
    .select("id,organizationId,provider,isActive,credentialsEncrypted,settings,webhookSecret,lastSyncAt")
    .eq("id", connectionId);
  if (organizationId) query = query.eq("organizationId", organizationId);
  const { data, error } = await query.maybeSingle();
  if (error) fail("Integrationsanslutning", error);
  return data as unknown as Row | null;
}

export async function findExternalReferenceRecord(
  organizationId: string,
  externalSystem: string,
  entityType: string,
  externalId: string
) {
  const { data, error } = await createAdminClient()
    .from("ExternalReference")
    .select("id,personId,invoiceId,paymentId,contractId,unitId,syncStatus,lastSyncedAt")
    .eq("organizationId", organizationId)
    .eq("externalSystem", externalSystem)
    .eq("entityType", entityType)
    .eq("externalId", externalId)
    .maybeSingle();
  if (error) fail("Extern referens", error);
  return data as unknown as Row | null;
}

export async function findIntegrationPersonMatches(
  organizationId: string,
  field: "personalNumber" | "orgNumber" | "email",
  value: string
) {
  const { data, error } = await createAdminClient()
    .from("Person")
    .select("id,firstName,lastName,email")
    .eq("organizationId", organizationId)
    .eq(field, value)
    .limit(2);
  if (error) fail("Integrationspersonmatchning", error);
  return (data ?? []) as unknown as Row[];
}

export async function queueSyncReviewRecord(input: {
  organizationId: string;
  syncJobId?: string | null;
  entityType: string;
  externalSystem: string;
  externalId: string;
  payload: unknown;
  reason: string;
}) {
  const { data, error } = await createAdminClient().rpc("queue_sync_review", {
    p_organization_id: input.organizationId,
    p_sync_job_id: input.syncJobId ?? null,
    p_entity_type: input.entityType,
    p_external_system: input.externalSystem,
    p_external_id: input.externalId,
    p_payload: input.payload,
    p_reason: input.reason,
  });
  if (error) fail("Köa integrationsgranskning", error);
  return data as Row;
}

export async function upsertExternalReferenceRecord(input: {
  organizationId: string;
  externalSystem: string;
  entityType: string;
  externalId: string;
  personId?: string | null;
  contractId?: string | null;
  invoiceId?: string | null;
  syncStatus?: string;
  sourceVersion?: string | null;
  sourceUpdatedAt?: Date | null;
  metadata?: unknown;
}) {
  const values: Record<string, unknown> = {
    id: randomUUID(),
    organizationId: input.organizationId,
    externalSystem: input.externalSystem,
    entityType: input.entityType,
    externalId: input.externalId,
    syncStatus: input.syncStatus ?? "synced",
    lastSyncedAt: new Date().toISOString(),
    sourceVersion: input.sourceVersion ?? null,
    sourceUpdatedAt: input.sourceUpdatedAt?.toISOString() ?? null,
    metadata: input.metadata ?? null,
  };
  if (input.personId !== undefined) values.personId = input.personId;
  if (input.contractId !== undefined) values.contractId = input.contractId;
  if (input.invoiceId !== undefined) values.invoiceId = input.invoiceId;
  const { data, error } = await createAdminClient()
    .from("ExternalReference")
    .upsert(values, {
      onConflict: "organizationId,externalSystem,entityType,externalId",
      ignoreDuplicates: false,
    })
    .select("id,personId,contractId,invoiceId")
    .single();
  if (error) fail("Spara extern referens", error);
  return data as unknown as Row;
}

export async function getIntegrationInvoice(invoiceId: string) {
  const { data, error } = await createAdminClient()
    .from("Invoice")
    .select("id,organizationId,personId,contractId,unitId,status")
    .eq("id", invoiceId)
    .maybeSingle();
  if (error) fail("Integrationsfaktura", error);
  return data as unknown as Row | null;
}

export async function findContractByReference(
  organizationId: string,
  reference: string
) {
  const admin = createAdminClient();
  const { data: byNumber, error: numberError } = await admin
    .from("Contract")
    .select("id,unitId")
    .eq("organizationId", organizationId)
    .eq("contractNumber", reference)
    .limit(1)
    .maybeSingle();
  if (numberError) fail("Avtal via avtalsnummer", numberError);
  if (byNumber) return byNumber as unknown as Row;
  const { data, error } = await admin
    .from("Contract")
    .select("id,unitId")
    .eq("organizationId", organizationId)
    .eq("invoiceReference", reference)
    .limit(1)
    .maybeSingle();
  if (error) fail("Avtal via fakturareferens", error);
  return data as unknown as Row | null;
}

export async function getIntegrationContract(organizationId: string, contractId: string) {
  const { data, error } = await createAdminClient()
    .from("Contract")
    .select("id,unitId")
    .eq("organizationId", organizationId)
    .eq("id", contractId)
    .maybeSingle();
  if (error) fail("Integrationsavtal", error);
  return data as unknown as Row | null;
}

export async function findActiveContractsForPerson(
  organizationId: string,
  personId: string
) {
  const admin = createAdminClient();
  const { data: parties, error: partyError } = await admin
    .from("ContractParty")
    .select("contractId")
    .eq("personId", personId)
    .in("role", ["TENANT", "CO_TENANT"])
    .limit(3);
  if (partyError) fail("Aktiva avtalsparter", partyError);
  const ids = [...new Set((parties ?? []).map((row) => row.contractId))];
  if (ids.length === 0) return [];
  const { data, error } = await admin
    .from("Contract")
    .select("id,unitId")
    .eq("organizationId", organizationId)
    .eq("status", "ACTIVE")
    .in("id", ids)
    .limit(2);
  if (error) fail("Aktiva personavtal", error);
  return (data ?? []) as unknown as Row[];
}

export async function persistExternalInvoiceRecord(input: {
  organizationId: string;
  externalSystem: string;
  entityType: string;
  externalId: string;
  personId: string;
  contractId?: string | null;
  unitId?: string | null;
  creditsInvoiceId?: string | null;
  status: InvoiceStatus;
  invoice: unknown;
  sourceVersion?: string | null;
  sourceUpdatedAt?: Date | null;
}) {
  const { data, error } = await createAdminClient().rpc("persist_external_invoice", {
    p_organization_id: input.organizationId,
    p_external_system: input.externalSystem,
    p_entity_type: input.entityType,
    p_external_id: input.externalId,
    p_person_id: input.personId,
    p_contract_id: input.contractId ?? null,
    p_unit_id: input.unitId ?? null,
    p_credits_invoice_id: input.creditsInvoiceId ?? null,
    p_status: input.status,
    p_invoice: input.invoice,
    p_source_version: input.sourceVersion ?? null,
    p_source_updated_at: input.sourceUpdatedAt?.toISOString() ?? null,
  });
  if (error) fail("Spara extern faktura", error);
  return data as {
    status: "created" | "updated" | "review";
    invoiceId?: string;
    statusConflict?: boolean;
    internalStatus?: string;
    externalStatus?: string;
    reason?: string;
  };
}

export async function startIntegrationSyncJob(input: {
  organizationId: string;
  connectionId: string;
  jobType: string;
}) {
  const { data, error } = await createAdminClient()
    .from("IntegrationSyncJob")
    .insert({
      id: randomUUID(),
      organizationId: input.organizationId,
      connectionId: input.connectionId,
      jobType: input.jobType,
      status: "RUNNING",
      startedAt: new Date().toISOString(),
      correlationId: `sync_${Date.now()}`,
    })
    .select("id,connectionId,jobType,status")
    .single();
  if (error) fail("Starta integrationsjobb", error);
  return data as unknown as Row;
}

export async function finishIntegrationSyncJob(input: {
  organizationId: string;
  jobId: string;
  connectionId: string;
  values: Row;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("IntegrationSyncJob")
    .update({ ...input.values, finishedAt: new Date().toISOString() })
    .eq("organizationId", input.organizationId)
    .eq("id", input.jobId)
    .select("id,status,itemsProcessed,itemsCreated,itemsUpdated,itemsSkipped,itemsFailed,error")
    .single();
  if (error) fail("Slutför integrationsjobb", error);
  const { error: connectionError } = await admin
    .from("IntegrationConnection")
    .update({ lastSyncAt: new Date().toISOString() })
    .eq("organizationId", input.organizationId)
    .eq("id", input.connectionId);
  if (connectionError) fail("Uppdatera integrationens synktid", connectionError);
  return data as unknown as Row;
}

export async function getPendingSyncReview(organizationId: string, itemId: string) {
  const { data, error } = await createAdminClient()
    .from("SyncReviewItem")
    .select("id,entityType,externalSystem,externalId,payload,status")
    .eq("organizationId", organizationId)
    .eq("id", itemId)
    .eq("status", "PENDING")
    .maybeSingle();
  if (error) fail("Integrationsgranskningspost", error);
  return data as unknown as Row | null;
}

export async function resolveSyncReviewRecord(input: {
  organizationId: string;
  itemId: string;
  actorUserId: string;
  status: "RESOLVED" | "REJECTED";
  note?: string;
}) {
  const { data, error } = await createAdminClient()
    .from("SyncReviewItem")
    .update({
      status: input.status,
      resolvedByUserId: input.actorUserId,
      resolvedAt: new Date().toISOString(),
      resolutionNote: input.note ?? null,
    })
    .eq("organizationId", input.organizationId)
    .eq("id", input.itemId)
    .eq("status", "PENDING")
    .select("id,status")
    .single();
  if (error) fail("Lös integrationsgranskningspost", error);
  return data as unknown as Row;
}
