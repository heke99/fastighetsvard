import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import {
  redeliverWebhookAction,
  toggleSubscriptionAction,
  processWebhookQueueAction,
} from "../actions";

export const metadata = { title: "Admin – Webhooks" };

export default async function AdminWebhooksPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId || !hasPermission(user.permissions, "webhooks", "read")) {
    redirect("/admin");
  }

  const [subscriptions, deliveries, inboundEvents] = await Promise.all([
    db.webhookSubscription.findMany({
      where: { organizationId: user.organizationId },
      include: { _count: { select: { deliveries: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.webhookDelivery.findMany({
      where: { organizationId: user.organizationId },
      include: { subscription: { select: { url: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    db.inboundWebhookEvent.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const canUpdate = hasPermission(user.permissions, "webhooks", "update");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-stone-900">Webhooks</h1>
        {canUpdate && (
          <form action={processWebhookQueueAction}>
            <button type="submit" className="btn-secondary">Processa leveranskön nu</button>
          </form>
        )}
      </header>

      <section aria-labelledby="prenumerationer" className="card p-5">
        <h2 id="prenumerationer" className="font-semibold text-stone-900">Utgående prenumerationer</h2>
        <p className="mt-1 text-sm text-stone-500">
          Skapas via API:t (<code className="rounded bg-stone-100 px-1">POST /api/v1/webhook-subscriptions</code>).
          Leveranser signeras med HMAC (header <code className="rounded bg-stone-100 px-1">X-OET-Signature</code>).
        </p>
        {subscriptions.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">Inga prenumerationer.</p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-100">
            {subscriptions.map((sub) => (
              <li key={sub.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-stone-900">{sub.url}</p>
                  <p className="text-xs text-stone-500">
                    {sub.events.join(", ")} · {sub._count.deliveries} leveranser
                    {sub.disabledReason && <span className="ml-1 text-red-700">· {sub.disabledReason}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${sub.isActive ? "bg-brand-100 text-brand-800" : "bg-red-100 text-red-800"}`}>
                    {sub.isActive ? "Aktiv" : "Avstängd"}
                  </span>
                  {canUpdate && (
                    <form action={toggleSubscriptionAction}>
                      <input type="hidden" name="subscriptionId" value={sub.id} />
                      <button type="submit" className="rounded border border-stone-300 px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100">
                        {sub.isActive ? "Stäng av" : "Aktivera"}
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="leveranser" className="card overflow-x-auto p-5">
        <h2 id="leveranser" className="font-semibold text-stone-900">Leveranslogg (utgående)</h2>
        <table className="mt-3 w-full min-w-[760px] text-sm">
          <caption className="sr-only">Webhookleveranser</caption>
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
              <th scope="col" className="py-2 pr-4">Händelse</th>
              <th scope="col" className="py-2 pr-4">Mottagare</th>
              <th scope="col" className="py-2 pr-4">Status</th>
              <th scope="col" className="py-2 pr-4 text-right">Försök</th>
              <th scope="col" className="py-2 pr-4">Senaste svar</th>
              <th scope="col" className="py-2">Åtgärd</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {deliveries.length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-stone-500">Inga leveranser.</td></tr>
            )}
            {deliveries.map((d) => (
              <tr key={d.id}>
                <td className="py-2 pr-4 font-medium text-stone-900">{d.eventType}</td>
                <td className="max-w-52 truncate py-2 pr-4">{d.subscription.url}</td>
                <td className="py-2 pr-4">
                  <span className={`badge ${
                    d.status === "DELIVERED" ? "bg-brand-100 text-brand-800"
                    : d.status === "DEAD_LETTER" ? "bg-red-200 text-red-900"
                    : d.status === "FAILED" ? "bg-red-100 text-red-800"
                    : "bg-accent-500/20 text-accent-600"
                  }`}>
                    {d.status}
                  </span>
                </td>
                <td className="py-2 pr-4 text-right">{d.attempts}</td>
                <td className="py-2 pr-4 text-xs text-stone-500">
                  {d.lastStatusCode ?? "–"} {d.lastError ? `· ${d.lastError}` : ""}
                </td>
                <td className="py-2">
                  {canUpdate && ["FAILED", "DEAD_LETTER"].includes(d.status) && (
                    <form action={redeliverWebhookAction}>
                      <input type="hidden" name="deliveryId" value={d.id} />
                      <button type="submit" className="rounded border border-stone-300 px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100">
                        Återleverera
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="inkommande" className="card overflow-x-auto p-5">
        <h2 id="inkommande" className="font-semibold text-stone-900">Inkommande events (bokföring)</h2>
        <table className="mt-3 w-full min-w-[680px] text-sm">
          <caption className="sr-only">Inkommande webhookevents</caption>
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
              <th scope="col" className="py-2 pr-4">Mottaget</th>
              <th scope="col" className="py-2 pr-4">Provider</th>
              <th scope="col" className="py-2 pr-4">Event-ID</th>
              <th scope="col" className="py-2 pr-4">Typ</th>
              <th scope="col" className="py-2">Resultat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {inboundEvents.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-stone-500">Inga inkommande events.</td></tr>
            )}
            {inboundEvents.map((e) => (
              <tr key={e.id}>
                <td className="py-2 pr-4">{new Date(e.createdAt).toLocaleString("sv-SE")}</td>
                <td className="py-2 pr-4">{e.provider}</td>
                <td className="py-2 pr-4 font-mono text-xs">{e.eventId}</td>
                <td className="py-2 pr-4">{e.eventType}</td>
                <td className="py-2">
                  {e.processingError ? (
                    <span className="badge bg-red-100 text-red-800">Fel: {e.processingError}</span>
                  ) : e.processedAt ? (
                    <span className="badge bg-brand-100 text-brand-800">Processad</span>
                  ) : (
                    <span className="badge bg-accent-500/20 text-accent-600">Väntar</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
