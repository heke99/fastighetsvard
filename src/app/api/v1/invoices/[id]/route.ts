import { withApiAuth, apiJson } from "@/lib/api/helpers";
import { ApiError } from "@/lib/api/auth";
import { serializeInvoice } from "@/lib/api/serializers";
import { getApiInvoice } from "@/lib/repositories/external-api-records";

export const GET = withApiAuth("invoices:read", async (_req, ctx, params) => {
  const invoice = await getApiInvoice(ctx.organizationId, params.id);
  if (!invoice) throw new ApiError(404, "not_found", "Fakturan hittades inte.");
  return apiJson({ data: serializeInvoice(invoice) }, 200, ctx);
});
