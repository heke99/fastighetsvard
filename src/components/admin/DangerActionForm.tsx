"use client";

import { useActionState, useState } from "react";
import type { AdminFormState } from "@/app/admin/actions";

const initialState: AdminFormState = { status: "idle" };

/**
 * Destruktiv åtgärd med obligatorisk bekräftelse.
 *
 * Knappen öppnar först en bekräftelse som beskriver exakt vad som tas bort och
 * vilka konsekvenser det får. Under pågående anrop är knappen låst, vilket
 * hindrar dubbelklick från att skicka två raderingar.
 */
export function DangerActionForm({
  action,
  label,
  confirmTitle,
  confirmDescription,
  confirmLabel,
  fields,
}: {
  action: (prev: AdminFormState, formData: FormData) => Promise<AdminFormState>;
  label: string;
  confirmTitle: string;
  confirmDescription: string;
  confirmLabel?: string;
  fields: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="space-y-2">
      {state.status === "error" && (
        <p role="alert" className="rounded-lg bg-red-50 p-2 text-xs font-medium text-red-800">
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p role="status" className="rounded-lg bg-brand-50 p-2 text-xs font-medium text-brand-800">
          {state.message}
        </p>
      )}

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
        >
          {label}
        </button>
      ) : (
        <form action={formAction} className="rounded-lg border border-red-200 bg-red-50 p-3">
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <p className="text-xs font-semibold text-red-900">{confirmTitle}</p>
          <p className="mt-1 text-xs text-red-800">{confirmDescription}</p>
          <div className="mt-2 flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded bg-red-700 px-2 py-1 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-60"
            >
              {pending ? "Raderar …" : confirmLabel ?? "Ja, radera"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="rounded border border-stone-300 bg-white px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100"
            >
              Avbryt
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
