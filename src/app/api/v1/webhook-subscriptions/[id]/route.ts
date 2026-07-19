import { db } from "@/lib/db";
import { withApiAuth, apiJson } from "@/lib/api/helpers";
import { ApiError } from "@/lib/api/auth";
import { serializeWebhookSubscription } from "@/lib/api/serializers";
import { audit } from "@/lib/audit";

export const GET = withApiAuth("webhook-subscriptions:read", async (_req, ctx, params) => {
  const sub = await db.webhookSubscription.findFirst({
    where: { id: params.id, organizationId: ctx.organizationId },
  });
  if (!sub) throw new ApiError(404, "not_found", "Prenumerationen hittades inte.");
  return apiJson({ data: serializeWebhookSubscription(sub) }, 200, ctx);
});

export const DELETE = withApiAuth("webhook-subscriptions:write", async (_req, ctx, params) => {
  const sub = await db.webhookSubscription.findFirst({
    where: { id: params.id, organizationId: ctx.organizationId },
  });
  if (!sub) throw new ApiError(404, "not_found", "Prenumerationen hittades inte.");
  await db.webhookSubscription.delete({ where: { id: sub.id } });
  await audit({
    organizationId: ctx.organizationId,
    actorType: "api_key",
    actorId: ctx.apiKey.id,
    action: "delete",
    entityType: "webhook_subscription",
    entityId: sub.id,
    correlationId: ctx.correlationId,
  });
  return apiJson({ data: { deleted: true } }, 200, ctx);
});
