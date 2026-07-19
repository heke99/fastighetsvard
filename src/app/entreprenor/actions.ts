"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { changeWorkOrderStatus } from "@/lib/services/maintenance";
import type { WorkOrderStatus } from "@prisma/client";

export interface ContractorFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

const ALLOWED: WorkOrderStatus[] = ["ACCEPTED", "REJECTED", "BOOKED", "IN_PROGRESS", "DONE"];

export async function contractorWorkOrderAction(
  _prev: ContractorFormState,
  formData: FormData
): Promise<ContractorFormState> {
  const user = await getCurrentUser();
  if (!user?.supplierId || !user.organizationId) {
    return { status: "error", message: "Inloggning som entreprenör krävs." };
  }
  const workOrderId = String(formData.get("workOrderId") ?? "");
  const toStatus = String(formData.get("toStatus") ?? "") as WorkOrderStatus;
  if (!ALLOWED.includes(toStatus)) {
    return { status: "error", message: "Otillåten åtgärd." };
  }

  const timeReported = formData.get("timeReported");
  const cost = formData.get("cost");
  const scheduledAt = formData.get("scheduledAt");

  try {
    // supplierId skickas med: backend begränsar till entreprenörens egna order.
    await changeWorkOrderStatus(user.organizationId, workOrderId, toStatus, {
      actorUserId: user.id,
      supplierId: user.supplierId,
      timeReported: timeReported ? parseFloat(String(timeReported)) : undefined,
      materialsUsed: String(formData.get("materialsUsed") ?? "") || undefined,
      cost: cost ? parseFloat(String(cost)) : undefined,
      notes: String(formData.get("notes") ?? "") || undefined,
      scheduledAt: scheduledAt ? new Date(String(scheduledAt)) : undefined,
    });
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Åtgärden misslyckades." };
  }
  revalidatePath("/entreprenor");
  return { status: "success", message: "Arbetsordern uppdaterades." };
}
