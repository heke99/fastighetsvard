"use client";

import { useActionState } from "react";
import { requestPasswordResetAction, type AuthFormState } from "@/app/(public)/auth-actions";

const initialState: AuthFormState = { status: "idle" };

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialState);

  return (
    <form action={formAction} className="card mt-6 space-y-4 p-6" noValidate>
      {state.status === "error" && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">
          {state.message}
        </div>
      )}
      {state.status === "success" ? (
        <div role="status" className="rounded-lg bg-brand-50 p-3 text-sm font-medium text-brand-800">
          {state.message}
        </div>
      ) : (
        <>
          <div>
            <label htmlFor="email" className="label">E-postadress</label>
            <input id="email" name="email" type="email" autoComplete="email" required className="input" />
          </div>
          <button type="submit" disabled={pending} className="btn-primary w-full">
            {pending ? "Skickar …" : "Skicka återställningslänk"}
          </button>
        </>
      )}
    </form>
  );
}
