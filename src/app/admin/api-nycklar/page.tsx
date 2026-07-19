import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, API_SCOPES } from "@/lib/permissions";
import { ActionForm } from "@/components/admin/ActionForm";
import { createApiKeyAction, revokeApiKeyAction } from "../actions";

export const metadata = { title: "Admin – API-nycklar" };

export default async function AdminApiKeysPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId || !hasPermission(user.permissions, "apikeys", "read")) {
    redirect("/admin");
  }

  const keys = await db.apiKey.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: "desc" },
  });

  const canCreate = hasPermission(user.permissions, "apikeys", "create");
  const canRevoke = hasPermission(user.permissions, "apikeys", "delete");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-stone-900">API-nycklar</h1>
        <p className="mt-1 text-sm text-stone-500">
          Nycklar för externa integrationer (bokföringssystem m.fl.). Dokumentation:{" "}
          <a href="/api/v1/openapi" className="font-medium text-brand-700 underline">OpenAPI-specifikation</a>.
          Rotera nycklar genom att skapa en ny och revokera den gamla.
        </p>
      </header>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <caption className="sr-only">API-nycklar</caption>
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
              <th scope="col" className="px-4 py-3">Namn</th>
              <th scope="col" className="px-4 py-3">Prefix</th>
              <th scope="col" className="px-4 py-3">Behörigheter</th>
              <th scope="col" className="px-4 py-3">Senast använd</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3">Åtgärd</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {keys.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-stone-500">Inga API-nycklar.</td></tr>
            )}
            {keys.map((k) => (
              <tr key={k.id} className="hover:bg-stone-50">
                <td className="px-4 py-3 font-medium text-stone-900">{k.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{k.keyPrefix}…</td>
                <td className="max-w-64 px-4 py-3 text-xs text-stone-600">{k.scopes.join(", ")}</td>
                <td className="px-4 py-3">
                  {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString("sv-SE") : "Aldrig"}
                </td>
                <td className="px-4 py-3">
                  <span className={`badge ${k.isActive && !k.revokedAt ? "bg-brand-100 text-brand-800" : "bg-red-100 text-red-800"}`}>
                    {k.isActive && !k.revokedAt ? "Aktiv" : "Revokerad"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {canRevoke && k.isActive && !k.revokedAt && (
                    <form action={revokeApiKeyAction}>
                      <input type="hidden" name="apiKeyId" value={k.id} />
                      <button type="submit" className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50">
                        Revokera
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canCreate && (
        <section aria-labelledby="ny-nyckel" className="card p-5">
          <h2 id="ny-nyckel" className="mb-4 font-semibold text-stone-900">Ny API-nyckel</h2>
          <ActionForm action={createApiKeyAction} submitLabel="Skapa nyckel">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="label">Namn</label>
                <input id="name" name="name" required className="input" placeholder="T.ex. Fortnox-integration" />
              </div>
              <div>
                <label htmlFor="allowedIps" className="label">IP-begränsning (kommaseparerad, valfri)</label>
                <input id="allowedIps" name="allowedIps" className="input" placeholder="203.0.113.10, 203.0.113.11" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="scopes" className="label">Behörigheter (kommaseparerade)</label>
                <input
                  id="scopes"
                  name="scopes"
                  required
                  className="input font-mono text-xs"
                  placeholder="customers:read, invoices:write, payments:write"
                />
                <p className="mt-1 text-xs text-stone-500">
                  Tillgängliga: {API_SCOPES.join(", ")}
                </p>
              </div>
            </div>
          </ActionForm>
        </section>
      )}
    </div>
  );
}
