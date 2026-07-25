import { withApiAuth, parsePagination, paginatedResponse } from "@/lib/api/helpers";
import { serializeListing } from "@/lib/api/serializers";
import { listOrganizationRecords } from "@/lib/repositories/api-records";

export const GET = withApiAuth("listings:read", async (req, ctx) => {
  const url = new URL(req.url);
  const pagination = parsePagination(req);
  const status = url.searchParams.get("status");
  const category = url.searchParams.get("category");

  const { items, total } = await listOrganizationRecords({
    table: "Listing",
    columns: "id,unitId,title,slug,category,status,publishedAt,applicationDeadline,moveInDate,rent,price,createdAt",
    organizationId: ctx.organizationId,
    filters: [
      ...(status ? [{ column: "status", operator: "eq" as const, value: status.toUpperCase() }] : []),
      ...(category ? [{ column: "category", operator: "eq" as const, value: category.toUpperCase() }] : []),
    ],
    order: { column: "createdAt", ascending: false },
    skip: pagination.skip,
    take: pagination.take,
  });

  return paginatedResponse(items.map(serializeListing), total, pagination, ctx);
});
