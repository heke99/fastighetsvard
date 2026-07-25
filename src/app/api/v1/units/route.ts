import { withApiAuth, parsePagination, paginatedResponse } from "@/lib/api/helpers";
import { serializeUnit } from "@/lib/api/serializers";
import { listOrganizationRecords } from "@/lib/repositories/api-records";

export const GET = withApiAuth("units:read", async (req, ctx) => {
  const url = new URL(req.url);
  const pagination = parsePagination(req);
  const status = url.searchParams.get("status");
  const type = url.searchParams.get("type");
  const city = url.searchParams.get("city");
  const propertyId = url.searchParams.get("property_id");

  const { items, total } = await listOrganizationRecords({
    table: "Unit",
    columns: "id,propertyId,unitNumber,apartmentNumber,type,status,address,postalCode,city,area,floorLevel,rooms,livingArea,rent,price,availableFrom,createdAt,updatedAt",
    organizationId: ctx.organizationId,
    filters: [
      ...(status ? [{ column: "status", operator: "eq" as const, value: status.toUpperCase() }] : []),
      ...(type ? [{ column: "type", operator: "eq" as const, value: type.toUpperCase() }] : []),
      ...(city ? [{ column: "city", operator: "ilike" as const, value: city }] : []),
      ...(propertyId ? [{ column: "propertyId", operator: "eq" as const, value: propertyId }] : []),
    ],
    order: { column: "unitNumber", ascending: true },
    skip: pagination.skip,
    take: pagination.take,
  });

  return paginatedResponse(items.map(serializeUnit), total, pagination, ctx);
});
