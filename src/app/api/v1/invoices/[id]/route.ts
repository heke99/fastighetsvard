import { db } from "@/lib/db";
import { withApiAuth, apiJson } from "@/lib/api/helpers";
import { ApiError } from "@/lib/api/auth";
import { serializeInvoice } from "@/lib/api/serializers";

export const GET = withApiAuth("invoices:read", async (_req, ctx, params) => {
  const invoice = await db.invoice.findFirst({
    where: { id: params.id, organizationId: ctx.organizationId },
    include: { lines: true, externalReferences: true },
  });
  if (!invoice) throw new ApiError(404, "not_found", "Fakturan hittades inte.");
  return apiJson({ data: serializeInvoice(invoice) }, 200, ctx);
});
