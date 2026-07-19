import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { formatSek } from "@/components/ListingCard";

export const metadata = { title: "Admin – Rapporter" };

export default async function AdminReportsPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId || !hasPermission(user.permissions, "reports", "read")) {
    redirect("/admin");
  }
  const organizationId = user.organizationId;

  const [
    unitsByStatus, applicationsByStatus, invoiceAgg, overdueAgg,
    maintenanceByStatus, workOrderCosts, moveIns, moveOuts, listingStats,
  ] = await Promise.all([
    db.unit.groupBy({ by: ["status"], where: { organizationId }, _count: true }),
    db.application.groupBy({ by: ["status"], where: { organizationId }, _count: true }),
    db.invoice.aggregate({
      where: { organizationId, isCreditNote: false },
      _sum: { totalAmount: true, paidAmount: true },
      _count: true,
    }),
    db.invoice.aggregate({
      where: { organizationId, status: { in: ["OVERDUE", "REMINDED", "COLLECTION"] } },
      _sum: { totalAmount: true, paidAmount: true },
      _count: true,
    }),
    db.maintenanceRequest.groupBy({ by: ["status"], where: { organizationId }, _count: true }),
    db.workOrder.aggregate({ where: { organizationId }, _sum: { cost: true }, _count: true }),
    db.contract.count({
      where: { organizationId, status: { in: ["SIGNED", "ACTIVE"] }, startDate: { gte: new Date(Date.now() - 90 * 24 * 3600 * 1000) } },
    }),
    db.termination.count({
      where: { organizationId, requestedAt: { gte: new Date(Date.now() - 90 * 24 * 3600 * 1000) } },
    }),
    db.listing.aggregate({ where: { organizationId }, _count: true }),
  ]);

  const totalUnits = unitsByStatus.reduce((s, u) => s + u._count, 0);
  const rented = unitsByStatus.find((u) => u.status === "RENTED")?._count ?? 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-stone-900">Rapporter</h1>
        <a href="/admin/rapporter/export" className="btn-secondary" download>
          Exportera CSV
        </a>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="uthyrning" className="card p-5">
          <h2 id="uthyrning" className="font-semibold text-stone-900">Uthyrning & vakans</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between border-b border-stone-100 py-1.5">
              <dt className="text-stone-500">Totalt antal objekt</dt>
              <dd className="font-medium">{totalUnits}</dd>
            </div>
            <div className="flex justify-between border-b border-stone-100 py-1.5">
              <dt className="text-stone-500">Uthyrningsgrad</dt>
              <dd className="font-medium">{totalUnits ? Math.round((rented / totalUnits) * 100) : 0} %</dd>
            </div>
            <div className="flex justify-between border-b border-stone-100 py-1.5">
              <dt className="text-stone-500">Inflyttningar (90 dgr)</dt>
              <dd className="font-medium">{moveIns}</dd>
            </div>
            <div className="flex justify-between border-b border-stone-100 py-1.5">
              <dt className="text-stone-500">Uppsägningar (90 dgr)</dt>
              <dd className="font-medium">{moveOuts}</dd>
            </div>
            <div className="flex justify-between py-1.5">
              <dt className="text-stone-500">Annonser totalt</dt>
              <dd className="font-medium">{listingStats._count}</dd>
            </div>
          </dl>
          <h3 className="mt-4 text-sm font-semibold text-stone-700">Objekt per status</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {unitsByStatus.map((u) => (
              <li key={u.status} className="flex justify-between">
                <span className="text-stone-500">{u.status}</span>
                <span className="font-medium">{u._count}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="ekonomi" className="card p-5">
          <h2 id="ekonomi" className="font-semibold text-stone-900">Ekonomi (extern reskontra)</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between border-b border-stone-100 py-1.5">
              <dt className="text-stone-500">Antal fakturor</dt>
              <dd className="font-medium">{invoiceAgg._count}</dd>
            </div>
            <div className="flex justify-between border-b border-stone-100 py-1.5">
              <dt className="text-stone-500">Fakturerat totalt</dt>
              <dd className="font-medium">{formatSek(invoiceAgg._sum.totalAmount ?? 0)} kr</dd>
            </div>
            <div className="flex justify-between border-b border-stone-100 py-1.5">
              <dt className="text-stone-500">Inbetalt totalt</dt>
              <dd className="font-medium">{formatSek(invoiceAgg._sum.paidAmount ?? 0)} kr</dd>
            </div>
            <div className="flex justify-between border-b border-stone-100 py-1.5">
              <dt className="text-stone-500">Förfallet ({overdueAgg._count} fakturor)</dt>
              <dd className="font-medium text-red-700">
                {formatSek(Number(overdueAgg._sum.totalAmount ?? 0) - Number(overdueAgg._sum.paidAmount ?? 0))} kr
              </dd>
            </div>
            <div className="flex justify-between py-1.5">
              <dt className="text-stone-500">Arbetsorderkostnader ({workOrderCosts._count} order)</dt>
              <dd className="font-medium">{formatSek(workOrderCosts._sum.cost ?? 0)} kr</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="ansokningsrapport" className="card p-5">
          <h2 id="ansokningsrapport" className="font-semibold text-stone-900">Ansökningar per status</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {applicationsByStatus.length === 0 && <li className="text-stone-500">Inga ansökningar.</li>}
            {applicationsByStatus.map((a) => (
              <li key={a.status} className="flex justify-between">
                <span className="text-stone-500">{a.status}</span>
                <span className="font-medium">{a._count}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="felrapport" className="card p-5">
          <h2 id="felrapport" className="font-semibold text-stone-900">Felanmälningar per status</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {maintenanceByStatus.length === 0 && <li className="text-stone-500">Inga felanmälningar.</li>}
            {maintenanceByStatus.map((m) => (
              <li key={m.status} className="flex justify-between">
                <span className="text-stone-500">{m.status}</span>
                <span className="font-medium">{m._count}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
