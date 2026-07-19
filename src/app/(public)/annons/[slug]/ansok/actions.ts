"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { submitApplication } from "@/lib/services/applications";

export interface ApplicationFormState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
}

const schema = z.object({
  listingId: z.string().min(1),
  slug: z.string().min(1),
  desiredMoveInDate: z.string().optional(),
  isInternalTransfer: z.string().optional(),
  currentHousing: z.string().optional(),
  currentLandlord: z.string().optional(),
  employment: z.string().min(1, "Ange din sysselsättning."),
  employer: z.string().optional(),
  employmentType: z.string().optional(),
  monthlyIncome: z.string().min(1, "Ange din månadsinkomst."),
  otherIncome: z.string().optional(),
  references: z.string().optional(),
  pets: z.string().optional(),
  vehicles: z.string().optional(),
  specialNeeds: z.string().optional(),
  message: z.string().optional(),
  consent: z.literal("1", { errorMap: () => ({ message: "Du måste samtycka för att skicka ansökan." }) }),
});

export async function submitApplicationAction(
  _prev: ApplicationFormState,
  formData: FormData
): Promise<ApplicationFormState> {
  const user = await getCurrentUser();
  if (!user?.personId || !user.organizationId) {
    redirect("/logga-in");
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join(".")] = issue.message;
    }
    return { status: "error", message: "Kontrollera fälten nedan.", fieldErrors };
  }
  const data = parsed.data;
  const income = parseFloat(data.monthlyIncome.replace(",", "."));
  if (!isFinite(income) || income < 0) {
    return {
      status: "error",
      message: "Kontrollera fälten nedan.",
      fieldErrors: { monthlyIncome: "Ogiltig inkomst." },
    };
  }

  try {
    await submitApplication(user.organizationId, {
      listingId: data.listingId,
      personId: user.personId,
      desiredMoveInDate: data.desiredMoveInDate ? new Date(data.desiredMoveInDate) : undefined,
      isInternalTransfer: data.isInternalTransfer === "1" ? true : undefined,
      currentHousing: data.currentHousing || undefined,
      currentLandlord: data.currentLandlord || undefined,
      employment: data.employment,
      employer: data.employer || undefined,
      employmentType: data.employmentType || undefined,
      monthlyIncome: income,
      otherIncome: data.otherIncome || undefined,
      references: data.references || undefined,
      pets: data.pets || undefined,
      vehicles: data.vehicles || undefined,
      specialNeeds: data.specialNeeds || undefined,
      message: data.message || undefined,
    });
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Kunde inte skicka ansökan." };
  }

  redirect("/mina-sidor/ansokningar?skickad=1");
}
