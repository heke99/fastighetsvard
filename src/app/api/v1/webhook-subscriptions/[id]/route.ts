import { withApiAuth, apiJson } from "@/lib/api/helpers";
import { ApiError } from "@/lib/api/auth";
import { serializeWebhookSubscription } from "@/lib/api/serializers";
import { audit } from "@/lib/audit";
import {
  deleteApiWebhookSubscription,
  getApiWebhookSubscription,
} from "@/lib/repositories/external-api-records";

export const GET = withApiAuth("webhook-subscriptions:read", async (_req, ctx, params) => {
  const sub = await getApiWebhookSubscription(ctx.organizationId, params.id);
  if (!sub) throw new ApiError(404, "not_found", "Prenumerationen hittades inte.");
  return apiJson({ data: serializeWebhookSubscription(sub) }, 200, ctx);
});

export const DELETE = withApiAuth("webhook-subscriptions:write", async (_req, ctx, params) => {
  const sub = await getApiWebhookSubscription(ctx.organizationId, params.id);
  if (!sub) throw new ApiError(404, "not_found", "Prenumerationen hittades inte.");
  await deleteApiWebhookSubscription(ctx.organizationId, sub.id);
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
