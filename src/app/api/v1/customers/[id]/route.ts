import { z } from "zod";
import { withApiAuth, apiJson, parseBody } from "@/lib/api/helpers";
import { ApiError } from "@/lib/api/auth";
import { serializePerson } from "@/lib/api/serializers";
import { audit } from "@/lib/audit";
import {
  getApiCustomer,
  updateApiCustomer,
} from "@/lib/repositories/external-api-records";

export const GET = withApiAuth("customers:read", async (_req, ctx, params) => {
  const person = await getApiCustomer(ctx.organizationId, params.id);
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
  const person = await getApiCustomer(ctx.organizationId, params.id);
  if (!person) throw new ApiError(404, "not_found", "Kunden hittades inte.");

  const updated = await updateApiCustomer(ctx.organizationId, person.id, {
    firstName: input.first_name,
    lastName: input.last_name,
    email: input.email === undefined ? undefined : input.email?.toLowerCase() ?? null,
    phone: input.phone,
    address: input.address,
    postalCode: input.postal_code,
    city: input.city,
  });
  if (!updated) throw new ApiError(404, "not_found", "Kunden hittades inte.");

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
