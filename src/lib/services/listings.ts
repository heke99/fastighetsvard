import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertTransition, listingTransitions } from "@/lib/state-machines";
import { dispatchEvent } from "@/lib/services/webhooks";
import type { ListingStatus, Prisma, ListingCategory, UnitType } from "@prisma/client";

export interface ListingSearchParams {
  q?: string; // fritext: ort, område, adress
  category?: ListingCategory;
  type?: UnitType;
  city?: string;
  area?: string;
  rentMin?: number;
  rentMax?: number;
  priceMin?: number;
  priceMax?: number;
  roomsMin?: number;
  livingAreaMin?: number;
  moveInBefore?: Date;
  floorMin?: number;
  elevator?: boolean;
  balcony?: boolean;
  patio?: boolean;
  furnished?: boolean;
  accessible?: boolean;
  pets?: boolean;
  parking?: boolean;
  storage?: boolean;
  shortTerm?: boolean;
  student?: boolean;
  senior?: boolean;
  sort?: "latest" | "rent_asc" | "rent_desc" | "price_asc" | "price_desc" | "area_desc" | "move_in";
  page?: number;
  perPage?: number;
}

export function buildListingWhere(params: ListingSearchParams): Prisma.ListingWhereInput {
  const unitWhere: Prisma.UnitWhereInput = {
    ...(params.type ? { type: params.type } : {}),
    ...(params.city ? { city: { equals: params.city, mode: "insensitive" } } : {}),
    ...(params.area ? { area: { contains: params.area, mode: "insensitive" } } : {}),
    ...(params.roomsMin ? { rooms: { gte: params.roomsMin } } : {}),
    ...(params.livingAreaMin ? { livingArea: { gte: params.livingAreaMin } } : {}),
    ...(params.floorMin !== undefined ? { floorLevel: { gte: params.floorMin } } : {}),
    ...(params.elevator ? { hasElevator: true } : {}),
    ...(params.balcony ? { hasBalcony: true } : {}),
    ...(params.patio ? { hasPatio: true } : {}),
    ...(params.furnished ? { furnished: true } : {}),
    ...(params.accessible ? { accessible: true } : {}),
    ...(params.pets ? { petsAllowed: true } : {}),
    ...(params.parking ? { hasParking: true } : {}),
    ...(params.storage ? { hasStorage: true } : {}),
    ...(params.shortTerm ? { shortTermAllowed: true } : {}),
    ...(params.student ? { studentHousing: true } : {}),
    ...(params.senior ? { seniorHousing: true } : {}),
  };

  return {
    status: "PUBLISHED",
    ...(params.category ? { category: params.category } : {}),
    ...(params.rentMin || params.rentMax
      ? {
          rent: {
            ...(params.rentMin ? { gte: params.rentMin } : {}),
            ...(params.rentMax ? { lte: params.rentMax } : {}),
          },
        }
      : {}),
    ...(params.priceMin || params.priceMax
      ? {
          price: {
            ...(params.priceMin ? { gte: params.priceMin } : {}),
            ...(params.priceMax ? { lte: params.priceMax } : {}),
          },
        }
      : {}),
    ...(params.moveInBefore ? { moveInDate: { lte: params.moveInBefore } } : {}),
    ...(params.q
      ? {
          OR: [
            { title: { contains: params.q, mode: "insensitive" } },
            { unit: { city: { contains: params.q, mode: "insensitive" } } },
            { unit: { area: { contains: params.q, mode: "insensitive" } } },
            { unit: { address: { contains: params.q, mode: "insensitive" } } },
          ],
        }
      : {}),
    unit: unitWhere,
  };
}

export function buildListingOrderBy(
  sort?: ListingSearchParams["sort"]
): Prisma.ListingOrderByWithRelationInput[] {
  switch (sort) {
    case "rent_asc": return [{ rent: "asc" }, { publishedAt: "desc" }];
    case "rent_desc": return [{ rent: "desc" }, { publishedAt: "desc" }];
    case "price_asc": return [{ price: "asc" }, { publishedAt: "desc" }];
    case "price_desc": return [{ price: "desc" }, { publishedAt: "desc" }];
    case "area_desc": return [{ unit: { livingArea: "desc" } }];
    case "move_in": return [{ moveInDate: "asc" }];
    default: return [{ publishedAt: "desc" }];
  }
}

export async function searchListings(params: ListingSearchParams) {
  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.min(48, params.perPage ?? 12);
  const where = buildListingWhere(params);
  const [items, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      include: {
        unit: { include: { media: { where: { kind: "IMAGE" }, orderBy: { sortOrder: "asc" }, take: 1 } } },
      },
      orderBy: buildListingOrderBy(params.sort),
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.listing.count({ where }),
  ]);
  return { items, total, page, perPage, totalPages: Math.ceil(total / perPage) };
}

/** Publicera/avpublicera med statusmaskin. Avpublicering sker automatiskt vid uthyrning/försäljning. */
export async function changeListingStatus(
  organizationId: string,
  listingId: string,
  toStatus: ListingStatus,
  actorUserId?: string
) {
  const result = await prisma.$transaction(async (tx) => {
    const listing = await tx.listing.findFirst({ where: { id: listingId, organizationId } });
    if (!listing) throw new Error("Annonsen hittades inte.");
    assertTransition("listing", listingTransitions, listing.status, toStatus);

    const updated = await tx.listing.update({
      where: { id: listingId },
      data: {
        status: toStatus,
        publishedAt: toStatus === "PUBLISHED" && !listing.publishedAt ? new Date() : listing.publishedAt,
        unpublishedAt: toStatus === "UNPUBLISHED" ? new Date() : listing.unpublishedAt,
        completedAt: toStatus === "COMPLETED" ? new Date() : listing.completedAt,
      },
    });
    if (toStatus === "PUBLISHED") {
      await tx.unit.update({ where: { id: listing.unitId }, data: { status: "PUBLISHED" } });
      await tx.listingPublication.create({
        data: { listingId, channel: "web", publishedAt: new Date() },
      });
    }
    await audit(
      {
        organizationId,
        userId: actorUserId,
        action: "status_change",
        entityType: "listing",
        entityId: listingId,
        before: { status: listing.status },
        after: { status: toStatus },
      },
      tx
    );
    return updated;
  });

  if (toStatus === "PUBLISHED") {
    await dispatchEvent(organizationId, "listing.published", {
      listingId,
      slug: result.slug,
      title: result.title,
    });
  }
  return result;
}

/** Avpublicera alla annonser för ett objekt (t.ex. när det hyrts ut eller sålts). */
export async function unpublishListingsForUnit(
  organizationId: string,
  unitId: string,
  reason: string
) {
  const active = await prisma.listing.findMany({
    where: { organizationId, unitId, status: { in: ["PUBLISHED", "PAUSED", "SCHEDULED"] } },
  });
  for (const listing of active) {
    await prisma.$transaction(async (tx) => {
      await tx.listing.update({
        where: { id: listing.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      await tx.listingPublication.updateMany({
        where: { listingId: listing.id, unpublishedAt: null },
        data: { unpublishedAt: new Date() },
      });
      await audit(
        {
          organizationId,
          actorType: "system",
          action: "listing_auto_unpublished",
          entityType: "listing",
          entityId: listing.id,
          after: { reason },
        },
        tx
      );
    });
  }
  return active.length;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/å|ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/é/g, "e")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
