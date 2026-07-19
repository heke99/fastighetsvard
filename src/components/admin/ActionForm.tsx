"use client";

import { useActionState } from "react";
import type { AdminFormState } from "@/app/admin/actions";

const initialState: AdminFormState = { status: "idle" };

/**
 * Generellt formulär för admin-serveractions med statusmeddelande.
 * children renderas som formulärfält.
 */
export function ActionForm({
  action,
  submitLabel,
  children,
  className,
  renderResult,
}: {
  action: (prev: AdminFormState, formData: FormData) => Promise<AdminFormState>;
  submitLabel: string;
  children: React.ReactNode;
  className?: string;
  renderResult?: (data: Record<string, unknown>) => React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className={className ?? "space-y-4"} noValidate>
      {state.status === "error" && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">
          {state.message}
        </div>
      )}
      {state.status === "success" && (
        <div role="status" className="rounded-lg bg-brand-50 p-3 text-sm font-medium text-brand-800 break-all">
          {state.message}
          {state.data?.key ? (
            <code className="mt-2 block rounded bg-white p-2 font-mono text-xs">{String(state.data.key)}</code>
          ) : null}
        </div>
      )}
      {children}
      {state.status === "success" && state.data && renderResult
        ? renderResult(state.data)
        : null}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Arbetar …" : submitLabel}
      </button>
    </form>
  );
}
