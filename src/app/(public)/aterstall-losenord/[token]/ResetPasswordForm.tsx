"use client";

import { useActionState } from "react";
import { resetPasswordAction, type AuthFormState } from "@/app/(public)/auth-actions";

const initialState: AuthFormState = { status: "idle" };

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);

  return (
    <form action={formAction} className="card mt-6 space-y-4 p-6" noValidate>
      <input type="hidden" name="token" value={token} />
      {state.status === "error" && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">
          {state.message}
        </div>
      )}
      <div>
        <label htmlFor="password" className="label">Nytt lösenord (minst 10 tecken)</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} className="input" />
      </div>
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Sparar …" : "Spara nytt lösenord"}
      </button>
    </form>
  );
}
