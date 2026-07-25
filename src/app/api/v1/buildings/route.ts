import { withApiAuth, parsePagination, paginatedResponse } from "@/lib/api/helpers";
import { serializeBuilding } from "@/lib/api/serializers";
import { listOrganizationRecords } from "@/lib/repositories/api-records";

export const GET = withApiAuth("buildings:read", async (req, ctx) => {
  const url = new URL(req.url);
  const pagination = parsePagination(req);
  const propertyId = url.searchParams.get("property_id");
  const { items, total } = await listOrganizationRecords({
    table: "Building",
    columns: "id,propertyId,name,address,yearBuilt,floorsCount,createdAt,updatedAt",
    organizationId: ctx.organizationId,
    filters: propertyId
      ? [{ column: "propertyId", operator: "eq", value: propertyId }]
      : [],
    order: { column: "name", ascending: true },
    skip: pagination.skip,
    take: pagination.take,
  });
  return paginatedResponse(items.map(serializeBuilding), total, pagination, ctx);
});
