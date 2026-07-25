import { withApiAuth, parsePagination, paginatedResponse } from "@/lib/api/helpers";
import { serializeContract } from "@/lib/api/serializers";
import { listApiContracts } from "@/lib/repositories/external-api-records";

export const GET = withApiAuth("contracts:read", async (req, ctx) => {
  const url = new URL(req.url);
  const pagination = parsePagination(req);
  const status = url.searchParams.get("status");
  const unitId = url.searchParams.get("unit_id");
  const personId = url.searchParams.get("person_id");

  const { items, total } = await listApiContracts({
    organizationId: ctx.organizationId,
    status: status?.toUpperCase(),
    unitId,
    personId,
    skip: pagination.skip,
    take: pagination.take,
  });

  return paginatedResponse(items.map(serializeContract), total, pagination, ctx);
});
