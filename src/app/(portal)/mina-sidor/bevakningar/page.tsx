import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { DeleteSavedSearchButton } from "./DeleteSavedSearchButton";

export const metadata = { title: "Mina bevakningar" };

export default async function SavedSearchesPage() {
  const user = await getCurrentUser();
  if (!user?.personId) redirect("/logga-in");

  const searches = await db.savedSearch.findMany({
    where: { personId: user.personId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-stone-900">Mina bevakningar</h1>
        <p className="mt-1 text-stone-500">
          Vi meddelar dig via e-post när nya objekt matchar dina sparade sökningar.
        </p>
      </header>
      {searches.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-semibold text-stone-700">Du har inga bevakningar.</p>
          <p className="mt-1 text-sm text-stone-500">
            Gör en sökning och klicka på &quot;Spara sökning som bevakning&quot;.
          </p>
          <Link href="/lediga-bostader" className="btn-primary mt-4">Sök bostad</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {searches.map((s) => {
            const criteria = s.criteria as Record<string, string>;
            const basePath = criteria.basePath ?? "/lediga-bostader";
            const sp = new URLSearchParams();
            for (const [k, v] of Object.entries(criteria)) {
              if (k !== "basePath" && v) sp.set(k, v);
            }
            const filterText = Object.entries(criteria)
              .filter(([k]) => k !== "basePath")
              .map(([k, v]) => `${k}: ${v}`)
              .join(", ");
            return (
              <li key={s.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-stone-900">{s.name}</p>
                  <p className="truncate text-sm text-stone-500">{filterText || "Alla publicerade objekt"}</p>
                  <p className="text-xs text-stone-400">
                    E-postnotis: {s.emailAlerts ? "på" : "av"} · SMS: {s.smsAlerts ? "på" : "av"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link href={`${basePath}?${sp.toString()}`} className="btn-secondary">Visa träffar</Link>
                  <DeleteSavedSearchButton id={s.id} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
