import { withApiAuth, parsePagination, paginatedResponse } from "@/lib/api/helpers";
import { serializeProperty } from "@/lib/api/serializers";
import { listOrganizationRecords } from "@/lib/repositories/api-records";

export const GET = withApiAuth("properties:read", async (req, ctx) => {
  const pagination = parsePagination(req);
  const { items, total } = await listOrganizationRecords({
    table: "Property",
    columns: "id,name,designation,address,postalCode,city,municipality,yearBuilt,energyClass,status,createdAt,updatedAt",
    organizationId: ctx.organizationId,
    order: { column: "name", ascending: true },
    skip: pagination.skip,
    take: pagination.take,
  });
  return paginatedResponse(items.map(serializeProperty), total, pagination, ctx);
});
