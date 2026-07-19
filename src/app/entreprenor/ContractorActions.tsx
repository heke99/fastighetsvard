"use client";

import { useActionState } from "react";
import { contractorWorkOrderAction, type ContractorFormState } from "./actions";
import type { WorkOrderStatus } from "@/lib/database-types";

const initialState: ContractorFormState = { status: "idle" };

export function ContractorWorkOrderActions({
  workOrderId,
  status,
}: {
  workOrderId: string;
  status: WorkOrderStatus;
}) {
  const [state, formAction, pending] = useActionState(contractorWorkOrderAction, initialState);

  const simpleActions: { toStatus: WorkOrderStatus; label: string; show: boolean }[] = [
    { toStatus: "ACCEPTED", label: "Acceptera", show: status === "OFFERED" },
    { toStatus: "REJECTED", label: "Avvisa", show: status === "OFFERED" },
    { toStatus: "IN_PROGRESS", label: "Påbörja arbete", show: ["ACCEPTED", "BOOKED"].includes(status) },
  ];

  return (
    <div className="mt-4 border-t border-stone-100 pt-3">
      {state.status === "error" && (
        <div role="alert" className="mb-2 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">
          {state.message}
        </div>
      )}
      {state.status === "success" && (
        <div role="status" className="mb-2 rounded-lg bg-brand-50 p-3 text-sm font-medium text-brand-800">
          {state.message}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {simpleActions.filter((a) => a.show).map((a) => (
          <form key={a.toStatus} action={formAction}>
            <input type="hidden" name="workOrderId" value={workOrderId} />
            <input type="hidden" name="toStatus" value={a.toStatus} />
            <button type="submit" disabled={pending} className={a.toStatus === "REJECTED" ? "btn-secondary" : "btn-primary"}>
              {a.label}
            </button>
          </form>
        ))}
      </div>

      {["ACCEPTED"].includes(status) && (
        <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="workOrderId" value={workOrderId} />
          <input type="hidden" name="toStatus" value="BOOKED" />
          <div>
            <label htmlFor={`book-${workOrderId}`} className="label">Boka tid</label>
            <input id={`book-${workOrderId}`} name="scheduledAt" type="datetime-local" required className="input" />
          </div>
          <button type="submit" disabled={pending} className="btn-secondary">Boka</button>
        </form>
      )}

      {status === "IN_PROGRESS" && (
        <form action={formAction} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="workOrderId" value={workOrderId} />
          <input type="hidden" name="toStatus" value="DONE" />
          <div>
            <label htmlFor={`time-${workOrderId}`} className="label">Arbetad tid (timmar)</label>
            <input id={`time-${workOrderId}`} name="timeReported" type="number" step="0.25" min="0" required className="input" />
          </div>
          <div>
            <label htmlFor={`material-${workOrderId}`} className="label">Material</label>
            <input id={`material-${workOrderId}`} name="materialsUsed" className="input" placeholder="T.ex. blandare, packningar" />
          </div>
          <div>
            <label htmlFor={`cost-${workOrderId}`} className="label">Kostnad / fakturaunderlag (kr)</label>
            <input id={`cost-${workOrderId}`} name="cost" type="number" min="0" className="input" />
          </div>
          <div>
            <label htmlFor={`notes-${workOrderId}`} className="label">Kommentar</label>
            <input id={`notes-${workOrderId}`} name="notes" className="input" />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={pending} className="btn-primary">
              {pending ? "Skickar …" : "Färdigmarkera och skicka rapport"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
