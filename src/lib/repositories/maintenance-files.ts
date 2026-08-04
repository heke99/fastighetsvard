import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "maintenance-files";
const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

function extensionFor(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (fromName && fromName.length <= 8) return fromName;
  return file.type === "application/pdf" ? "pdf" : file.type.split("/")[1] || "bin";
}

function isFile(value: FormDataEntryValue): value is File {
  return typeof value !== "string" && typeof value.arrayBuffer === "function";
}

export function readMaintenanceFiles(formData: FormData): File[] {
  return formData
    .getAll("attachments")
    .filter(isFile)
    .filter((file) => file.size > 0);
}

export function validateMaintenanceFiles(files: File[]): string | null {
  if (files.length > MAX_FILES) return `Du kan bifoga högst ${MAX_FILES} filer.`;
  for (const file of files) {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return `Filtypen för ${file.name} stöds inte. Tillåtna format är JPG, PNG, WebP och PDF.`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `${file.name} är större än 10 MB.`;
    }
  }
  return null;
}

export async function uploadMaintenanceFiles(input: {
  organizationId: string;
  personId: string;
  requestId: string;
  propertyId?: string;
  unitId?: string;
  uploadedByUserId: string;
  files: File[];
}): Promise<{ uploaded: number; failed: string[] }> {
  const admin = createAdminClient();
  const failed: string[] = [];
  let uploaded = 0;

  const { data: request, error: requestError } = await admin
    .from("MaintenanceRequest")
    .select("id")
    .eq("id", input.requestId)
    .eq("organizationId", input.organizationId)
    .eq("personId", input.personId)
    .maybeSingle();
  if (requestError || !request) {
    throw new Error("Felanmälan kunde inte verifieras för bilageuppladdning.");
  }

  for (const file of input.files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const storageKey = `${input.organizationId}/${input.personId}/${input.requestId}/${randomUUID()}.${extensionFor(file)}`;
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(storageKey, buffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      failed.push(file.name);
      continue;
    }

    const { error: documentError } = await admin.from("Document").insert({
      organizationId: input.organizationId,
      type: "OTHER",
      title: `Bilaga till felanmälan: ${file.name}`,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      storageKey,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      personId: input.personId,
      unitId: input.unitId ?? null,
      propertyId: input.propertyId ?? null,
      maintenanceRequestId: input.requestId,
      uploadedByUserId: input.uploadedByUserId,
    });

    if (documentError) {
      await admin.storage.from(BUCKET).remove([storageKey]);
      failed.push(file.name);
      continue;
    }
    uploaded += 1;
  }

  return { uploaded, failed };
}

export async function signMaintenanceDocuments(
  documents: Array<Record<string, any>>,
  expiresInSeconds = 3600
): Promise<Array<Record<string, any>>> {
  const admin = createAdminClient();
  return Promise.all(
    documents.map(async (document) => {
      const { data, error } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(String(document.storageKey), expiresInSeconds);
      return {
        ...document,
        signedUrl: error ? null : data.signedUrl,
      };
    })
  );
}
