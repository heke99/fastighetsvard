"use client";

import { useActionState } from "react";
import { signContractAction, terminateContractAction, type ContractFormState } from "./actions";

const initialState: ContractFormState = { status: "idle" };

export function SignContractForm({ contractId }: { contractId: string }) {
  const [state, formAction, pending] = useActionState(signContractAction, initialState);

  if (state.status === "success") {
    return (
      <div role="status" className="mt-4 rounded-lg bg-brand-50 p-3 text-sm font-medium text-brand-800">
        {state.message}
      </div>
    );
  }

  const challengeRequested = Boolean(state.challengeId);

  return (
    <form action={formAction} className="mt-4 space-y-3" noValidate>
      <input type="hidden" name="contractId" value={contractId} />
      {state.challengeId && <input type="hidden" name="challengeId" value={state.challengeId} />}

      {state.status === "error" && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">
          {state.message}
        </div>
      )}
      {state.status === "code_sent" && (
        <div role="status" className="rounded-lg bg-brand-50 p-3 text-sm text-brand-800">
          {state.message} {state.maskedDestination ? `Adress: ${state.maskedDestination}` : null}
        </div>
      )}

      {!challengeRequested ? (
        <button type="submit" name="operation" value="request_code" disabled={pending} className="btn-primary">
          {pending ? "Skickar kod …" : "Skicka signeringskod"}
        </button>
      ) : (
        <>
          <div>
            <label htmlFor="signing-code" className="label">Sexsiffrig signeringskod</label>
            <input
              id="signing-code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
              className="input max-w-xs font-mono tracking-[0.3em]"
            />
          </div>
          <label className="flex items-start gap-2 text-sm text-stone-700">
            <input type="checkbox" name="confirm" value="1" required className="mt-0.5 h-4 w-4 rounded border-stone-300 text-brand-700" />
            <span>Jag har läst avtalsvillkoren och signerar exakt den visade avtalsversionen.</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" name="operation" value="verify_code" disabled={pending} className="btn-primary">
              {pending ? "Verifierar …" : "Verifiera och signera"}
            </button>
            <button type="submit" name="operation" value="request_code" disabled={pending} className="btn-secondary">
              Skicka ny kod
            </button>
          </div>
        </>
      )}
    </form>
  );
}

export function TerminateContractForm({
  contractId,
  earliestEndDate,
  idempotencyKey,
}: {
  contractId: string;
  earliestEndDate: string;
  idempotencyKey: string;
}) {
  const [state, formAction, pending] = useActionState(terminateContractAction, initialState);

  if (state.status === "success") {
    return (
      <div role="status" className="mt-4 rounded-lg bg-brand-50 p-3 text-sm font-medium text-brand-800">
        {state.message}
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-4 space-y-3" noValidate>
      <input type="hidden" name="contractId" value={contractId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
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
        <span>Jag förstår att uppsägningen registreras för granskning och att avtalet fortsätter gälla under uppsägningstiden.</span>
      </label>
      <button type="submit" disabled={pending} className="btn-secondary border-orange-300 text-orange-800 hover:bg-orange-50">
        {pending ? "Skickar uppsägning …" : "Skicka uppsägning"}
      </button>
    </form>
  );
}
