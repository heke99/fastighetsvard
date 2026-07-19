import { db } from "@/lib/db";
import { withApiAuth, parsePagination, paginatedResponse } from "@/lib/api/helpers";
import { serializePerson } from "@/lib/api/serializers";
import type { Database } from "@/lib/database-types";

/** GET /api/v1/tenants – personer med rollen TENANT. */
export const GET = withApiAuth("tenants:read", async (req, ctx) => {
  const url = new URL(req.url);
  const pagination = parsePagination(req);
  const activeOnly = url.searchParams.get("active") === "true";

  const where: Database.PersonWhereInput = {
    organizationId: ctx.organizationId,
    roles: { some: { role: "TENANT" } },
    ...(activeOnly
      ? {
          contractParties: {
            some: { role: { in: ["TENANT", "CO_TENANT"] }, contract: { status: "ACTIVE" } },
          },
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    db.person.findMany({
      where,
      include: { externalReferences: { where: { entityType: "customer" } } },
      orderBy: { lastName: "asc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    db.person.count({ where }),
  ]);

  return paginatedResponse(items.map(serializePerson), total, pagination, ctx);
});
