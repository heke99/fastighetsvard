"use client";

import { useActionState, useState } from "react";
import { previewImportAction, runImportAction, type AdminFormState } from "../../actions";

const initialState: AdminFormState = { status: "idle" };

interface RowResult {
  row: number;
  status: "created" | "skipped" | "error";
  message: string;
}

const EXAMPLE = `firstName;lastName;email;personalNumber;unitNumber;contractStartDate;rent;externalCustomerId;externalSystem
Anna;Andersson;anna@example.com;198501011234;1101;2022-03-01;7800;KUND-1001;fortnox`;

function ResultTable({ results }: { results: RowResult[] }) {
  return (
    <div className="max-h-80 overflow-y-auto rounded-lg border border-stone-200">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-stone-50">
          <tr className="text-left text-xs uppercase tracking-wide text-stone-500">
            <th scope="col" className="px-3 py-2">Rad</th>
            <th scope="col" className="px-3 py-2">Status</th>
            <th scope="col" className="px-3 py-2">Meddelande</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {results.map((r) => (
            <tr key={r.row}>
              <td className="px-3 py-1.5">{r.row}</td>
              <td className="px-3 py-1.5">
                <span
                  className={`badge ${
                    r.status === "created"
                      ? "bg-brand-100 text-brand-800"
                      : r.status === "skipped"
                        ? "bg-accent-500/20 text-accent-600"
                        : "bg-red-100 text-red-800"
                  }`}
                >
                  {r.status === "created" ? "OK" : r.status === "skipped" ? "Hoppas över" : "Fel"}
                </span>
              </td>
              <td className="px-3 py-1.5 text-stone-600">{r.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ImportWizard() {
  const [csv, setCsv] = useState("");
  const [previewState, previewAction, previewPending] = useActionState(previewImportAction, initialState);
  const [runState, runAction, runPending] = useActionState(runImportAction, initialState);

  const previewResults = (previewState.data?.results as RowResult[] | undefined) ?? [];
  const runResults = (runState.data?.results as RowResult[] | undefined) ?? [];
  const previewOk = previewState.status === "success";

  return (
    <div className="space-y-5">
      <form action={previewAction} className="card space-y-4 p-5" noValidate>
        <div>
          <label htmlFor="csv" className="label">CSV-innehåll</label>
          <textarea
            id="csv"
            name="csv"
            rows={8}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            className="input font-mono text-xs"
            placeholder={EXAMPLE}
          />
        </div>
        {previewState.status === "error" && (
          <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">
            {previewState.message}
          </div>
        )}
        <button type="submit" disabled={previewPending || !csv.trim()} className="btn-secondary">
          {previewPending ? "Granskar …" : "1. Förhandsgranska"}
        </button>
        {previewOk && (
          <>
            <p className="text-sm font-medium text-stone-700">{previewState.message}</p>
            <ResultTable results={previewResults} />
          </>
        )}
      </form>

      {previewOk && (
        <form action={runAction} className="card space-y-4 p-5" noValidate>
          <input type="hidden" name="csv" value={csv} />
          <p className="text-sm text-stone-600">
            Kör importen för raderna ovan. Rader med fel hoppas över och redovisas i
            felrapporten – övriga skapas. Varje rad importeras transaktionssäkert.
          </p>
          {runState.status === "error" && (
            <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">
              {runState.message}
            </div>
          )}
          {runState.status === "success" && (
            <>
              <div role="status" className="rounded-lg bg-brand-50 p-3 text-sm font-medium text-brand-800">
                {runState.message}
              </div>
              <ResultTable results={runResults} />
            </>
          )}
          {runState.status !== "success" && (
            <button type="submit" disabled={runPending} className="btn-primary">
              {runPending ? "Importerar …" : "2. Kör import"}
            </button>
          )}
        </form>
      )}
    </div>
  );
}
