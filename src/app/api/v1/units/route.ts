import { db } from "@/lib/db";
import { withApiAuth, parsePagination, paginatedResponse } from "@/lib/api/helpers";
import { serializeUnit } from "@/lib/api/serializers";
import type { Database, UnitStatus, UnitType } from "@/lib/database-types";

export const GET = withApiAuth("units:read", async (req, ctx) => {
  const url = new URL(req.url);
  const pagination = parsePagination(req);
  const status = url.searchParams.get("status");
  const type = url.searchParams.get("type");
  const city = url.searchParams.get("city");
  const propertyId = url.searchParams.get("property_id");

  const where: Database.UnitWhereInput = {
    organizationId: ctx.organizationId,
    ...(status ? { status: status.toUpperCase() as UnitStatus } : {}),
    ...(type ? { type: type.toUpperCase() as UnitType } : {}),
    ...(city ? { city: { equals: city, mode: "insensitive" } } : {}),
    ...(propertyId ? { propertyId } : {}),
  };

  const [items, total] = await Promise.all([
    db.unit.findMany({
      where,
      orderBy: { unitNumber: "asc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    db.unit.count({ where }),
  ]);

  return paginatedResponse(items.map(serializeUnit), total, pagination, ctx);
});
