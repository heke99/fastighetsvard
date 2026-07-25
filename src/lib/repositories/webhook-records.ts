import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

type Row = Record<string, any>;

function fail(operation: string, error: { code?: string } | null): never {
  throw new Error(`${operation} misslyckades (${error?.code ?? "database_error"}).`);
}

export async function dispatchWebhookEventRecords(input: {
  organizationId: string;
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  const { data: subscriptions, error } = await admin
    .from("WebhookSubscription")
    .select("id")
    .eq("organizationId", input.organizationId)
    .eq("isActive", true)
    .contains("events", [input.eventType])
    .limit(1000);
  if (error) fail("Webhook-prenumerationer för event", error);
  if (!subscriptions?.length) return 0;
  const rows = subscriptions.map((subscription) => ({
    id: randomUUID(),
    organizationId: input.organizationId,
    subscriptionId: subscription.id,
    eventId: input.eventId,
    eventType: input.eventType,
    payload: input.payload,
    status: "PENDING",
    nextAttemptAt: new Date().toISOString(),
  }));
  const { error: insertError } = await admin
    .from("WebhookDelivery")
    .upsert(rows, { onConflict: "subscriptionId,eventId", ignoreDuplicates: true });
  if (insertError) fail("Skapa webhook-leveranser", insertError);
  return rows.length;
}

export async function getWebhookDelivery(deliveryId: string): Promise<Row | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("WebhookDelivery")
    .select("id,organizationId,subscriptionId,eventId,eventType,payload,status,attempts")
    .eq("id", deliveryId)
    .maybeSingle();
  if (error) fail("Webhook-leverans", error);
  if (!data) return null;
  const { data: subscription, error: subscriptionError } = await admin
    .from("WebhookSubscription")
    .select("id,url,secret,isActive")
    .eq("id", data.subscriptionId)
    .eq("organizationId", data.organizationId)
    .maybeSingle();
  if (subscriptionError) fail("Webhook-leveransens prenumeration", subscriptionError);
  if (!subscription) return null;
  return { ...(data as unknown as Row), subscription: subscription as unknown as Row } as Row;
}

export async function recordWebhookDeliveryAttempt(input: {
  deliveryId: string;
  expectedAttempts: number;
  success: boolean;
  statusCode: number | null;
  error: string | null;
  nextAttemptAt: Date | null;
}) {
  const { data, error } = await createAdminClient().rpc("record_webhook_delivery_attempt", {
    p_delivery_id: input.deliveryId,
    p_expected_attempts: input.expectedAttempts,
    p_success: input.success,
    p_status_code: input.statusCode,
    p_error: input.error,
    p_next_attempt_at: input.nextAttemptAt?.toISOString() ?? null,
  });
  if (error) fail("Registrera webhook-försök", error);
  return data as { status: "delivered" | "failed" | "dead_letter" | "stale" };
}

export async function claimWebhookDeliveries(limit: number) {
  const { data, error } = await createAdminClient().rpc("claim_webhook_deliveries", {
    p_limit: limit,
  });
  if (error) fail("Claima webhook-leveranser", error);
  return (data ?? []).map((row: { id: string }) => row.id);
}

export async function resetWebhookDelivery(deliveryId: string) {
  const { data, error } = await createAdminClient()
    .from("WebhookDelivery")
    .update({
      status: "PENDING",
      nextAttemptAt: new Date().toISOString(),
      attempts: 0,
      lastError: null,
    })
    .eq("id", deliveryId)
    .select("id,organizationId")
    .maybeSingle();
  if (error) fail("Återställ webhook-leverans", error);
  return data as unknown as Row | null;
}
