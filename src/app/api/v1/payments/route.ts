import { withApiAuth, parsePagination, paginatedResponse } from "@/lib/api/helpers";
import { serializePayment } from "@/lib/api/serializers";
import { listOrganizationRecords } from "@/lib/repositories/api-records";

export const GET = withApiAuth("payments:read", async (req, ctx) => {
  const url = new URL(req.url);
  const pagination = parsePagination(req);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const { items, total } = await listOrganizationRecords({
    table: "Payment",
    columns: "id,amount,currency,paidAt,method,reference,createdAt",
    organizationId: ctx.organizationId,
    filters: [
      ...(from ? [{ column: "paidAt", operator: "gte" as const, value: new Date(from).toISOString() }] : []),
      ...(to ? [{ column: "paidAt", operator: "lte" as const, value: new Date(to).toISOString() }] : []),
    ],
    order: { column: "paidAt", ascending: false },
    skip: pagination.skip,
    take: pagination.take,
  });

  return paginatedResponse(items.map(serializePayment), total, pagination, ctx);
});
