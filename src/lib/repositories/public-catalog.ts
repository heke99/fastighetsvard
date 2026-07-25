import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import type { ListingCategory, UnitType } from "@/lib/database-types";
import { getBranding } from "@/lib/branding";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const LISTING_COLUMNS = [
  "id", "slug", "title", "description", "category", "publishedAt",
  "applicationDeadline", "moveInDate", "rent", "price", "contactName",
  "contactEmail", "contactPhone", "seoTitle", "seoDescription", "featured",
  "unitId", "unitNumber", "apartmentNumber", "unitType", "address",
  "postalCode", "city", "area", "floorLevel", "rooms", "livingArea",
  "secondaryArea", "unitRent", "unitPrice", "operatingCost", "deposit",
  "availableFrom", "noticePeriodMonths", "hasElevator", "hasBalcony",
  "hasPatio", "hasStorage", "hasParking", "furnished", "accessible",
  "petsAllowed", "internetIncluded", "tvIncluded", "heatingIncluded",
  "waterIncluded", "electricityIncluded", "shortTermAllowed",
  "seniorHousing", "studentHousing", "propertyName", "energyClass",
  "yearBuilt", "media", "viewings",
].join(",");

export interface PublicListingSearchParams {
  q?: string;
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
  featured?: boolean;
  sort?: "latest" | "rent_asc" | "rent_desc" | "price_asc" | "price_desc" | "area_desc" | "move_in";
  page?: number;
  perPage?: number;
}

function fail(operation: string, error: PostgrestError): never {
  throw new Error(`${operation} misslyckades (${error.code}).`);
}

function brandSlug(): string {
  return getBranding().brandSlug;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function array(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    : [];
}

function mapListing(row: Record<string, unknown>): Record<string, any> {
  const media = array(row.media);
  const viewings = array(row.viewings).slice(0, 5);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category,
    status: "PUBLISHED",
    publishedAt: row.publishedAt,
    applicationDeadline: row.applicationDeadline,
    moveInDate: row.moveInDate,
    rent: row.rent,
    price: row.price,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    featured: row.featured,
    viewings,
    unit: {
      id: row.unitId,
      unitNumber: row.unitNumber,
      apartmentNumber: row.apartmentNumber,
      type: row.unitType,
      address: row.address,
      postalCode: row.postalCode,
      city: row.city,
      area: row.area,
      floorLevel: row.floorLevel,
      rooms: row.rooms,
      livingArea: row.livingArea,
      secondaryArea: row.secondaryArea,
      rent: row.unitRent,
      price: row.unitPrice,
      operatingCost: row.operatingCost,
      deposit: row.deposit,
      availableFrom: row.availableFrom,
      noticePeriodMonths: row.noticePeriodMonths,
      hasElevator: row.hasElevator,
      hasBalcony: row.hasBalcony,
      hasPatio: row.hasPatio,
      hasStorage: row.hasStorage,
      hasParking: row.hasParking,
      furnished: row.furnished,
      accessible: row.accessible,
      petsAllowed: row.petsAllowed,
      internetIncluded: row.internetIncluded,
      tvIncluded: row.tvIncluded,
      heatingIncluded: row.heatingIncluded,
      waterIncluded: row.waterIncluded,
      electricityIncluded: row.electricityIncluded,
      shortTermAllowed: row.shortTermAllowed,
      seniorHousing: row.seniorHousing,
      studentHousing: row.studentHousing,
      media,
      property: {
        name: row.propertyName,
        energyClass: row.energyClass,
        yearBuilt: row.yearBuilt,
      },
    },
  };
}

