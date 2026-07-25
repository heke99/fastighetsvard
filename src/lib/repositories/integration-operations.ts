import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function applyExternalPayment(input: {
  organizationId: string;
  externalSystem: string;
  externalPaymentId: string;
  externalInvoiceId: string;
  amount: number;
  currency: string;
  paidAt: Date;
  method?: string;
  reference?: string;
}) {
  const { data, error } = await createAdminClient().rpc("apply_external_payment", {
    p_organization_id: input.organizationId,
    p_external_system: input.externalSystem,
    p_external_payment_id: input.externalPaymentId,
    p_external_invoice_id: input.externalInvoiceId,
    p_amount: input.amount,
    p_currency: input.currency,
    p_paid_at: input.paidAt.toISOString(),
    p_method: input.method ?? null,
    p_reference: input.reference ?? null,
  });
  if (error) throw new Error(`Betalningsimporten misslyckades (${error.code}).`);
  return data as { status: "created" | "skipped" | "review"; paymentId?: string; invoiceId?: string };
}
