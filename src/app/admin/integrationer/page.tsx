import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { ActionForm } from "@/components/admin/ActionForm";
import {
  createConnectionAction,
  runSyncAction,
  resolveReviewItemAction,
} from "../actions";

export const metadata = { title: "Admin – Integrationer" };

export default async function AdminIntegrationsPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId || !hasPermission(user.permissions, "integrations", "read")) {
    redirect("/admin");
  }

  const [connections, syncJobs, reviewItems, persons] = await Promise.all([
    prisma.integrationConnection.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.integrationSyncJob.findMany({
      where: { organizationId: user.organizationId },
      include: { connection: { select: { name: true, provider: true } } },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.syncReviewItem.findMany({
      where: { organizationId: user.organizationId, status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
    prisma.person.findMany({
      where: { organizationId: user.organizationId },
      orderBy: [{ lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true, email: true },
      take: 500,
    }),
  ]);

  const canUpdate = hasPermission(user.permissions, "integrations", "update");
  const canCreate = hasPermission(user.permissions, "integrations", "create");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-stone-900">Integrationer & synkronisering</h1>

      {/* Anslutningar */}
      <section aria-labelledby="anslutningar" className="card p-5">
        <h2 id="anslutningar" className="font-semibold text-stone-900">Bokföringsanslutningar</h2>
        {connections.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">Inga anslutningar konfigurerade.</p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-100">
            {connections.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-stone-900">
                    {c.name} <span className="badge ml-1 bg-stone-100 text-stone-600">{c.provider}</span>
                    {!c.isActive && <span className="badge ml-1 bg-red-100 text-red-800">Inaktiv</span>}
                  </p>
                  <p className="text-xs text-stone-500">
                    Senaste synk: {c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleString("sv-SE") : "aldrig"} ·
                    Webhook-endpoint: <code className="rounded bg-stone-100 px-1">/api/webhooks/accounting/{c.provider}</code>
                  </p>
                </div>
                {canUpdate && (
                  <div className="flex flex-wrap gap-1.5">
                    {(["customers", "invoices", "payments", "full"] as const).map((jobType) => (
                      <form key={jobType} action={runSyncAction}>
                        <input type="hidden" name="connectionId" value={c.id} />
                        <input type="hidden" name="jobType" value={jobType} />
                        <button type="submit" className="rounded border border-stone-300 px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100">
                          Synka {jobType === "full" ? "allt" : jobType === "customers" ? "kunder" : jobType === "invoices" ? "fakturor" : "betalningar"}
                        </button>
                      </form>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {canCreate && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-semibold text-brand-700">Ny anslutning</summary>
            <div className="mt-3">
              <ActionForm action={createConnectionAction} submitLabel="Skapa anslutning">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="provider" className="label">Provider</label>
                    <select id="provider" name="provider" required className="input">
                      <option value="mock">Mock (test/demo)</option>
                      <option value="fortnox">Fortnox</option>
                      <option value="visma">Visma</option>
                      <option value="bjornlunden">Björn Lundén</option>
                      <option value="business_central">Business Central</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="name" className="label">Namn</label>
                    <input id="name" name="name" required className="input" placeholder="T.ex. Fortnox produktion" />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="credentials" className="label">Credentials (JSON, krypteras)</label>
                    <textarea id="credentials" name="credentials" rows={2} className="input font-mono text-xs" placeholder='{"apiKey": "..."}' />
                  </div>
                </div>
              </ActionForm>
            </div>
          </details>
        )}
      </section>

      {/* Granskningskö */}
      <section aria-labelledby="granskning" className="card p-5">
        <h2 id="granskning" className="font-semibold text-stone-900">
          Granskningskö{" "}
          {reviewItems.length > 0 && (
            <span className="badge ml-1 bg-red-100 text-red-800">{reviewItems.length} väntar</span>
          )}
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          Poster från synk/webhooks som inte kunde matchas säkert. Koppla rätt person
          och kör om, eller avvisa.
        </p>
        {reviewItems.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">Kön är tom – allt är matchat.</p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-100">
            {reviewItems.map((item) => (
              <li key={item.id} className="py-4">
                <p className="text-sm font-medium text-stone-900">
                  {item.entityType} · {item.externalSystem}:{item.externalId}
                </p>
                <p className="text-sm text-stone-600">{item.reason}</p>
                <pre className="mt-2 max-h-32 overflow-auto rounded bg-stone-50 p-2 text-xs text-stone-600">
                  {JSON.stringify(item.payload, null, 2)}
                </pre>
                {canUpdate && (
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <ActionForm action={resolveReviewItemAction} submitLabel="Matcha och kör om" className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="reviewItemId" value={item.id} />
                      <div className="min-w-56 flex-1">
                        <label htmlFor={`person-${item.id}`} className="label">Koppla till person</label>
                        <select id={`person-${item.id}`} name="personId" required className="input">
                          <option value="">Välj person …</option>
                          {persons.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.lastName}, {p.firstName} {p.email ? `(${p.email})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    </ActionForm>
                    <ActionForm action={resolveReviewItemAction} submitLabel="Avvisa posten" className="flex items-end gap-2">
                      <input type="hidden" name="reviewItemId" value={item.id} />
                      <input type="hidden" name="reject" value="1" />
                      <div className="flex-1">
                        <label htmlFor={`note-${item.id}`} className="label">Anteckning</label>
                        <input id={`note-${item.id}`} name="note" className="input" />
                      </div>
                    </ActionForm>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Synklogg */}
      <section aria-labelledby="synklogg" className="card overflow-x-auto p-5">
        <h2 id="synklogg" className="font-semibold text-stone-900">Synkjobb</h2>
        <table className="mt-3 w-full min-w-[720px] text-sm">
          <caption className="sr-only">Synkjobb</caption>
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
              <th scope="col" className="py-2 pr-4">Startad</th>
              <th scope="col" className="py-2 pr-4">Anslutning</th>
              <th scope="col" className="py-2 pr-4">Typ</th>
              <th scope="col" className="py-2 pr-4">Status</th>
              <th scope="col" className="py-2 pr-4 text-right">Poster</th>
              <th scope="col" className="py-2 pr-4 text-right">Skapade</th>
              <th scope="col" className="py-2 pr-4 text-right">Uppdaterade</th>
              <th scope="col" className="py-2 text-right">Fel</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {syncJobs.length === 0 && (
              <tr><td colSpan={8} className="py-6 text-center text-stone-500">Inga synkjobb har körts.</td></tr>
            )}
            {syncJobs.map((job) => (
              <tr key={job.id}>
                <td className="py-2 pr-4">{job.startedAt ? new Date(job.startedAt).toLocaleString("sv-SE") : "–"}</td>
                <td className="py-2 pr-4">{job.connection.name}</td>
                <td className="py-2 pr-4">{job.jobType}</td>
                <td className="py-2 pr-4">
                  <span className={`badge ${job.status === "COMPLETED" ? "bg-brand-100 text-brand-800" : job.status === "FAILED" ? "bg-red-100 text-red-800" : "bg-accent-500/20 text-accent-600"}`}>
                    {job.status}
                  </span>
                  {job.error && <span className="ml-2 text-xs text-red-700">{job.error}</span>}
                </td>
                <td className="py-2 pr-4 text-right">{job.itemsProcessed}</td>
                <td className="py-2 pr-4 text-right">{job.itemsCreated}</td>
                <td className="py-2 pr-4 text-right">{job.itemsUpdated}</td>
                <td className="py-2 text-right">{job.itemsFailed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
