import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "listing-media";
const MAX_FILES = 12;
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

export type ListingMediaKind = "IMAGE" | "FLOORPLAN";

export interface ListingMediaUpload {
  file: File;
  kind: ListingMediaKind;
}

function isFile(value: FormDataEntryValue): value is File {
  return typeof value !== "string" && typeof value.arrayBuffer === "function";
}

function extensionFor(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (fromName && fromName.length <= 8) return fromName;
  return file.type.split("/")[1] || "bin";
}

function readFiles(formData: FormData, name: string, kind: ListingMediaKind): ListingMediaUpload[] {
  return formData
    .getAll(name)
    .filter(isFile)
    .filter((file) => file.size > 0)
    .map((file) => ({ file, kind }));
}

export function readListingMedia(formData: FormData): ListingMediaUpload[] {
  return [
    ...readFiles(formData, "images", "IMAGE"),
    ...readFiles(formData, "floorplans", "FLOORPLAN"),
  ];
}

export function validateListingMedia(media: ListingMediaUpload[]): string | null {
  if (media.length > MAX_FILES) return `Du kan ladda upp högst ${MAX_FILES} filer per gång.`;
  for (const { file } of media) {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return `Filtypen för ${file.name} stöds inte. Tillåtna format är JPG, PNG, WebP och AVIF.`;
    }
    if (file.size > MAX_FILE_SIZE) return `${file.name} är större än 15 MB.`;
  }
  return null;
}

export async function getOwnedListingForMedia(input: {
  organizationId: string;
  listingId: string;
  unitId: string;
}): Promise<{ id: string; slug: string; unitId: string } | null> {
  const { data, error } = await createAdminClient()
    .from("Listing")
    .select("id,slug,unitId")
    .eq("id", input.listingId)
    .eq("unitId", input.unitId)
    .eq("organizationId", input.organizationId)
    .maybeSingle();
  if (error) throw new Error(`Annonsen kunde inte verifieras (${error.code}).`);
  return data;
}

export async function uploadListingMedia(input: {
  organizationId: string;
  unitId: string;
  media: ListingMediaUpload[];
}): Promise<{ uploaded: number; failed: string[] }> {
  if (input.media.length === 0) return { uploaded: 0, failed: [] };

  const admin = createAdminClient();
  const { data: unit, error: unitError } = await admin
    .from("Unit")
    .select("id")
    .eq("id", input.unitId)
    .eq("organizationId", input.organizationId)
    .maybeSingle();
  if (unitError || !unit) throw new Error("Objektet kunde inte verifieras för mediauppladdning.");

  const { data: lastMedia, error: orderError } = await admin
    .from("UnitMedia")
    .select("sortOrder")
    .eq("unitId", input.unitId)
    .order("sortOrder", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (orderError) throw new Error(`Objektets mediaordning kunde inte läsas (${orderError.code}).`);

  let sortOrder = Number(lastMedia?.sortOrder ?? -1) + 1;
  let uploaded = 0;
  const failed: string[] = [];

  for (const { file, kind } of input.media) {
    const storageKey = `${input.organizationId}/${input.unitId}/${kind.toLowerCase()}/${randomUUID()}.${extensionFor(file)}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(storageKey, buffer, { contentType: file.type, upsert: false });
    if (uploadError) {
      failed.push(file.name);
      continue;
    }

    const { data: publicUrl } = admin.storage.from(BUCKET).getPublicUrl(storageKey);
    const { error: mediaError } = await admin.from("UnitMedia").insert({
      unitId: input.unitId,
      kind,
      url: publicUrl.publicUrl,
      caption: file.name,
      sortOrder,
    });
    if (mediaError) {
      await admin.storage.from(BUCKET).remove([storageKey]);
      failed.push(file.name);
      continue;
    }

    sortOrder += 1;
    uploaded += 1;
  }

  return { uploaded, failed };
}
