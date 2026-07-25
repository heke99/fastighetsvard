import {
  changeRentalListingStatus,
  completeRentalUnitListings,
} from "@/lib/repositories/rental-operations";
import {
  searchPublicListings,
  type PublicListingSearchParams,
} from "@/lib/repositories/public-catalog";
import type { ListingStatus } from "@/lib/database-types";

export type ListingSearchParams = PublicListingSearchParams;

export async function searchListings(params: ListingSearchParams) {
  return searchPublicListings(params);
}

/** Publicera/avpublicera med statusmaskin. Avpublicering sker automatiskt vid uthyrning/försäljning. */
export async function changeListingStatus(
  _organizationId: string,
  listingId: string,
  toStatus: ListingStatus,
  expectedStatus: ListingStatus
) {
  return changeRentalListingStatus({ listingId, expectedStatus, toStatus });
}

/** Avpublicera alla annonser för ett objekt (t.ex. när det hyrts ut eller sålts). */
export async function unpublishListingsForUnit(
  _organizationId: string,
  unitId: string,
  reason: string
) {
  return completeRentalUnitListings({ unitId, reason });
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
