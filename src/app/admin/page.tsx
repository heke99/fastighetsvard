import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatSek } from "@/components/ListingCard";

export const metadata = { title: "Admin – Dashboard" };

export default async function AdminDashboardPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect("/logga-in");
  const organizationId = user.organizationId;

  const now = new Date();
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const [
    totalUnits, rentedUnits, availableUnits, upcomingUnits, forSaleUnits,
    publishedListings, activeApplications, contractsAwaitingSignature,
    overdueInvoices, activeMaintenanceRequests, urgentWorkOrders,
    upcomingMoveIns, upcomingMoveOuts, failedWebhooks, pendingReviewItems,
    failedSyncJobs, invoiceSums,
  ] = await Promise.all([
    prisma.unit.count({ where: { organizationId } }),
    prisma.unit.count({ where: { organizationId, status: "RENTED" } }),
    prisma.unit.count({ where: { organizationId, status: { in: ["PUBLISHED", "APPLICATION_OPEN"] } } }),
    prisma.unit.count({ where: { organizationId, status: "UPCOMING" } }),
    prisma.unit.count({ where: { organizationId, status: { in: ["FOR_SALE", "BIDDING"] } } }),
    prisma.listing.count({ where: { organizationId, status: "PUBLISHED" } }),
    prisma.application.count({
      where: { organizationId, status: { notIn: ["CLOSED", "WITHDRAWN", "DECLINED"] } },
    }),
    prisma.contract.count({
      where: { organizationId, status: { in: ["SENT_FOR_SIGNING", "PARTIALLY_SIGNED"] } },
    }),
    prisma.invoice.count({
      where: { organizationId, status: { in: ["OVERDUE", "REMINDED", "COLLECTION"] } },
    }),
    prisma.maintenanceRequest.count({
      where: { organizationId, status: { notIn: ["CLOSED", "REJECTED"] } },
    }),
    prisma.workOrder.count({
      where: { organizationId, priority: "URGENT", status: { notIn: ["DONE", "APPROVED", "INVOICED", "CANCELLED"] } },
    }),
    prisma.contract.count({
      where: { organizationId, status: { in: ["SIGNED", "ACTIVE"] }, startDate: { gte: now, lte: in30Days } },
    }),
    prisma.termination.count({
      where: { organizationId, effectiveEndDate: { gte: now, lte: in30Days }, status: { not: "CANCELLED" } },
    }),
    prisma.webhookDelivery.count({
      where: { organizationId, status: { in: ["FAILED", "DEAD_LETTER"] } },
    }),
    prisma.syncReviewItem.count({ where: { organizationId, status: "PENDING" } }),
    prisma.integrationSyncJob.count({ where: { organizationId, status: "FAILED" } }),
    prisma.invoice.aggregate({
      where: { organizationId, isCreditNote: false },
      _sum: { paidAmount: true },
    }),
  ]);

  const occupancyRate = totalUnits > 0 ? Math.round((rentedUnits / totalUnits) * 100) : 0;
  const vacancyRate = 100 - occupancyRate;

  const cards: { label: string; value: string | number; href: string; alert?: boolean }[] = [
    { label: "Totalt antal objekt", value: totalUnits, href: "/admin/objekt" },
    { label: "Uthyrda objekt", value: rentedUnits, href: "/admin/objekt?status=RENTED" },
    { label: "Lediga objekt", value: availableUnits, href: "/admin/objekt?status=PUBLISHED" },
    { label: "Kommande lediga", value: upcomingUnits, href: "/admin/objekt?status=UPCOMING" },
    { label: "Till salu", value: forSaleUnits, href: "/admin/objekt?status=FOR_SALE" },
    { label: "Publicerade annonser", value: publishedListings, href: "/admin/annonser" },
    { label: "Pågående ansökningar", value: activeApplications, href: "/admin/ansokningar" },
    { label: "Avtal som väntar på signering", value: contractsAwaitingSignature, href: "/admin/avtal?status=SENT_FOR_SIGNING" },
    { label: "Förfallna fakturor", value: overdueInvoices, href: "/admin/fakturor?status=OVERDUE", alert: overdueInvoices > 0 },
    { label: "Aktiva felanmälningar", value: activeMaintenanceRequests, href: "/admin/felanmalan" },
    { label: "Akuta arbetsorder", value: urgentWorkOrders, href: "/admin/arbetsorder", alert: urgentWorkOrders > 0 },
    { label: "Inflyttningar (30 dgr)", value: upcomingMoveIns, href: "/admin/avtal" },
    { label: "Utflyttningar (30 dgr)", value: upcomingMoveOuts, href: "/admin/uppsagningar" },
    { label: "Uthyrningsgrad", value: `${occupancyRate} %`, href: "/admin/rapporter" },
    { label: "Vakansgrad", value: `${vacancyRate} %`, href: "/admin/rapporter" },
    { label: "Inbetalt (externt ekonomisystem)", value: `${formatSek(invoiceSums._sum.paidAmount ?? 0)} kr`, href: "/admin/fakturor" },
    { label: "Misslyckade webhooks", value: failedWebhooks, href: "/admin/webhooks", alert: failedWebhooks > 0 },
    { label: "Synkfel / granskningskö", value: `${failedSyncJobs} / ${pendingReviewItems}`, href: "/admin/integrationer", alert: pendingReviewItems > 0 },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Dashboard</h1>
          <p className="mt-1 text-stone-500">Läget just nu i beståndet.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/hyresgaster/ny" className="btn-primary">Lägg till befintlig hyresgäst</Link>
          <Link href="/admin/annonser" className="btn-secondary">Annonser</Link>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className={`card p-4 transition hover:shadow-md ${card.alert ? "border-l-4 border-l-red-500" : ""}`}
          >
            <p className="text-sm text-stone-500">{card.label}</p>
            <p className={`mt-1 text-2xl font-bold ${card.alert ? "text-red-700" : "text-stone-900"}`}>
              {card.value}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
