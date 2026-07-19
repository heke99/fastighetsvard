"use client";

import { useActionState } from "react";
import { respondToOfferAction, type OfferFormState } from "./actions";

const initialState: OfferFormState = { status: "idle" };

export function OfferResponseForm({ offerId }: { offerId: string }) {
  const [state, formAction, pending] = useActionState(respondToOfferAction, initialState);

  if (state.status === "success") {
    return (
      <div role="status" className="mt-3 rounded-lg bg-brand-50 p-3 text-sm font-medium text-brand-800">
        {state.message}
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2" noValidate>
      <input type="hidden" name="offerId" value={offerId} />
      {state.status === "error" && (
        <div role="alert" className="w-full rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">
          {state.message}
        </div>
      )}
      <button type="submit" name="response" value="accept" disabled={pending} className="btn-primary">
        {pending ? "Skickar …" : "Acceptera erbjudandet"}
      </button>
      <button type="submit" name="response" value="decline" disabled={pending} className="btn-secondary">
        Tacka nej
      </button>
    </form>
  );
}
