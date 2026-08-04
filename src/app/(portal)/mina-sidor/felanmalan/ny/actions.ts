"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createMaintenanceRequest } from "@/lib/services/maintenance";
import { getMyRentalUnit } from "@/lib/repositories/portal-records";
import {
  readMaintenanceFiles,
  uploadMaintenanceFiles,
  validateMaintenanceFiles,
} from "@/lib/repositories/maintenance-files";

export interface MaintenanceFormState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
}

const schema = z.object({
  unitId: z.string().min(1, "Välj var felet finns."),
  category: z.string().min(1, "Välj kategori."),
  room: z.string().optional(),
  title: z.string().min(3, "Ange en rubrik.").max(200),
  description: z.string().min(10, "Beskriv felet med minst 10 tecken."),
  discoveredAt: z.string().optional(),
  contactPhone: z.string().optional(),
  preferredTime: z.string().optional(),
  masterKeyAllowed: z.string().optional(),
  petsInHome: z.string().optional(),
  isEmergency: z.string().optional(),
});

export async function createMaintenanceAction(
  _prev: MaintenanceFormState,
  formData: FormData
): Promise<MaintenanceFormState> {
  const user = await getCurrentUser();
  if (!user?.personId || !user.organizationId) redirect("/logga-in");

  const attachments = readMaintenanceFiles(formData);
  const attachmentError = validateMaintenanceFiles(attachments);
  if (attachmentError) {
    return {
      status: "error",
      message: "Kontrollera bilagorna.",
      fieldErrors: { attachments: attachmentError },
    };
  }

  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] = issue.message;
    return { status: "error", message: "Kontrollera fälten nedan.", fieldErrors };
  }
  const data = parsed.data;

  let unitId: string | undefined;
  let propertyId: string | undefined;
  if (data.unitId !== "common") {
    const unit = await getMyRentalUnit(data.unitId);
    if (!unit) {
      return {
        status: "error",
        message: "Du kan bara göra felanmälan för objekt du hyr.",
        fieldErrors: { unitId: "Ogiltigt objekt." },
      };
    }
    unitId = data.unitId;
    propertyId = String(unit.propertyId);
  }

  let request: Record<string, any>;
  try {
    request = await createMaintenanceRequest(
      user.organizationId,
      {
        unitId,
        propertyId,
        personId: user.personId,
        category: data.category,
        room: data.room || undefined,
        title: data.title,
        description: data.description,
        discoveredAt: data.discoveredAt ? new Date(data.discoveredAt) : undefined,
        contactPhone: data.contactPhone || undefined,
        preferredTime: data.preferredTime || undefined,
        masterKeyAllowed: data.masterKeyAllowed === "1",
        petsInHome: data.petsInHome === "1",
        isEmergency: data.isEmergency === "1",
      },
      user.id
    );
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Kunde inte skapa felanmälan." };
  }

  let attachmentStatus = attachments.length > 0 ? "uploaded" : "none";
  if (attachments.length > 0) {
    try {
      const result = await uploadMaintenanceFiles({
        organizationId: user.organizationId,
        personId: user.personId,
        requestId: String(request.id),
        propertyId,
        unitId,
        uploadedByUserId: user.id,
        files: attachments,
      });
      if (result.failed.length > 0) attachmentStatus = result.uploaded > 0 ? "partial" : "failed";
    } catch (error) {
      console.error("FaddeBo maintenance attachment upload failed", error);
      attachmentStatus = "failed";
    }
  }

  redirect(`/mina-sidor/felanmalan?created=${encodeURIComponent(String(request.requestNumber))}&attachments=${attachmentStatus}`);
}
