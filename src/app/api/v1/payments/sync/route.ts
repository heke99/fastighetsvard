import { z } from "zod";
import { withApiAuth, withIdempotency } from "@/lib/api/helpers";
import { upsertExternalPayment } from "@/lib/integrations/sync";
import { audit } from "@/lib/audit";

/**
 * POST /api/v1/payments/sync
 * Extern push av betalningar. Idempotent per externt betalnings-ID.
 */

const paymentSchema = z.object({
  external_system: z.string().min(1),
  external_id: z.string().min(1),
  external_invoice_id: z.string().min(1),
  amount: z.number(),
  currency: z.string().default("SEK"),
  paid_at: z.string(),
  method: z.string().optional(),
  reference: z.string().optional(),
});

const syncSchema = z.object({ payments: z.array(paymentSchema).min(1).max(500) });

export const POST = withApiAuth("payments:write", async (req, ctx) => {
  const bodyText = await req.text();
  return withIdempotency(req, ctx, bodyText, async () => {
    const input = syncSchema.parse(JSON.parse(bodyText));
    const results: { external_id: string; result: string }[] = [];

    for (const p of input.payments) {
      try {
        const result = await upsertExternalPayment(ctx.organizationId, p.external_system, {
          externalId: p.external_id,
          externalInvoiceId: p.external_invoice_id,
          amount: p.amount,
          currency: p.currency,
          paidAt: p.paid_at,
          method: p.method,
          reference: p.reference,
        });
        results.push({ external_id: p.external_id, result });
      } catch (e) {
        results.push({
          external_id: p.external_id,
          result: `error: ${e instanceof Error ? e.message : "okänt fel"}`,
        });
      }
    }

    await audit({
      organizationId: ctx.organizationId,
      actorType: "api_key",
      actorId: ctx.apiKey.id,
      action: "payment_sync_push",
      entityType: "payment",
      after: { count: input.payments.length },
      correlationId: ctx.correlationId,
    });

    return { status: 200, body: { data: { results } } };
  });
});
