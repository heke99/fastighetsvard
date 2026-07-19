import { db } from "@/lib/db";
import { withApiAuth, parsePagination, paginatedResponse } from "@/lib/api/helpers";
import { serializeBuilding } from "@/lib/api/serializers";

export const GET = withApiAuth("buildings:read", async (req, ctx) => {
  const url = new URL(req.url);
  const pagination = parsePagination(req);
  const propertyId = url.searchParams.get("property_id");
  const where = {
    organizationId: ctx.organizationId,
    ...(propertyId ? { propertyId } : {}),
  };
  const [items, total] = await Promise.all([
    db.building.findMany({
      where,
      orderBy: { name: "asc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    db.building.count({ where }),
  ]);
  return paginatedResponse(items.map(serializeBuilding), total, pagination, ctx);
});
