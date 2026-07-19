"use client";

import { useActionState } from "react";
import { registerAction, type AuthFormState } from "@/app/(public)/auth-actions";

const initialState: AuthFormState = { status: "idle" };

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, initialState);

  return (
    <form action={formAction} className="card mt-6 space-y-4 p-6" noValidate>
      {state.status === "error" && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">
          {state.message}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className="label">Förnamn</label>
          <input id="firstName" name="firstName" autoComplete="given-name" required className="input" />
          {state.fieldErrors?.firstName && <p className="form-error">{state.fieldErrors.firstName}</p>}
        </div>
        <div>
          <label htmlFor="lastName" className="label">Efternamn</label>
          <input id="lastName" name="lastName" autoComplete="family-name" required className="input" />
          {state.fieldErrors?.lastName && <p className="form-error">{state.fieldErrors.lastName}</p>}
        </div>
      </div>
      <div>
        <label htmlFor="email" className="label">E-postadress</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" />
        {state.fieldErrors?.email && <p className="form-error">{state.fieldErrors.email}</p>}
      </div>
      <div>
        <label htmlFor="phone" className="label">Telefonnummer (valfritt)</label>
        <input id="phone" name="phone" type="tel" autoComplete="tel" className="input" />
      </div>
      <div>
        <label htmlFor="password" className="label">Lösenord (minst 10 tecken)</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} className="input" />
        {state.fieldErrors?.password && <p className="form-error">{state.fieldErrors.password}</p>}
      </div>
      <div>
        <label htmlFor="passwordConfirm" className="label">Upprepa lösenord</label>
        <input id="passwordConfirm" name="passwordConfirm" type="password" autoComplete="new-password" required className="input" />
        {state.fieldErrors?.passwordConfirm && <p className="form-error">{state.fieldErrors.passwordConfirm}</p>}
      </div>
      <label className="flex items-start gap-2 text-sm text-stone-700">
        <input type="checkbox" name="consent" value="1" required className="mt-0.5 h-4 w-4 rounded border-stone-300 text-brand-700" />
        <span>
          Jag godkänner att Östgöta El Teknik behandlar mina personuppgifter enligt{" "}
          <a href="/integritetspolicy" className="text-brand-700 underline">integritetspolicyn</a>.
        </span>
      </label>
      {state.fieldErrors?.consent && <p className="form-error">{state.fieldErrors.consent}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Skapar konto …" : "Skapa konto"}
      </button>
    </form>
  );
}
