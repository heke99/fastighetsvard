"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { respondToOffer } from "@/lib/services/applications";

export interface OfferFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

export async function respondToOfferAction(
  _prev: OfferFormState,
  formData: FormData
): Promise<OfferFormState> {
  const user = await getCurrentUser();
  if (!user?.personId || !user.organizationId) {
    return { status: "error", message: "Inloggning krävs." };
  }
  const offerId = String(formData.get("offerId") ?? "");
  const accept = formData.get("response") === "accept";
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(idempotencyKey)) {
    return { status: "error", message: "Begäran saknar giltig idempotensnyckel. Ladda om sidan." };
  }

  try {
    const result = await respondToOffer(user.organizationId, offerId, user.personId, accept, {
      actorUserId: user.id,
      idempotencyKey,
    });
    revalidatePath("/mina-sidor/ansokningar");
    if (accept) {
      return {
        status: "success",
        message: result.internalTransferPending
          ? "Grattis! Det nya avtalet har skapats för signering. Ditt nuvarande avtal är fortfarande aktivt och samordnas först när det nya avtalet blivit bindande."
          : "Grattis! Ett avtal har skapats och skickats till dig för signering. Gå till Mina avtal för att signera.",
      };
    }
    return { status: "success", message: "Du har tackat nej till erbjudandet." };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Kunde inte besvara erbjudandet." };
  }
}
