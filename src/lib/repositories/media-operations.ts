import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "listing-media";

export interface UnitMediaRecord {
  id: string;
  unitId: string;
  kind: string;
  url: string;
  caption: string | null;
  sortOrder: number;
  storageKey: string | null;
}

/**
 * Hämtar en mediapost och verifierar samtidigt att objektet tillhör
 * organisationen. Utan organisationskopplingen skulle ett gissat media-id
 * kunna raderas från en annan organisation.
 */
async function getOwnedMedia(input: {
  organizationId: string;
  mediaId: string;
}): Promise<UnitMediaRecord | null> {
  const admin = createAdminClient();
  const { data: media, error } = await admin
    .from("UnitMedia")
    .select("id,unitId,kind,url,caption,sortOrder,storageKey")
    .eq("id", input.mediaId)
    .maybeSingle();
  if (error) throw new Error(`Mediaposten kunde inte läsas (${error.code}).`);
  if (!media) return null;

  const { data: unit, error: unitError } = await admin
    .from("Unit")
    .select("id")
    .eq("id", media.unitId)
    .eq("organizationId", input.organizationId)
    .maybeSingle();
  if (unitError) throw new Error(`Objektet kunde inte verifieras (${unitError.code}).`);
  if (!unit) return null;

  return media as UnitMediaRecord;
}

export async function listUnitMedia(input: {
  organizationId: string;
  unitId: string;
}): Promise<UnitMediaRecord[]> {
  const admin = createAdminClient();
  const { data: unit, error: unitError } = await admin
    .from("Unit")
    .select("id")
    .eq("id", input.unitId)
    .eq("organizationId", input.organizationId)
    .maybeSingle();
  if (unitError) throw new Error(`Objektet kunde inte verifieras (${unitError.code}).`);
  if (!unit) return [];

  const { data, error } = await admin
    .from("UnitMedia")
    .select("id,unitId,kind,url,caption,sortOrder,storageKey")
    .eq("unitId", input.unitId)
    .order("sortOrder", { ascending: true })
    .limit(200);
  if (error) throw new Error(`Objektets media kunde inte läsas (${error.code}).`);
  return (data ?? []) as UnitMediaRecord[];
}

/**
 * Tar bort både databasposten och filen i Storage. Databasposten tas bort
 * först: en kvarlämnad fil utan post är ofarlig, medan en post som pekar på en
 * raderad fil ger en trasig bild i annonsen.
 */
export async function deleteUnitMedia(input: {
  organizationId: string;
  mediaId: string;
}): Promise<{ deleted: boolean; unitId?: string; storageRemoved: boolean }> {
  const media = await getOwnedMedia(input);
  if (!media) return { deleted: false, storageRemoved: false };

  const admin = createAdminClient();
  const { error } = await admin.from("UnitMedia").delete().eq("id", media.id);
  if (error) throw new Error(`Mediaposten kunde inte tas bort (${error.code}).`);

  let storageRemoved = false;
  if (media.storageKey) {
    const { error: storageError } = await admin.storage.from(BUCKET).remove([media.storageKey]);
    if (storageError) {
      console.error("FaddeBo listing media storage delete failed", {
        mediaId: media.id,
        message: storageError.message,
      });
    } else {
      storageRemoved = true;
    }
  }

  return { deleted: true, unitId: media.unitId, storageRemoved };
}

/**
 * Gör en bild till omslagsbild genom att flytta den först i sorteringen.
 * Övriga bilder skjuts ned ett steg så att ordningen förblir stabil.
 */
export async function setUnitMediaCover(input: {
  organizationId: string;
  mediaId: string;
}): Promise<{ updated: boolean; unitId?: string }> {
  const media = await getOwnedMedia(input);
  if (!media) return { updated: false };

  const admin = createAdminClient();
  const siblings = await listUnitMedia({ organizationId: input.organizationId, unitId: media.unitId });
  const ordered = [media, ...siblings.filter((item) => item.id !== media.id)];

  for (const [index, item] of ordered.entries()) {
    if (item.sortOrder === index) continue;
    const { error } = await admin.from("UnitMedia").update({ sortOrder: index }).eq("id", item.id);
    if (error) throw new Error(`Mediaordningen kunde inte uppdateras (${error.code}).`);
  }

  return { updated: true, unitId: media.unitId };
}
