import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  withApiAuth,
  parsePagination,
  paginatedResponse,
  withIdempotency,
} from "@/lib/api/helpers";
import { serializePerson } from "@/lib/api/serializers";
import { audit } from "@/lib/audit";
import type { Database } from "@/lib/database-types";

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

  const where: Database.PersonWhereInput = {
    organizationId: ctx.organizationId,
    ...(email ? { email: email.toLowerCase() } : {}),
    ...(search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(externalId
      ? { externalReferences: { some: { externalId, entityType: "customer" } } }
      : {}),
    ...(updatedSince ? { updatedAt: { gte: new Date(updatedSince) } } : {}),
  };

  const orderBy: Database.PersonOrderByWithRelationInput =
    sort === "created_at" ? { createdAt: "asc" }
    : sort === "-created_at" ? { createdAt: "desc" }
    : sort === "last_name" ? { lastName: "asc" }
    : { createdAt: "desc" };

  const [items, total] = await Promise.all([
    db.person.findMany({
      where,
      include: { externalReferences: { where: { entityType: "customer" } } },
      orderBy,
      skip: pagination.skip,
      take: pagination.take,
    }),
    db.person.count({ where }),
  ]);

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

    // Dubblettskydd: samma externa referens eller e-post återanvänder person.
    if (input.external_system && input.external_customer_id) {
      const existingRef = await db.externalReference.findUnique({
        where: {
          organizationId_externalSystem_entityType_externalId: {
            organizationId: ctx.organizationId,
            externalSystem: input.external_system,
            entityType: "customer",
            externalId: input.external_customer_id,
          },
        },
        include: { person: { include: { externalReferences: true } } },
      });
      if (existingRef?.person) {
        return { status: 200, body: { data: serializePerson(existingRef.person), deduplicated: true } };
      }
    }
    if (input.email) {
      const existing = await db.person.findFirst({
        where: { organizationId: ctx.organizationId, email: input.email.toLowerCase() },
        include: { externalReferences: true },
      });
      if (existing) {
        if (input.external_system && input.external_customer_id) {
          await db.externalReference.upsert({
            where: {
              organizationId_externalSystem_entityType_externalId: {
                organizationId: ctx.organizationId,
                externalSystem: input.external_system,
                entityType: "customer",
                externalId: input.external_customer_id,
              },
            },
            create: {
              organizationId: ctx.organizationId,
              externalSystem: input.external_system,
              entityType: "customer",
              externalId: input.external_customer_id,
              personId: existing.id,
            },
            update: { personId: existing.id },
          });
        }
        return { status: 200, body: { data: serializePerson(existing), deduplicated: true } };
      }
    }

    const person = await db.person.create({
      data: {
        organizationId: ctx.organizationId,
        firstName: input.first_name,
        lastName: input.last_name,
        email: input.email?.toLowerCase() ?? null,
        phone: input.phone ?? null,
        isCompany: input.is_company ?? false,
        companyName: input.company_name ?? null,
        address: input.address ?? null,
        postalCode: input.postal_code ?? null,
        city: input.city ?? null,
        ...(input.external_system && input.external_customer_id
          ? {
              externalReferences: {
                create: [
                  {
                    organizationId: ctx.organizationId,
                    externalSystem: input.external_system,
                    entityType: "customer",
                    externalId: input.external_customer_id,
                  },
                ],
              },
            }
          : {}),
      },
      include: { externalReferences: true },
    });

    await audit({
      organizationId: ctx.organizationId,
      actorType: "api_key",
      actorId: ctx.apiKey.id,
      action: "create",
      entityType: "person",
      entityId: person.id,
      correlationId: ctx.correlationId,
    });

    return { status: 201, body: { data: serializePerson(person) } };
  });
});
