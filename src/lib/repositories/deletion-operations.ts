import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { listUnitMedia } from "@/lib/repositories/media-operations";

const BUCKET = "listing-media";

/**
 * Radering i FaddeBo följer en enda regel: allt som är juridik eller historik
 * bevaras, utkast får försvinna.
 *
 * - Annons: raderas bara som utkast utan ansökningar, visningar eller
 *   erbjudanden. Publicerade annonser avpubliceras i stället.
 * - Objekt: raderas bara utan avtalshistorik, felanmälningar och fakturor.
 * - Fastighet: raderas bara utan objekt och byggnader.
 *
 * `Property -> Unit -> Contract` är kopplade med ON DELETE CASCADE i schemat.
 * Kontrollerna här ger ett begripligt svar innan raderingen försöks, och
 * databasens triggers stoppar den oavsett väg in.
 */
export interface DeletionBlocker {
  label: string;
  count: number;
}

export interface DeletionResult {
  deleted: boolean;
  blockers: DeletionBlocker[];
}

async function countRows(table: string, column: string, value: string): Promise<number> {
  const { count, error } = await createAdminClient()
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, value);
  if (error) throw new Error(`Beroenden kunde inte kontrolleras (${error.code}).`);
  return count ?? 0;
}

async function blockersFor(entries: Array<[string, Promise<number>]>): Promise<DeletionBlocker[]> {
  const counts = await Promise.all(entries.map(([, promise]) => promise));
  return entries
    .map(([label], index) => ({ label, count: counts[index] }))
    .filter((blocker) => blocker.count > 0);
}

async function assertOwned(table: string, id: string, organizationId: string): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from(table)
    .select("id")
    .eq("id", id)
    .eq("organizationId", organizationId)
    .maybeSingle();
  if (error) throw new Error(`Objektet kunde inte verifieras (${error.code}).`);
  return Boolean(data);
}

export async function deleteDraftListing(input: {
  organizationId: string;
  listingId: string;
}): Promise<DeletionResult & { notFound?: boolean }> {
  const admin = createAdminClient();
  const { data: listing, error } = await admin
    .from("Listing")
    .select("id,status,title")
    .eq("id", input.listingId)
    .eq("organizationId", input.organizationId)
    .maybeSingle();
  if (error) throw new Error(`Annonsen kunde inte läsas (${error.code}).`);
  if (!listing) return { deleted: false, blockers: [], notFound: true };

  const blockers = await blockersFor([
    ["ansökningar", countRows("Application", "listingId", input.listingId)],
    ["visningar", countRows("Viewing", "listingId", input.listingId)],
    ["erbjudanden", countRows("Offer", "listingId", input.listingId)],
    ["reservationer", countRows("Reservation", "listingId", input.listingId)],
  ]);

  if (listing.status !== "DRAFT") {
    blockers.unshift({ label: "publicerad eller tidigare publicerad annons", count: 1 });
  }
  if (blockers.length > 0) return { deleted: false, blockers };

  const { error: deleteError } = await admin.from("Listing").delete().eq("id", input.listingId);
  if (deleteError) throw new Error(`Annonsen kunde inte tas bort (${deleteError.code}).`);
  return { deleted: true, blockers: [] };
}

export async function deleteUnit(input: {
  organizationId: string;
  unitId: string;
}): Promise<DeletionResult & { notFound?: boolean }> {
  if (!(await assertOwned("Unit", input.unitId, input.organizationId))) {
    return { deleted: false, blockers: [], notFound: true };
  }

  const blockers = await blockersFor([
    ["avtal", countRows("Contract", "unitId", input.unitId)],
    ["annonser", countRows("Listing", "unitId", input.unitId)],
    ["felanmälningar", countRows("MaintenanceRequest", "unitId", input.unitId)],
    ["fakturor", countRows("Invoice", "unitId", input.unitId)],
    ["besiktningar", countRows("Inspection", "unitId", input.unitId)],
    ["inflyttningsärenden", countRows("MoveInCase", "unitId", input.unitId)],
    ["avflyttningsärenden", countRows("MoveOutCase", "unitId", input.unitId)],
    ["reservationer", countRows("Reservation", "unitId", input.unitId)],
  ]);
  if (blockers.length > 0) return { deleted: false, blockers };

  // Mediaposterna kaskaderas bort med objektet, men filerna i Storage måste
  // städas explicit för att inte lämna föräldralösa objekt kvar i bucketen.
  const media = await listUnitMedia({ organizationId: input.organizationId, unitId: input.unitId });
  const admin = createAdminClient();
  const { error } = await admin.from("Unit").delete().eq("id", input.unitId);
  if (error) throw new Error(`Objektet kunde inte tas bort (${error.code}).`);

  const storageKeys = media.map((item) => item.storageKey).filter((key): key is string => Boolean(key));
  if (storageKeys.length > 0) {
    const { error: storageError } = await admin.storage.from(BUCKET).remove(storageKeys);
    if (storageError) {
      console.error("FaddeBo unit media cleanup failed", {
        unitId: input.unitId,
        message: storageError.message,
      });
    }
  }

  return { deleted: true, blockers: [] };
}

export async function deleteProperty(input: {
  organizationId: string;
  propertyId: string;
}): Promise<DeletionResult & { notFound?: boolean }> {
  if (!(await assertOwned("Property", input.propertyId, input.organizationId))) {
    return { deleted: false, blockers: [], notFound: true };
  }

  const blockers = await blockersFor([
    ["objekt", countRows("Unit", "propertyId", input.propertyId)],
    ["byggnader", countRows("Building", "propertyId", input.propertyId)],
    ["felanmälningar", countRows("MaintenanceRequest", "propertyId", input.propertyId)],
  ]);
  if (blockers.length > 0) return { deleted: false, blockers };

  const { error } = await createAdminClient().from("Property").delete().eq("id", input.propertyId);
  if (error) throw new Error(`Fastigheten kunde inte tas bort (${error.code}).`);
  return { deleted: true, blockers: [] };
}

export function describeBlockers(blockers: DeletionBlocker[]): string {
  return blockers
    .map((blocker) => (blocker.count > 1 ? `${blocker.count} ${blocker.label}` : blocker.label))
    .join(", ");
}
