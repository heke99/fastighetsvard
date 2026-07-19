"use client";

import { useActionState } from "react";
import { createMaintenanceAction, type MaintenanceFormState } from "./actions";

const initialState: MaintenanceFormState = { status: "idle" };

const categories: Record<string, string[]> = {
  "VVS": ["Kran/blandare", "Avlopp", "Toalett", "Värme", "Vattenläcka", "Annat"],
  "El": ["Belysning", "Eluttag", "Säkringar", "Vitvaror", "Annat"],
  "Kök": ["Spis/ugn", "Kyl/frys", "Diskmaskin", "Fläkt", "Annat"],
  "Badrum": ["Dusch", "Ventilation", "Fukt/mögel", "Annat"],
  "Dörrar och lås": ["Ytterdörr", "Lås", "Nycklar", "Porttelefon", "Annat"],
  "Fönster": ["Trasig ruta", "Drag", "Beslag", "Annat"],
  "Allmänna utrymmen": ["Trapphus", "Tvättstuga", "Källare/förråd", "Utemiljö", "Hiss", "Annat"],
  "Skadedjur": ["Insekter", "Gnagare", "Annat"],
  "Övrigt": ["Övrigt"],
};

export function MaintenanceForm({
  units,
  preselectedUnitId,
}: {
  units: { id: string; address: string; city: string }[];
  preselectedUnitId?: string;
}) {
  const [state, formAction, pending] = useActionState(createMaintenanceAction, initialState);

  return (
    <form action={formAction} className="card space-y-5 p-6" noValidate>
      {state.status === "error" && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">
          {state.message}
        </div>
      )}

      <div>
        <label htmlFor="unitId" className="label">Var är felet? <span aria-hidden="true" className="text-red-600">*</span></label>
        <select id="unitId" name="unitId" required defaultValue={preselectedUnitId ?? ""} className="input">
          <option value="">Välj bostad/objekt …</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>{u.address}, {u.city}</option>
          ))}
          <option value="common">Allmänt utrymme (trapphus, tvättstuga m.m.)</option>
        </select>
        {state.fieldErrors?.unitId && <p className="form-error">{state.fieldErrors.unitId}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className="label">Kategori <span aria-hidden="true" className="text-red-600">*</span></label>
          <select id="category" name="category" required className="input">
            <option value="">Välj kategori …</option>
            {Object.keys(categories).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {state.fieldErrors?.category && <p className="form-error">{state.fieldErrors.category}</p>}
        </div>
        <div>
          <label htmlFor="room" className="label">Rum eller område</label>
          <input id="room" name="room" className="input" placeholder="T.ex. kök, badrum" />
        </div>
      </div>

      <div>
        <label htmlFor="title" className="label">Rubrik <span aria-hidden="true" className="text-red-600">*</span></label>
        <input id="title" name="title" required maxLength={200} className="input" placeholder="Kort beskrivning av felet" />
        {state.fieldErrors?.title && <p className="form-error">{state.fieldErrors.title}</p>}
      </div>

      <div>
        <label htmlFor="description" className="label">Beskrivning <span aria-hidden="true" className="text-red-600">*</span></label>
        <textarea
          id="description"
          name="description"
          required
          rows={5}
          className="input"
          placeholder="Beskriv felet: vad som hänt, när det upptäcktes och hur det påverkar dig."
        />
        {state.fieldErrors?.description && <p className="form-error">{state.fieldErrors.description}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="discoveredAt" className="label">När upptäcktes felet?</label>
          <input id="discoveredAt" name="discoveredAt" type="date" className="input" />
        </div>
        <div>
          <label htmlFor="contactPhone" className="label">Telefonnummer</label>
          <input id="contactPhone" name="contactPhone" type="tel" autoComplete="tel" className="input" />
        </div>
        <div>
          <label htmlFor="preferredTime" className="label">Önskad tid för besök</label>
          <input id="preferredTime" name="preferredTime" className="input" placeholder="T.ex. vardagar efter kl 15" />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="label">Tillträde</legend>
        <label className="flex items-start gap-2 text-sm text-stone-700">
          <input type="checkbox" name="masterKeyAllowed" value="1" className="mt-0.5 h-4 w-4 rounded border-stone-300 text-brand-700" />
          <span>Ni får använda huvudnyckel om jag inte är hemma.</span>
        </label>
        <label className="flex items-start gap-2 text-sm text-stone-700">
          <input type="checkbox" name="petsInHome" value="1" className="mt-0.5 h-4 w-4 rounded border-stone-300 text-brand-700" />
          <span>Det finns husdjur i bostaden.</span>
        </label>
        <label className="flex items-start gap-2 text-sm text-stone-700">
          <input type="checkbox" name="isEmergency" value="1" className="mt-0.5 h-4 w-4 rounded border-stone-300 text-brand-700" />
          <span className="font-medium text-red-700">Felet är akut (vattenläcka, elavbrott eller liknande).</span>
        </label>
      </fieldset>

      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Skickar …" : "Skicka felanmälan"}
      </button>
    </form>
  );
}
