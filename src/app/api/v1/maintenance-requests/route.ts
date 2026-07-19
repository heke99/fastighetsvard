import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  withApiAuth,
  parsePagination,
  paginatedResponse,
  withIdempotency,
} from "@/lib/api/helpers";
import { serializeMaintenanceRequest } from "@/lib/api/serializers";
import { createMaintenanceRequest } from "@/lib/services/maintenance";
import type { Prisma, MaintenanceStatus } from "@prisma/client";

export const GET = withApiAuth("maintenance:read", async (req, ctx) => {
  const url = new URL(req.url);
  const pagination = parsePagination(req);
  const status = url.searchParams.get("status");

  const where: Prisma.MaintenanceRequestWhereInput = {
    organizationId: ctx.organizationId,
    ...(status ? { status: status.toUpperCase() as MaintenanceStatus } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.maintenanceRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.maintenanceRequest.count({ where }),
  ]);

  return paginatedResponse(items.map(serializeMaintenanceRequest), total, pagination, ctx);
});

const createSchema = z.object({
  unit_id: z.string().optional(),
  property_id: z.string().optional(),
  category: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  is_emergency: z.boolean().optional(),
});

export const POST = withApiAuth("maintenance:write", async (req, ctx) => {
  const bodyText = await req.text();
  return withIdempotency(req, ctx, bodyText, async () => {
    const input = createSchema.parse(JSON.parse(bodyText));
    const request = await createMaintenanceRequest(ctx.organizationId, {
      unitId: input.unit_id,
      propertyId: input.property_id,
      category: input.category,
      title: input.title,
      description: input.description,
      priority: input.priority,
      isEmergency: input.is_emergency,
    });
    return { status: 201, body: { data: serializeMaintenanceRequest(request) } };
  });
});
