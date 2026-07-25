import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  findContractByReference,
  findExternalReferenceRecord,
  queueSyncReviewRecord,
  upsertExternalReferenceRecord,
} from "@/lib/repositories/integration-records";

type Row = Record<string, any>;

function fail(operation: string, error: { code?: string } | null): never {
  throw new Error(`${operation} misslyckades (${error?.code ?? "database_error"}).`);
}

export async function findInboundWebhookConnection(
  provider: string,
  organizationId?: string
) {
  let query = createAdminClient()
    .from("IntegrationConnection")
    .select("id,organizationId,provider,webhookSecret")
    .eq("provider", provider)
    .eq("isActive", true);
  if (organizationId) query = query.eq("organizationId", organizationId);
  const { data, error } = await query.limit(2);
  if (error) fail("Inkommande webhook-anslutning", error);
  if ((data ?? []).length !== 1) return null;
  return data![0] as unknown as Row;
}

export async function createInboundWebhookEvent(input: {
  organizationId: string;
  provider: string;
  eventId: string;
  eventType: string;
  payload: unknown;
}) {
  const { data, error } = await createAdminClient()
    .from("InboundWebhookEvent")
    .insert({
      id: randomUUID(),
      organizationId: input.organizationId,
      provider: input.provider,
      eventId: input.eventId,
      eventType: input.eventType,
      payload: input.payload,
      signatureValid: true,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { duplicate: true as const };
    fail("Registrera inkommande webhook", error);
  }
  return { duplicate: false as const, id: data.id };
}

export async function finishInboundWebhookEvent(
  organizationId: string,
  eventId: string,
  processingError: string | null
) {
  const { error } = await createAdminClient()
    .from("InboundWebhookEvent")
    .update({
      processedAt: new Date().toISOString(),
      processingError,
    })
    .eq("organizationId", organizationId)
    .eq("id", eventId);
  if (error) fail("Slutför inkommande webhook", error);
}

export async function applyInboundCustomerEvent(input: {
  organizationId: string;
  provider: string;
  externalId: string;
  data: { phone?: string; address?: string };
}) {
  const reference = await findExternalReferenceRecord(
    input.organizationId,
    input.provider,
    "customer",
    input.externalId
  );
  if (!reference?.personId) {
    await queueSyncReviewRecord({
      organizationId: input.organizationId,
      entityType: "customer",
      externalSystem: input.provider,
      externalId: input.externalId,
      payload: input.data,
      reason: "Webhook för okänd kund – kräver manuell matchning.",
    });
    return "review" as const;
  }
  const updates = Object.fromEntries(
    Object.entries({
      phone: input.data.phone,
      address: input.data.address,
    }).filter(([, value]) => value !== undefined)
  );
  if (Object.keys(updates).length > 0) {
    const { error } = await createAdminClient()
      .from("Person")
      .update(updates)
      .eq("organizationId", input.organizationId)
      .eq("id", reference.personId);
    if (error) fail("Uppdatera webhook-kund", error);
  }
  await upsertExternalReferenceRecord({
    organizationId: input.organizationId,
    externalSystem: input.provider,
    entityType: "customer",
    externalId: input.externalId,
    personId: reference.personId,
    syncStatus: "synced",
  });
  return "updated" as const;
}

export async function applyInboundContractReference(input: {
  organizationId: string;
  provider: string;
  externalContractId: string;
  contractNumber: string;
}) {
  const contract = await findContractByReference(input.organizationId, input.contractNumber);
  if (!contract) return false;
  await upsertExternalReferenceRecord({
    organizationId: input.organizationId,
    externalSystem: input.provider,
    entityType: "contract",
    externalId: input.externalContractId,
    contractId: contract.id,
  });
  return true;
}
