import { prisma } from "@/lib/db";
import { withApiAuth, parsePagination, paginatedResponse } from "@/lib/api/helpers";
import { serializeListing } from "@/lib/api/serializers";
import type { Prisma, ListingStatus, ListingCategory } from "@prisma/client";

export const GET = withApiAuth("listings:read", async (req, ctx) => {
  const url = new URL(req.url);
  const pagination = parsePagination(req);
  const status = url.searchParams.get("status");
  const category = url.searchParams.get("category");

  const where: Prisma.ListingWhereInput = {
    organizationId: ctx.organizationId,
    ...(status ? { status: status.toUpperCase() as ListingStatus } : {}),
    ...(category ? { category: category.toUpperCase() as ListingCategory } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.listing.count({ where }),
  ]);

  return paginatedResponse(items.map(serializeListing), total, pagination, ctx);
});
