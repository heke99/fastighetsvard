import { prisma } from "@/lib/db";
import { withApiAuth, parsePagination, paginatedResponse } from "@/lib/api/helpers";
import { serializePerson } from "@/lib/api/serializers";
import type { Prisma } from "@prisma/client";

/** GET /api/v1/tenants – personer med rollen TENANT. */
export const GET = withApiAuth("tenants:read", async (req, ctx) => {
  const url = new URL(req.url);
  const pagination = parsePagination(req);
  const activeOnly = url.searchParams.get("active") === "true";

  const where: Prisma.PersonWhereInput = {
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
    prisma.person.findMany({
      where,
      include: { externalReferences: { where: { entityType: "customer" } } },
      orderBy: { lastName: "asc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.person.count({ where }),
  ]);

  return paginatedResponse(items.map(serializePerson), total, pagination, ctx);
});
