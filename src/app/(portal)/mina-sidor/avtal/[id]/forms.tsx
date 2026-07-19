"use client";

import { useActionState } from "react";
import { signContractAction, terminateContractAction, type ContractFormState } from "./actions";

const initialState: ContractFormState = { status: "idle" };

export function SignContractForm({ contractId }: { contractId: string }) {
  const [state, formAction, pending] = useActionState(signContractAction, initialState);

  return (
    <form action={formAction} className="mt-4 space-y-3" noValidate>
      <input type="hidden" name="contractId" value={contractId} />
      {state.status === "error" && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">
          {state.message}
        </div>
      )}
      <label className="flex items-start gap-2 text-sm text-stone-700">
        <input type="checkbox" name="confirm" value="1" required className="mt-0.5 h-4 w-4 rounded border-stone-300 text-brand-700" />
        <span>Jag har läst avtalsvillkoren och signerar avtalet.</span>
      </label>
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Signerar …" : "Signera avtalet"}
      </button>
    </form>
  );
}

export function TerminateContractForm({
  contractId,
  earliestEndDate,
}: {
  contractId: string;
  earliestEndDate: string;
}) {
  const [state, formAction, pending] = useActionState(terminateContractAction, initialState);

  return (
    <form action={formAction} className="mt-4 space-y-3" noValidate>
      <input type="hidden" name="contractId" value={contractId} />
      {state.status === "error" && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">
          {state.message}
        </div>
      )}
      <div>
        <label htmlFor="moveOutDate" className="label">Önskat utflyttningsdatum</label>
        <input
          id="moveOutDate"
          name="moveOutDate"
          type="date"
          min={earliestEndDate}
          defaultValue={earliestEndDate}
          required
          className="input max-w-xs"
        />
      </div>
      <div>
        <label htmlFor="reason" className="label">Anledning (valfritt)</label>
        <input id="reason" name="reason" className="input" />
      </div>
      <label className="flex items-start gap-2 text-sm text-stone-700">
        <input type="checkbox" name="confirm" value="1" required className="mt-0.5 h-4 w-4 rounded border-stone-300 text-brand-700" />
        <span>Jag förstår att uppsägningen är bindande när den bekräftats.</span>
      </label>
      <button type="submit" disabled={pending} className="btn-secondary border-orange-300 text-orange-800 hover:bg-orange-50">
        {pending ? "Skickar uppsägning …" : "Säg upp avtalet"}
      </button>
    </form>
  );
}
