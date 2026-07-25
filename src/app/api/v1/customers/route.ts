import { z } from "zod";
import {
  withApiAuth,
  parsePagination,
  paginatedResponse,
  withIdempotency,
} from "@/lib/api/helpers";
import { serializePerson } from "@/lib/api/serializers";
import { audit } from "@/lib/audit";
import {
  listApiCustomers,
  upsertApiCustomer,
} from "@/lib/repositories/external-api-records";

/**
 * GET /api/v1/customers – lista kunder (personer) med filtrering och sortering.
 * POST /api/v1/customers – skapa kund. Stöder Idempotency-Key.
 */

export const GET = withApiAuth("customers:read", async (req, ctx) => {
  const url = new URL(req.url);
  const pagination = parsePagination(req);
  const search = url.searchParams.get("search");
  const email = url.searchParams.get("email");
  const externalId = url.searchParams.get("external_id");
  const updatedSince = url.searchParams.get("updated_since");
  const sort = url.searchParams.get("sort") ?? "-created_at";

  const order =
    sort === "created_at" ? { column: "createdAt" as const, ascending: true }
    : sort === "last_name" ? { column: "lastName" as const, ascending: true }
    : { column: "createdAt" as const, ascending: false };

  const { items, total } = await listApiCustomers({
    organizationId: ctx.organizationId,
    email,
    search,
    externalId,
    updatedSince,
    order,
    skip: pagination.skip,
    take: pagination.take,
  });

  return paginatedResponse(items.map(serializePerson), total, pagination, ctx);
});

const createCustomerSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  is_company: z.boolean().optional(),
  company_name: z.string().max(200).optional(),
  address: z.string().max(200).optional(),
  postal_code: z.string().max(10).optional(),
  city: z.string().max(100).optional(),
  external_system: z.string().max(50).optional(),
  external_customer_id: z.string().max(100).optional(),
});

export const POST = withApiAuth("customers:write", async (req, ctx) => {
  const bodyText = await req.text();
  return withIdempotency(req, ctx, bodyText, async () => {
    const input = createCustomerSchema.parse(JSON.parse(bodyText));

    const { person, deduplicated } = await upsertApiCustomer({
      organizationId: ctx.organizationId,
      firstName: input.first_name,
      lastName: input.last_name,
      email: input.email,
      phone: input.phone,
      isCompany: input.is_company,
      companyName: input.company_name,
      address: input.address,
      postalCode: input.postal_code,
      city: input.city,
      externalSystem: input.external_system,
      externalCustomerId: input.external_customer_id,
    });

    await audit({
      organizationId: ctx.organizationId,
      actorType: "api_key",
      actorId: ctx.apiKey.id,
      action: deduplicated ? "match" : "create",
      entityType: "person",
      entityId: person.id,
      correlationId: ctx.correlationId,
    });

    return {
      status: deduplicated ? 200 : 201,
      body: { data: serializePerson(person), ...(deduplicated ? { deduplicated: true } : {}) },
    };
  });
});
