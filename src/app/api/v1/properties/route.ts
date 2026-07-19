import { prisma } from "@/lib/db";
import { withApiAuth, parsePagination, paginatedResponse } from "@/lib/api/helpers";
import { serializeProperty } from "@/lib/api/serializers";

export const GET = withApiAuth("properties:read", async (req, ctx) => {
  const pagination = parsePagination(req);
  const where = { organizationId: ctx.organizationId };
  const [items, total] = await Promise.all([
    prisma.property.findMany({
      where,
      orderBy: { name: "asc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.property.count({ where }),
  ]);
  return paginatedResponse(items.map(serializeProperty), total, pagination, ctx);
});
