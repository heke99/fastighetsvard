import { signWebhookPayload, generateToken } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import {
  claimWebhookDeliveries,
  dispatchWebhookEventRecords,
  getWebhookDelivery,
  recordWebhookDeliveryAttempt,
  resetWebhookDelivery,
} from "@/lib/repositories/webhook-records";

/**
 * Utgående webhooks med HMAC-signatur, retries med exponentiell backoff
 * och dead-letter efter max antal försök.
 */

export const OUTBOUND_EVENTS = [
  "tenant.created",
  "tenant.updated",
  "contract.created",
  "contract.signed",
  "contract.activated",
  "contract.terminated",
  "unit.created",
  "unit.updated",
  "listing.published",
  "application.submitted",
  "maintenance_request.created",
  "maintenance_request.completed",
  "customer.updated",
  "invoice.updated",
] as const;

export type OutboundEvent = (typeof OUTBOUND_EVENTS)[number];

/** Backoff i minuter: 1, 5, 15, 60, 240, 720. */
const BACKOFF_MINUTES = [1, 5, 15, 60, 240, 720];

/**
 * Skapa leveranser för alla aktiva prenumerationer som lyssnar på eventet.
 * Leveransen är idempotent per (subscription, eventId).
 */
export async function dispatchEvent(
  organizationId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<number> {
  const eventId = `evt_${generateToken(16)}`;
  return dispatchWebhookEventRecords({
    organizationId,
    eventId,
    eventType,
    payload: {
      id: eventId,
      type: eventType,
      createdAt: new Date().toISOString(),
      data: payload,
    },
  });
}

/** Försök leverera en enskild webhook. */
export async function attemptDelivery(deliveryId: string): Promise<boolean> {
  const delivery = await getWebhookDelivery(deliveryId);
  if (!delivery || delivery.status === "DELIVERED" || delivery.status === "DEAD_LETTER") {
    return false;
  }

  const body = JSON.stringify(delivery.payload);
  const { header } = signWebhookPayload(delivery.subscription.secret, body);
  let success = false;
  let statusCode: number | null = null;
  let errorMessage: string | null = null;

  try {
    const res = await fetch(delivery.subscription.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-OET-Signature": header,
        "X-OET-Event": delivery.eventType,
        "X-OET-Event-Id": delivery.eventId,
        "X-OET-Delivery-Id": delivery.id,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    statusCode = res.status;
    success = res.ok;
    if (!res.ok) errorMessage = `HTTP ${res.status}`;
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : "Nätverksfel";
  }

  const backoffMinutes =
    BACKOFF_MINUTES[Math.min(delivery.attempts, BACKOFF_MINUTES.length - 1)];
  const result = await recordWebhookDeliveryAttempt({
    deliveryId: delivery.id,
    expectedAttempts: delivery.attempts,
    success,
    statusCode,
    error: errorMessage,
    nextAttemptAt: success ? null : new Date(Date.now() + backoffMinutes * 60_000),
  });
  return result.status === "delivered";
}

/** Processa förfallna leveranser (körs av cron/queue-worker eller API-anrop). */
export async function processPendingDeliveries(limit = 50): Promise<{ delivered: number; failed: number }> {
  const due = await claimWebhookDeliveries(limit);
  let delivered = 0, failed = 0;
  for (const deliveryId of due) {
    const ok = await attemptDelivery(deliveryId);
    if (ok) delivered++;
    else failed++;
  }
  return { delivered, failed };
}

/** Manuell återleverans av dead-letter. */
export async function redeliver(deliveryId: string, actorUserId?: string) {
  const delivery = await resetWebhookDelivery(deliveryId);
  if (!delivery) throw new Error("Leveransen hittades inte.");
  await audit({
    organizationId: delivery.organizationId,
    userId: actorUserId,
    action: "webhook_redelivery",
    entityType: "webhook_delivery",
    entityId: deliveryId,
  });
  return attemptDelivery(deliveryId);
}
