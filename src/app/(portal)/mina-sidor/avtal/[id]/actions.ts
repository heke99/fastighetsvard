"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getClientIp, getCurrentUser } from "@/lib/auth";
import {
  requestContractSigningCode,
  requestTermination,
  verifyContractSigningCode,
} from "@/lib/services/contracts";

export interface ContractFormState {
  status: "idle" | "error" | "code_sent" | "success";
  message?: string;
  challengeId?: string;
  maskedDestination?: string;
}

export async function signContractAction(
  prev: ContractFormState,
  formData: FormData
): Promise<ContractFormState> {
  const user = await getCurrentUser();
  if (!user?.personId || !user.organizationId) {
    return { status: "error", message: "Inloggning krävs." };
  }
  const contractId = String(formData.get("contractId") ?? "");
  const operation = String(formData.get("operation") ?? "request_code");

  try {
    if (operation === "request_code") {
      const result = await requestContractSigningCode({
        contractId,
        personId: user.personId,
        verifiedEmail: user.email,
      });
      return {
        status: "code_sent",
        message: "En sexsiffrig signeringskod har skickats till din verifierade e-postadress.",
        challengeId: result.challengeId,
        maskedDestination: result.maskedDestination,
      };
    }

    const challengeId = String(formData.get("challengeId") ?? prev.challengeId ?? "");
    const code = String(formData.get("code") ?? "").trim();
    if (!challengeId) return { status: "error", message: "Begär en ny signeringskod." };
    if (formData.get("confirm") !== "1") {
      return { ...prev, status: "error", message: "Du måste bekräfta att du läst avtalsvillkoren." };
    }
    const requestHeaders = await headers();
    await verifyContractSigningCode({
      challengeId,
      personId: user.personId,
      code,
      ip: await getClientIp(),
      userAgent: requestHeaders.get("user-agent") ?? undefined,
    });
  } catch (e) {
    return {
      ...prev,
      status: "error",
      message: e instanceof Error ? e.message : "Signeringen misslyckades.",
    };
  }

  revalidatePath(`/mina-sidor/avtal/${contractId}`);
  return { status: "success", message: "Din verifierade signatur har registrerats." };
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
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(idempotencyKey)) {
    return { status: "error", message: "Begäran saknar giltig idempotensnyckel. Ladda om sidan." };
  }
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
      idempotencyKey,
    });
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Uppsägningen misslyckades." };
  }
  revalidatePath(`/mina-sidor/avtal/${contractId}`);
  return {
    status: "success",
    message: "Uppsägningen är registrerad för granskning. Avtalet är fortsatt aktivt under uppsägningstiden.",
  };
}
