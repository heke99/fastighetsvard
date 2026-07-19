import { prisma } from "@/lib/db";
import { signWebhookPayload, generateToken } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

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

const MAX_ATTEMPTS = 6;
/** Backoff i minuter: 1, 5, 15, 60, 240, 720. */
const BACKOFF_MINUTES = [1, 5, 15, 60, 240, 720];
const DISABLE_AFTER_CONSECUTIVE_FAILURES = 20;

/**
 * Skapa leveranser för alla aktiva prenumerationer som lyssnar på eventet.
 * Leveransen är idempotent per (subscription, eventId).
 */
export async function dispatchEvent(
  organizationId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<number> {
  const subscriptions = await prisma.webhookSubscription.findMany({
    where: { organizationId, isActive: true, events: { has: eventType } },
  });
  if (subscriptions.length === 0) return 0;

  const eventId = `evt_${generateToken(16)}`;
  let created = 0;
  for (const sub of subscriptions) {
    await prisma.webhookDelivery.upsert({
      where: { subscriptionId_eventId: { subscriptionId: sub.id, eventId } },
      create: {
        organizationId,
        subscriptionId: sub.id,
        eventId,
        eventType,
        payload: {
          id: eventId,
          type: eventType,
          createdAt: new Date().toISOString(),
          data: payload,
        } as Prisma.InputJsonValue,
        status: "PENDING",
        nextAttemptAt: new Date(),
      },
      update: {},
    });
    created++;
  }
  return created;
}

/** Försök leverera en enskild webhook. */
export async function attemptDelivery(deliveryId: string): Promise<boolean> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { subscription: true },
  });
  if (!delivery || delivery.status === "DELIVERED" || delivery.status === "DEAD_LETTER") {
    return false;
  }

  const body = JSON.stringify(delivery.payload);
  const { header } = signWebhookPayload(delivery.subscription.secret, body);
  const attempt = delivery.attempts + 1;

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

  if (success) {
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "DELIVERED",
        attempts: attempt,
        lastAttemptAt: new Date(),
        lastStatusCode: statusCode,
        deliveredAt: new Date(),
        nextAttemptAt: null,
        lastError: null,
      },
    });
    await prisma.webhookSubscription.update({
      where: { id: delivery.subscriptionId },
      data: { consecutiveFailures: 0 },
    });
    return true;
  }

  const isDeadLetter = attempt >= MAX_ATTEMPTS;
  const backoffMinutes = BACKOFF_MINUTES[Math.min(attempt - 1, BACKOFF_MINUTES.length - 1)];
  await prisma.webhookDelivery.update({
    where: { id: delivery.id },
    data: {
      status: isDeadLetter ? "DEAD_LETTER" : "FAILED",
      attempts: attempt,
      lastAttemptAt: new Date(),
      lastStatusCode: statusCode,
      lastError: errorMessage,
      nextAttemptAt: isDeadLetter ? null : new Date(Date.now() + backoffMinutes * 60_000),
    },
  });

  // Stäng av trasiga mottagare automatiskt efter många fel i rad.
  const sub = await prisma.webhookSubscription.update({
    where: { id: delivery.subscriptionId },
    data: { consecutiveFailures: { increment: 1 } },
  });
  if (sub.consecutiveFailures >= DISABLE_AFTER_CONSECUTIVE_FAILURES && sub.isActive) {
    await prisma.webhookSubscription.update({
      where: { id: sub.id },
      data: {
        isActive: false,
        disabledAt: new Date(),
        disabledReason: `Avstängd automatiskt efter ${sub.consecutiveFailures} misslyckade leveranser i rad.`,
      },
    });
    await audit({
      organizationId: delivery.organizationId,
      actorType: "system",
      action: "webhook_subscription_disabled",
      entityType: "webhook_subscription",
      entityId: sub.id,
    });
  }
  return false;
}

/** Processa förfallna leveranser (körs av cron/queue-worker eller API-anrop). */
export async function processPendingDeliveries(limit = 50): Promise<{ delivered: number; failed: number }> {
  const due = await prisma.webhookDelivery.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      nextAttemptAt: { lte: new Date() },
    },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
  });
  let delivered = 0, failed = 0;
  for (const d of due) {
    const ok = await attemptDelivery(d.id);
    if (ok) delivered++;
    else failed++;
  }
  return { delivered, failed };
}

/** Manuell återleverans av dead-letter. */
export async function redeliver(deliveryId: string, actorUserId?: string) {
  const delivery = await prisma.webhookDelivery.findUnique({ where: { id: deliveryId } });
  if (!delivery) throw new Error("Leveransen hittades inte.");
  await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: { status: "PENDING", nextAttemptAt: new Date(), attempts: 0 },
  });
  await audit({
    organizationId: delivery.organizationId,
    userId: actorUserId,
    action: "webhook_redelivery",
    entityType: "webhook_delivery",
    entityId: deliveryId,
  });
  return attemptDelivery(deliveryId);
}