export async function searchPublicListings(params: PublicListingSearchParams) {
  const supabase = await createServerSupabaseClient();
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const perPage = Math.min(48, Math.max(1, Math.floor(params.perPage ?? 12)));
  let query = supabase
    .from("published_listing_catalog")
    .select(LISTING_COLUMNS, { count: "exact" })
    .eq("brandSlug", brandSlug());

  if (params.category) query = query.eq("category", params.category);
  if (params.type) query = query.eq("unitType", params.type);
  if (params.city) query = query.ilike("city", escapeLike(params.city));
  if (params.area) query = query.ilike("area", `%${escapeLike(params.area)}%`);
  if (params.rentMin !== undefined) query = query.gte("rent", params.rentMin);
  if (params.rentMax !== undefined) query = query.lte("rent", params.rentMax);
  if (params.priceMin !== undefined) query = query.gte("price", params.priceMin);
  if (params.priceMax !== undefined) query = query.lte("price", params.priceMax);
  if (params.roomsMin !== undefined) query = query.gte("rooms", params.roomsMin);
  if (params.livingAreaMin !== undefined) query = query.gte("livingArea", params.livingAreaMin);
  if (params.floorMin !== undefined) query = query.gte("floorLevel", params.floorMin);
  if (params.moveInBefore) query = query.lte("moveInDate", params.moveInBefore.toISOString());
  if (params.elevator) query = query.eq("hasElevator", true);
  if (params.balcony) query = query.eq("hasBalcony", true);
  if (params.patio) query = query.eq("hasPatio", true);
  if (params.furnished) query = query.eq("furnished", true);
  if (params.accessible) query = query.eq("accessible", true);
  if (params.pets) query = query.eq("petsAllowed", true);
  if (params.parking) query = query.eq("hasParking", true);
  if (params.storage) query = query.eq("hasStorage", true);
  if (params.shortTerm) query = query.eq("shortTermAllowed", true);
  if (params.student) query = query.eq("studentHousing", true);
  if (params.senior) query = query.eq("seniorHousing", true);
  if (params.featured !== undefined) query = query.eq("featured", params.featured);
  if (params.q) query = query.ilike("searchText", `%${escapeLike(params.q)}%`);

  switch (params.sort) {
    case "rent_asc": query = query.order("rent", { ascending: true, nullsFirst: false }); break;
    case "rent_desc": query = query.order("rent", { ascending: false, nullsFirst: false }); break;
    case "price_asc": query = query.order("price", { ascending: true, nullsFirst: false }); break;
    case "price_desc": query = query.order("price", { ascending: false, nullsFirst: false }); break;
    case "area_desc": query = query.order("livingArea", { ascending: false, nullsFirst: false }); break;
    case "move_in": query = query.order("moveInDate", { ascending: true, nullsFirst: false }); break;
    default: query = query.order("publishedAt", { ascending: false, nullsFirst: false });
  }

  query = query
    .order("id", { ascending: true })
    .range((page - 1) * perPage, page * perPage - 1);

  const { data, error, count } = await query;
  if (error) fail("Publik annonssökning", error);
  const total = count ?? 0;
  return {
    items: (data ?? []).map((row) => mapListing(row as unknown as Record<string, unknown>)),
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}

export async function getPublicListingBySlug(slug: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("published_listing_catalog")
    .select(LISTING_COLUMNS)
    .eq("brandSlug", brandSlug())
    .eq("slug", slug)
    .maybeSingle();
  if (error) fail("Publik annonsläsning", error);
  return data ? mapListing(data as unknown as Record<string, unknown>) : null;
}

export async function listPublishedCities(category?: ListingCategory) {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("published_listing_cities")
    .select("city")
    .eq("brandSlug", brandSlug())
    .order("city", { ascending: true });
  if (category) query = query.eq("category", category);
  const { data, error } = await query;
  if (error) fail("Publika annonsorter", error);
  return (data ?? []).map((row) => String(row.city));
}

export async function listUpcomingUnits(limit = 4) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("upcoming_unit_catalog")
    .select("id,unitNumber,unitType,address,postalCode,city,area,rooms,livingArea,availableFrom")
    .eq("brandSlug", brandSlug())
    .order("availableFrom", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true })
    .limit(Math.min(12, Math.max(1, limit)));
  if (error) fail("Kommande objekt", error);
  return data ?? [];
}

export async function listPublicProperties() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("public_property_catalog")
    .select("id,name,address,postalCode,city,municipality,yearBuilt,yearRenovated,energyClass,status,unitCount")
    .eq("brandSlug", brandSlug())
    .order("city", { ascending: true })
    .order("name", { ascending: true });
  if (error) fail("Publikt fastighetsbestånd", error);
  return data ?? [];
}

export async function listFavoriteListingIds(personId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("Favorite")
    .select("listingId")
    .eq("personId", personId)
    .order("listingId", { ascending: true });
  if (error) fail("Favoriter", error);
  return new Set<string>((data ?? []).map((row) => String(row.listingId)));
}

export async function listFavoritePublicListings(personId: string) {
  const favoriteIds = await listFavoriteListingIds(personId);
  if (favoriteIds.size === 0) return [];

  const supabase = await createServerSupabaseClient();
  const ids = [...favoriteIds];
  const { data, error } = await supabase
    .from("published_listing_catalog")
    .select(LISTING_COLUMNS)
    .eq("brandSlug", brandSlug())
    .in("id", ids);
  if (error) fail("Favoritannonser", error);
  const byId = new Map(
    (data ?? []).map((row) => {
      const listing = mapListing(row as unknown as Record<string, unknown>);
      return [String(listing.id), listing] as const;
    })
  );
  return ids.map((id) => byId.get(id)).filter((listing): listing is Record<string, any> => Boolean(listing));
}

export async function isFavoriteListing(personId: string, listingId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("Favorite")
    .select("id")
    .eq("personId", personId)
    .eq("listingId", listingId)
    .limit(1)
    .maybeSingle();
  if (error) fail("Favoritstatus", error);
  return Boolean(data);
}

export async function getCurrentActiveTenancy() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("current_active_tenancy_summary");
  if (error) fail("Aktivt hyresförhållande", error);
  return Array.isArray(data) && data.length > 0 ? data[0] as { address: string; city: string } : null;
}

export async function hasCurrentActiveApplication(listingId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("current_person_has_active_application", {
    p_listing_id: listingId,
  });
  if (error) fail("Aktiv ansökan", error);
  return data === true;
}
