import { withApiAuth, parsePagination, paginatedResponse } from "@/lib/api/helpers";
import { serializeApplication } from "@/lib/api/serializers";
import { listOrganizationRecords } from "@/lib/repositories/api-records";

export const GET = withApiAuth("applications:read", async (req, ctx) => {
  const url = new URL(req.url);
  const pagination = parsePagination(req);
  const status = url.searchParams.get("status");
  const listingId = url.searchParams.get("listing_id");

  const { items, total } = await listOrganizationRecords({
    table: "Application",
    columns: "id,listingId,status,isInternalTransfer,desiredMoveInDate,submittedAt,createdAt",
    organizationId: ctx.organizationId,
    filters: [
      ...(status ? [{ column: "status", operator: "eq" as const, value: status.toUpperCase() }] : []),
      ...(listingId ? [{ column: "listingId", operator: "eq" as const, value: listingId }] : []),
    ],
    order: { column: "createdAt", ascending: false },
    skip: pagination.skip,
    take: pagination.take,
  });

  return paginatedResponse(items.map(serializeApplication), total, pagination, ctx);
});
