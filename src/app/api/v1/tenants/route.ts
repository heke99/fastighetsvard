import { withApiAuth, parsePagination, paginatedResponse } from "@/lib/api/helpers";
import { serializePerson } from "@/lib/api/serializers";
import { listApiTenants } from "@/lib/repositories/external-api-records";

/** GET /api/v1/tenants – personer med rollen TENANT. */
export const GET = withApiAuth("tenants:read", async (req, ctx) => {
  const url = new URL(req.url);
  const pagination = parsePagination(req);
  const activeOnly = url.searchParams.get("active") === "true";

  const { items, total } = await listApiTenants({
    organizationId: ctx.organizationId,
    activeOnly,
    skip: pagination.skip,
    take: pagination.take,
  });

  return paginatedResponse(items.map(serializePerson), total, pagination, ctx);
});
