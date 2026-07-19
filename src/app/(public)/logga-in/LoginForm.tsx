"use client";

import { useActionState } from "react";
import { loginAction, type AuthFormState } from "@/app/(public)/auth-actions";

const initialState: AuthFormState = { status: "idle" };

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="card mt-6 space-y-4 p-6" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      {state.status === "error" && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">
          {state.message}
        </div>
      )}
      <div>
        <label htmlFor="email" className="label">E-postadress</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" />
      </div>
      <div>
        <label htmlFor="password" className="label">Lösenord</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Loggar in …" : "Logga in"}
      </button>
    </form>
  );
}
