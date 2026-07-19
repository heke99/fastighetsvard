"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { createMaintenanceRequest } from "@/lib/services/maintenance";

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
    // Behörighetskontroll: endast objekt personen har avtal på.
    const contract = await prisma.contract.findFirst({
      where: {
        unitId: data.unitId,
        organizationId: user.organizationId,
        parties: { some: { personId: user.personId, role: { in: ["TENANT", "CO_TENANT"] } } },
      },
      include: { unit: { select: { propertyId: true } } },
    });
    if (!contract) {
      return {
        status: "error",
        message: "Du kan bara göra felanmälan för objekt du hyr.",
        fieldErrors: { unitId: "Ogiltigt objekt." },
      };
    }
    unitId = data.unitId;
    propertyId = contract.unit.propertyId;
  }

  try {
    await createMaintenanceRequest(
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
  redirect("/mina-sidor/felanmalan");
}
