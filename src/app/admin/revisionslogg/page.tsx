import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export const metadata = { title: "Admin – Revisionslogg" };

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.organizationId || !hasPermission(user.permissions, "audit", "read")) {
    redirect("/admin");
  }
  const { entity } = await searchParams;

  const events = await db.auditEvent.findMany({
    where: {
      organizationId: user.organizationId,
      ...(entity ? { entityType: entity } : {}),
    },
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-stone-900">Revisionslogg</h1>
        <form method="GET" className="flex items-center gap-2">
          <label htmlFor="entity" className="text-sm text-stone-600">Entitet:</label>
          <input id="entity" name="entity" defaultValue={entity ?? ""} className="input w-auto py-1.5" placeholder="t.ex. contract" />
          <button type="submit" className="btn-secondary py-1.5">Filtrera</button>
        </form>
      </header>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <caption className="sr-only">Revisionshändelser</caption>
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
              <th scope="col" className="px-4 py-3">Tidpunkt</th>
              <th scope="col" className="px-4 py-3">Aktör</th>
              <th scope="col" className="px-4 py-3">Åtgärd</th>
              <th scope="col" className="px-4 py-3">Entitet</th>
              <th scope="col" className="px-4 py-3">Detaljer</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {events.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-stone-500">Inga händelser.</td></tr>
            )}
            {events.map((e) => (
              <tr key={e.id} className="align-top hover:bg-stone-50">
                <td className="whitespace-nowrap px-4 py-3">{new Date(e.createdAt).toLocaleString("sv-SE")}</td>
                <td className="px-4 py-3">
                  {e.user?.email ?? (e.actorType === "system" ? "System" : e.actorType === "api_key" ? `API-nyckel ${e.actorId?.slice(0, 8) ?? ""}` : e.actorType)}
                </td>
                <td className="px-4 py-3 font-medium text-stone-900">{e.action}</td>
                <td className="px-4 py-3">{e.entityType}{e.entityId ? ` · ${e.entityId.slice(0, 10)}…` : ""}</td>
                <td className="max-w-md px-4 py-3">
                  {(e.before || e.after) && (
                    <details>
                      <summary className="cursor-pointer text-xs font-medium text-brand-700">Visa ändring</summary>
                      <pre className="mt-1 max-h-40 overflow-auto rounded bg-stone-50 p-2 text-xs">
                        {JSON.stringify({ before: e.before, after: e.after }, null, 2)}
                      </pre>
                    </details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
