import { z } from "zod";
import { withApiAuth, withIdempotency } from "@/lib/api/helpers";
import { upsertExternalInvoice } from "@/lib/integrations/sync";
import { audit } from "@/lib/audit";

/**
 * POST /api/v1/invoices/sync
 * Extern push av fakturor från bokföringssystem. Idempotent:
 * samma externa faktura (system + externt id) skapar aldrig dubbletter.
 */

const lineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number(),
  unit_price: z.number(),
  vat_rate: z.number(),
  amount: z.number(),
});

const invoiceSchema = z.object({
  external_system: z.string().min(1),
  external_id: z.string().min(1),
  invoice_number: z.string().min(1),
  external_customer_id: z.string().min(1),
  external_contract_id: z.string().optional(),
  invoice_date: z.string(),
  due_date: z.string(),
  period_start: z.string().optional(),
  period_end: z.string().optional(),
  total_amount: z.number(),
  vat_amount: z.number().default(0),
  paid_amount: z.number().default(0),
  currency: z.string().default("SEK"),
  status: z.enum([
    "draft", "sent", "partially_paid", "paid", "overdue",
    "reminded", "collection", "credited", "cancelled",
  ]),
  ocr: z.string().optional(),
  bankgiro: z.string().optional(),
  reference: z.string().optional(),
  is_credit_note: z.boolean().default(false),
  credits_external_invoice_id: z.string().optional(),
  source_version: z.string().optional(),
  source_updated_at: z.string().optional(),
  lines: z.array(lineSchema).default([]),
});

const syncSchema = z.object({ invoices: z.array(invoiceSchema).min(1).max(500) });

export const POST = withApiAuth("invoices:write", async (req, ctx) => {
  const bodyText = await req.text();
  return withIdempotency(req, ctx, bodyText, async () => {
    const input = syncSchema.parse(JSON.parse(bodyText));
    const results: { external_id: string; result: string }[] = [];

    for (const inv of input.invoices) {
      try {
        const result = await upsertExternalInvoice(ctx.organizationId, inv.external_system, {
          externalId: inv.external_id,
          invoiceNumber: inv.invoice_number,
          externalCustomerId: inv.external_customer_id,
          externalContractId: inv.external_contract_id,
          invoiceDate: inv.invoice_date,
          dueDate: inv.due_date,
          periodStart: inv.period_start,
          periodEnd: inv.period_end,
          totalAmount: inv.total_amount,
          vatAmount: inv.vat_amount,
          paidAmount: inv.paid_amount,
          currency: inv.currency,
          status: inv.status,
          ocr: inv.ocr,
          bankgiro: inv.bankgiro,
          reference: inv.reference,
          isCreditNote: inv.is_credit_note,
          creditsExternalInvoiceId: inv.credits_external_invoice_id,
          sourceVersion: inv.source_version,
          sourceUpdatedAt: inv.source_updated_at,
          lines: inv.lines.map((l) => ({
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unit_price,
            vatRate: l.vat_rate,
            amount: l.amount,
          })),
        });
        results.push({ external_id: inv.external_id, result });
      } catch (e) {
        results.push({
          external_id: inv.external_id,
          result: `error: ${e instanceof Error ? e.message : "okänt fel"}`,
        });
      }
    }

    await audit({
      organizationId: ctx.organizationId,
      actorType: "api_key",
      actorId: ctx.apiKey.id,
      action: "invoice_sync_push",
      entityType: "invoice",
      after: { count: input.invoices.length },
      correlationId: ctx.correlationId,
    });

    return { status: 200, body: { data: { results } } };
  });
});
