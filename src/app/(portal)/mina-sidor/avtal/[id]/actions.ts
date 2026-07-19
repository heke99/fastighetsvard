"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { signContract, requestTermination } from "@/lib/services/contracts";

export interface ContractFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

export async function signContractAction(
  _prev: ContractFormState,
  formData: FormData
): Promise<ContractFormState> {
  const user = await getCurrentUser();
  if (!user?.personId || !user.organizationId) {
    return { status: "error", message: "Inloggning krävs." };
  }
  const contractId = String(formData.get("contractId") ?? "");
  if (formData.get("confirm") !== "1") {
    return { status: "error", message: "Du måste bekräfta att du läst villkoren." };
  }
  try {
    await signContract(user.organizationId, contractId, user.personId, "email_code");
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Signeringen misslyckades." };
  }
  revalidatePath(`/mina-sidor/avtal/${contractId}`);
  return { status: "success" };
}

export async function terminateContractAction(
  _prev: ContractFormState,
  formData: FormData
): Promise<ContractFormState> {
  const user = await getCurrentUser();
  if (!user?.personId || !user.organizationId) {
    return { status: "error", message: "Inloggning krävs." };
  }
  const contractId = String(formData.get("contractId") ?? "");
  const moveOutDate = new Date(String(formData.get("moveOutDate") ?? ""));
  if (isNaN(moveOutDate.getTime())) {
    return { status: "error", message: "Ogiltigt utflyttningsdatum." };
  }
  if (formData.get("confirm") !== "1") {
    return { status: "error", message: "Du måste bekräfta uppsägningen." };
  }
  try {
    await requestTermination(user.organizationId, contractId, user.personId, moveOutDate, {
      reason: String(formData.get("reason") ?? "") || undefined,
      actorUserId: user.id,
    });
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Uppsägningen misslyckades." };
  }
  revalidatePath(`/mina-sidor/avtal/${contractId}`);
  return { status: "success" };
}
