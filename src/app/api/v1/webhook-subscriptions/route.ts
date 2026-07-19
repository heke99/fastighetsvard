import { z } from "zod";
import { db } from "@/lib/db";
import {
  withApiAuth,
  parsePagination,
  paginatedResponse,
  withIdempotency,
} from "@/lib/api/helpers";
import { serializeWebhookSubscription } from "@/lib/api/serializers";
import { OUTBOUND_EVENTS } from "@/lib/services/webhooks";
import { generateToken } from "@/lib/crypto";
import { audit } from "@/lib/audit";

export const GET = withApiAuth("webhook-subscriptions:read", async (req, ctx) => {
  const pagination = parsePagination(req);
  const where = { organizationId: ctx.organizationId };
  const [items, total] = await Promise.all([
    db.webhookSubscription.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    db.webhookSubscription.count({ where }),
  ]);
  return paginatedResponse(items.map(serializeWebhookSubscription), total, pagination, ctx);
});

const createSchema = z.object({
  url: z.string().url().refine((u) => u.startsWith("https://") || process.env.NODE_ENV !== "production", {
    message: "Webhook-URL måste använda HTTPS.",
  }),
  events: z
    .array(z.enum(OUTBOUND_EVENTS as unknown as [string, ...string[]]))
    .min(1),
});

export const POST = withApiAuth("webhook-subscriptions:write", async (req, ctx) => {
  const bodyText = await req.text();
  return withIdempotency(req, ctx, bodyText, async () => {
    const input = createSchema.parse(JSON.parse(bodyText));
    const secret = `whsec_${generateToken(32)}`;
    const subscription = await db.webhookSubscription.create({
      data: {
        organizationId: ctx.organizationId,
        url: input.url,
        secret,
        events: input.events,
      },
    });
    await audit({
      organizationId: ctx.organizationId,
      actorType: "api_key",
      actorId: ctx.apiKey.id,
      action: "create",
      entityType: "webhook_subscription",
      entityId: subscription.id,
      correlationId: ctx.correlationId,
    });
    // Hemligheten visas endast en gång vid skapandet.
    return {
      status: 201,
      body: { data: { ...serializeWebhookSubscription(subscription), secret } },
    };
  });
});
