"use client";

import { useState } from "react";

export function SaveSearchButton({
  searchParams,
  basePath,
}: {
  searchParams: Record<string, string | string[] | undefined>;
  basePath: string;
}) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    const criteria: Record<string, string> = { basePath };
    for (const [k, v] of Object.entries(searchParams)) {
      if (typeof v === "string" && v) criteria[k] = v;
    }
    const res = await fetch("/api/auth/saved-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `Sökning ${new Date().toLocaleDateString("sv-SE")}`, criteria }),
    });
    if (res.ok) setSaved(true);
    else setError("Kunde inte spara sökningen.");
  }

  return (
    <div className="mt-3">
      <button type="button" onClick={save} disabled={saved} className="btn-secondary w-full">
        {saved ? "Bevakning sparad ✓" : "Spara sökning som bevakning"}
      </button>
      {error && <p className="form-error">{error}</p>}
      <p className="mt-1.5 text-xs text-stone-500">
        Du får e-post när nya objekt matchar din sökning.
      </p>
    </div>
  );
}
