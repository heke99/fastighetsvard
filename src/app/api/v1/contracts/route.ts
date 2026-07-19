import { prisma } from "@/lib/db";
import { withApiAuth, parsePagination, paginatedResponse } from "@/lib/api/helpers";
import { serializeContract } from "@/lib/api/serializers";
import type { Prisma, ContractStatus } from "@prisma/client";

export const GET = withApiAuth("contracts:read", async (req, ctx) => {
  const url = new URL(req.url);
  const pagination = parsePagination(req);
  const status = url.searchParams.get("status");
  const unitId = url.searchParams.get("unit_id");
  const personId = url.searchParams.get("person_id");

  const where: Prisma.ContractWhereInput = {
    organizationId: ctx.organizationId,
    ...(status ? { status: status.toUpperCase() as ContractStatus } : {}),
    ...(unitId ? { unitId } : {}),
    ...(personId ? { parties: { some: { personId } } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.contract.findMany({
      where,
      include: { externalReferences: true },
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.contract.count({ where }),
  ]);

  return paginatedResponse(items.map(serializeContract), total, pagination, ctx);
});
