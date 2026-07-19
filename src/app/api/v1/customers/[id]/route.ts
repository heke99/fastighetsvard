import { z } from "zod";
import { prisma } from "@/lib/db";
import { withApiAuth, apiJson, parseBody } from "@/lib/api/helpers";
import { ApiError } from "@/lib/api/auth";
import { serializePerson } from "@/lib/api/serializers";
import { audit } from "@/lib/audit";

export const GET = withApiAuth("customers:read", async (_req, ctx, params) => {
  const person = await prisma.person.findFirst({
    where: { id: params.id, organizationId: ctx.organizationId },
    include: { externalReferences: { where: { entityType: "customer" } } },
  });
  if (!person) throw new ApiError(404, "not_found", "Kunden hittades inte.");
  return apiJson({ data: serializePerson(person) }, 200, ctx);
});

const patchSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  address: z.string().max(200).nullable().optional(),
  postal_code: z.string().max(10).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
});

export const PATCH = withApiAuth("customers:write", async (req, ctx, params) => {
  const input = await parseBody(req, patchSchema);
  const person = await prisma.person.findFirst({
    where: { id: params.id, organizationId: ctx.organizationId },
  });
  if (!person) throw new ApiError(404, "not_found", "Kunden hittades inte.");

  const updated = await prisma.person.update({
    where: { id: person.id },
    data: {
      firstName: input.first_name ?? undefined,
      lastName: input.last_name ?? undefined,
      email: input.email === undefined ? undefined : input.email?.toLowerCase() ?? null,
      phone: input.phone === undefined ? undefined : input.phone,
      address: input.address === undefined ? undefined : input.address,
      postalCode: input.postal_code === undefined ? undefined : input.postal_code,
      city: input.city === undefined ? undefined : input.city,
    },
    include: { externalReferences: true },
  });

  await audit({
    organizationId: ctx.organizationId,
    actorType: "api_key",
    actorId: ctx.apiKey.id,
    action: "update",
    entityType: "person",
    entityId: person.id,
    before: { email: person.email, phone: person.phone },
    after: input,
    correlationId: ctx.correlationId,
  });

  return apiJson({ data: serializePerson(updated) }, 200, ctx);
});
