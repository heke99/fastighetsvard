"use client";

import { useActionState } from "react";
import { submitApplicationAction, type ApplicationFormState } from "./actions";

const initialState: ApplicationFormState = { status: "idle" };

export function ApplicationForm({
  listingId,
  slug,
  hasActiveContract,
}: {
  listingId: string;
  slug: string;
  hasActiveContract: boolean;
}) {
  const [state, formAction, pending] = useActionState(submitApplicationAction, initialState);

  return (
    <form action={formAction} className="card mt-6 space-y-6 p-6" noValidate>
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="slug" value={slug} />

      {state.status === "error" && (
        <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm font-medium text-red-800">
          {state.message}
        </div>
      )}

      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold text-stone-900">Önskemål</legend>
        <div>
          <label htmlFor="desiredMoveInDate" className="label">Önskat inflyttningsdatum</label>
          <input id="desiredMoveInDate" name="desiredMoveInDate" type="date" className="input max-w-xs" />
          {state.fieldErrors?.desiredMoveInDate && (
            <p className="form-error">{state.fieldErrors.desiredMoveInDate}</p>
          )}
        </div>
        {hasActiveContract && (
          <label className="flex items-start gap-2 text-sm text-stone-700">
            <input type="checkbox" name="isInternalTransfer" value="1" defaultChecked className="mt-0.5 h-4 w-4 rounded border-stone-300 text-brand-700" />
            <span>
              Detta är en intern omflyttning – jag vill att mitt nuvarande avtal
              sägs upp i samband med att jag flyttar in i den nya bostaden.
            </span>
          </label>
        )}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold text-stone-900">Nuvarande boende</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="currentHousing" className="label">Boendeform</label>
            <select id="currentHousing" name="currentHousing" className="input">
              <option value="">Välj …</option>
              <option value="hyresratt">Hyresrätt</option>
              <option value="bostadsratt">Bostadsrätt</option>
              <option value="villa">Villa/radhus</option>
              <option value="inneboende">Inneboende</option>
              <option value="hos_foraldrar">Hos föräldrar</option>
              <option value="annat">Annat</option>
            </select>
          </div>
          <div>
            <label htmlFor="currentLandlord" className="label">Nuvarande hyresvärd</label>
            <input id="currentLandlord" name="currentLandlord" className="input" autoComplete="organization" />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold text-stone-900">Sysselsättning och inkomst</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="employment" className="label">Sysselsättning <span aria-hidden="true" className="text-red-600">*</span></label>
            <select id="employment" name="employment" required className="input" aria-describedby={state.fieldErrors?.employment ? "employment-error" : undefined}>
              <option value="">Välj …</option>
              <option value="anstalld">Anställd</option>
              <option value="egen_foretagare">Egen företagare</option>
              <option value="student">Student</option>
              <option value="pensionar">Pensionär</option>
              <option value="arbetssokande">Arbetssökande</option>
              <option value="annat">Annat</option>
            </select>
            {state.fieldErrors?.employment && (
              <p id="employment-error" className="form-error">{state.fieldErrors.employment}</p>
            )}
          </div>
          <div>
            <label htmlFor="employer" className="label">Arbetsgivare</label>
            <input id="employer" name="employer" className="input" autoComplete="organization" />
          </div>
          <div>
            <label htmlFor="employmentType" className="label">Anställningsform</label>
            <select id="employmentType" name="employmentType" className="input">
              <option value="">Välj …</option>
              <option value="tillsvidare">Tillsvidare</option>
              <option value="visstid">Visstid</option>
              <option value="provanstallning">Provanställning</option>
              <option value="timanstallning">Timanställning</option>
            </select>
          </div>
          <div>
            <label htmlFor="monthlyIncome" className="label">Månadsinkomst före skatt (kr) <span aria-hidden="true" className="text-red-600">*</span></label>
            <input id="monthlyIncome" name="monthlyIncome" type="number" min="0" required className="input" aria-describedby={state.fieldErrors?.monthlyIncome ? "income-error" : undefined} />
            {state.fieldErrors?.monthlyIncome && (
              <p id="income-error" className="form-error">{state.fieldErrors.monthlyIncome}</p>
            )}
          </div>
        </div>
        <div>
          <label htmlFor="otherIncome" className="label">Övriga inkomster (bidrag, pension, studiemedel m.m.)</label>
          <input id="otherIncome" name="otherIncome" className="input" />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold text-stone-900">Hushåll och övrigt</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pets" className="label">Husdjur</label>
            <input id="pets" name="pets" className="input" placeholder="T.ex. 1 katt" />
          </div>
          <div>
            <label htmlFor="vehicles" className="label">Fordon</label>
            <input id="vehicles" name="vehicles" className="input" placeholder="T.ex. 1 personbil" />
          </div>
        </div>
        <div>
          <label htmlFor="references" className="label">Referenser</label>
          <input id="references" name="references" className="input" placeholder="Namn och telefonnummer" />
        </div>
        <div>
          <label htmlFor="specialNeeds" className="label">Särskilda behov</label>
          <input id="specialNeeds" name="specialNeeds" className="input" />
        </div>
        <div>
          <label htmlFor="message" className="label">Meddelande till uthyraren</label>
          <textarea id="message" name="message" rows={4} className="input" />
        </div>
      </fieldset>

      <fieldset>
        <legend className="sr-only">Samtycke</legend>
        <label className="flex items-start gap-2 text-sm text-stone-700">
          <input type="checkbox" name="consent" value="1" required className="mt-0.5 h-4 w-4 rounded border-stone-300 text-brand-700" aria-describedby={state.fieldErrors?.consent ? "consent-error" : undefined} />
          <span>
            Jag samtycker till att Östgöta El Teknik behandlar mina personuppgifter
            för att handlägga min bostadsansökan, i enlighet med integritetspolicyn. <span aria-hidden="true" className="text-red-600">*</span>
          </span>
        </label>
        {state.fieldErrors?.consent && (
          <p id="consent-error" className="form-error">{state.fieldErrors.consent}</p>
        )}
      </fieldset>

      <button type="submit" disabled={pending} className="btn-primary w-full sm:w-auto">
        {pending ? "Skickar ansökan …" : "Skicka ansökan"}
      </button>
    </form>
  );
}
