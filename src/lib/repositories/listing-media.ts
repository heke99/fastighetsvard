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

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

/**
 * Ändelsen härleds ur den verifierade bildtypen, aldrig ur filnamnet. Ett
 * uppladdat `bild.php.jpg` får därmed alltid en säker nyckel i Storage.
 */
function extensionFor(mimeType: string): string {
  return EXTENSION_BY_MIME[mimeType] ?? "bin";
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/**
 * Bestämmer bildtypen ur filens innehåll. `File.type` sätts av webbläsaren och
 * kan förfalskas, så den används bara som en första gallring i klienten.
 */
export function detectImageMimeType(bytes: Uint8Array): string | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  if (startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4)) {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    if (brand === "avif" || brand === "avis") return "image/avif";
  }
  return null;
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

/** Bildtexten visas publikt. Originalfilnamnet städas från sökväg och ändelse. */
function sanitizeCaption(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  return base.replace(/\.[a-z0-9]+$/i, "").slice(0, 120) || "Bild";
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
    const buffer = Buffer.from(await file.arrayBuffer());
    const detectedType = detectImageMimeType(buffer);
    if (!detectedType || !ALLOWED_MIME_TYPES.has(detectedType)) {
      failed.push(file.name);
      continue;
    }

    const storageKey = `${input.organizationId}/${input.unitId}/${kind.toLowerCase()}/${randomUUID()}.${extensionFor(detectedType)}`;
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(storageKey, buffer, { contentType: detectedType, upsert: false });
    if (uploadError) {
      failed.push(file.name);
      continue;
    }

    const { data: publicUrl } = admin.storage.from(BUCKET).getPublicUrl(storageKey);
    const { error: mediaError } = await admin.from("UnitMedia").insert({
      unitId: input.unitId,
      kind,
      url: publicUrl.publicUrl,
      storageKey,
      caption: sanitizeCaption(file.name),
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
