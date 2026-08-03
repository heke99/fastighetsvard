"use client";

import { useActionState } from "react";
import {
  resendConfirmationAction,
  type AuthFormState,
} from "@/app/(public)/auth-actions";

const initialState: AuthFormState = { status: "idle" };

export function ResendConfirmationForm() {
  const [state, formAction, pending] = useActionState(resendConfirmationAction, initialState);

  return (
    <details className="mt-4 rounded-lg border border-brand-200 bg-white p-3">
      <summary className="cursor-pointer text-sm font-semibold text-brand-800">
        Skicka bekräftelsemejlet igen
      </summary>
      <form action={formAction} className="mt-3 space-y-3" noValidate>
        {state.message && (
          <div
            role={state.status === "error" ? "alert" : "status"}
            className={`rounded-md p-2 text-sm ${
              state.status === "error" ? "bg-red-50 text-red-800" : "bg-brand-50 text-brand-800"
            }`}
          >
            {state.message}
          </div>
        )}
        {state.status !== "success" && (
          <>
            <div>
              <label htmlFor="resend-email" className="label">E-postadress</label>
              <input
                id="resend-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="input"
              />
            </div>
            <button type="submit" disabled={pending} className="btn-secondary w-full">
              {pending ? "Skickar …" : "Skicka nytt bekräftelsemejl"}
            </button>
          </>
        )}
      </form>
    </details>
  );
}
