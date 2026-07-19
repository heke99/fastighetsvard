import { db } from "@/lib/db";
import { withApiAuth, parsePagination, paginatedResponse } from "@/lib/api/helpers";
import { serializeApplication } from "@/lib/api/serializers";
import type { Database, ApplicationStatus } from "@/lib/database-types";

export const GET = withApiAuth("applications:read", async (req, ctx) => {
  const url = new URL(req.url);
  const pagination = parsePagination(req);
  const status = url.searchParams.get("status");
  const listingId = url.searchParams.get("listing_id");

  const where: Database.ApplicationWhereInput = {
    organizationId: ctx.organizationId,
    ...(status ? { status: status.toUpperCase() as ApplicationStatus } : {}),
    ...(listingId ? { listingId } : {}),
  };

  const [items, total] = await Promise.all([
    db.application.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    db.application.count({ where }),
  ]);

  return paginatedResponse(items.map(serializeApplication), total, pagination, ctx);
});
