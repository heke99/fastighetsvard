"use client";

import { useActionState } from "react";
import { updateProfileAction, type ProfileFormState } from "./actions";

const initialState: ProfileFormState = { status: "idle" };

export function ProfileForm({
  initial,
}: {
  initial: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    postalCode: string;
    city: string;
  };
}) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialState);

  return (
    <form action={formAction} className="card space-y-4 p-6" noValidate>
      {state.status === "error" && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">
          {state.message}
        </div>
      )}
      {state.status === "success" && (
        <div role="status" className="rounded-lg bg-brand-50 p-3 text-sm font-medium text-brand-800">
          Dina uppgifter är sparade.
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className="label">Förnamn</label>
          <input id="firstName" name="firstName" defaultValue={initial.firstName} required className="input" />
        </div>
        <div>
          <label htmlFor="lastName" className="label">Efternamn</label>
          <input id="lastName" name="lastName" defaultValue={initial.lastName} required className="input" />
        </div>
      </div>
      <div>
        <label htmlFor="email" className="label">E-postadress</label>
        <input id="email" name="email" type="email" defaultValue={initial.email} disabled className="input bg-stone-50 text-stone-500" />
        <p className="mt-1 text-xs text-stone-500">
          Kontakta kundtjänst för att byta e-postadress (används för inloggning).
        </p>
      </div>
      <div>
        <label htmlFor="phone" className="label">Telefonnummer</label>
        <input id="phone" name="phone" type="tel" defaultValue={initial.phone} className="input" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label htmlFor="address" className="label">Adress</label>
          <input id="address" name="address" defaultValue={initial.address} className="input" />
        </div>
        <div>
          <label htmlFor="postalCode" className="label">Postnummer</label>
          <input id="postalCode" name="postalCode" defaultValue={initial.postalCode} className="input" />
        </div>
      </div>
      <div className="max-w-xs">
        <label htmlFor="city" className="label">Ort</label>
        <input id="city" name="city" defaultValue={initial.city} className="input" />
      </div>
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Sparar …" : "Spara uppgifter"}
      </button>
    </form>
  );
}

export function DataExportButton() {
  return (
    <a href="/api/auth/gdpr-export" className="btn-secondary" download>
      Ladda ner registerutdrag (JSON)
    </a>
  );
}
