import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { formatSek } from "@/components/ListingCard";
import { getAdminDashboardMetrics } from "@/lib/repositories/admin-records";
import { hasPermission, type Action, type Resource } from "@/lib/permissions";
import { isOwnerAccount } from "@/lib/role-routing";

export const metadata = { title: "Admin – Dashboard" };

export default async function AdminDashboardPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect("/logga-in");
  const organizationId = user.organizationId;

  const metrics = await getAdminDashboardMetrics(organizationId);
  const {
    totalUnits, rentedUnits, availableUnits, upcomingUnits,
    publishedListings, activeApplications, contractsAwaitingSignature,
    overdueInvoices, activeMaintenanceRequests, urgentWorkOrders,
    upcomingMoveIns, upcomingMoveOuts, failedWebhooks, pendingReviewItems,
    failedSyncJobs, paidAmount,
  } = metrics;

  const occupancyRate = totalUnits > 0 ? Math.round((rentedUnits / totalUnits) * 100) : 0;
  const vacancyRate = 100 - occupancyRate;

  const cards: { label: string; value: string | number; href: string; alert?: boolean; permission: { resource: Resource; action: Action } }[] = [
    { label: "Totalt antal objekt", value: totalUnits, href: "/admin/objekt", permission: { resource: "units", action: "read" } },
    { label: "Uthyrda objekt", value: rentedUnits, href: "/admin/objekt?status=RENTED", permission: { resource: "units", action: "read" } },
    { label: "Lediga objekt", value: availableUnits, href: "/admin/objekt?status=PUBLISHED", permission: { resource: "units", action: "read" } },
    { label: "Kommande lediga", value: upcomingUnits, href: "/admin/objekt?status=UPCOMING", permission: { resource: "units", action: "read" } },
    { label: "Publicerade annonser", value: publishedListings, href: "/admin/annonser", permission: { resource: "listings", action: "read" } },
    { label: "Pågående ansökningar", value: activeApplications, href: "/admin/ansokningar", permission: { resource: "applications", action: "read" } },
    { label: "Avtal som väntar på signering", value: contractsAwaitingSignature, href: "/admin/avtal?status=SENT_FOR_SIGNING", permission: { resource: "contracts", action: "read" } },
    { label: "Förfallna fakturor", value: overdueInvoices, href: "/admin/fakturor?status=OVERDUE", alert: overdueInvoices > 0, permission: { resource: "invoices", action: "read" } },
    { label: "Aktiva felanmälningar", value: activeMaintenanceRequests, href: "/admin/felanmalan", permission: { resource: "maintenance", action: "read" } },
    { label: "Akuta arbetsorder", value: urgentWorkOrders, href: "/admin/arbetsorder", alert: urgentWorkOrders > 0, permission: { resource: "workorders", action: "read" } },
    { label: "Inflyttningar (30 dgr)", value: upcomingMoveIns, href: "/admin/avtal", permission: { resource: "contracts", action: "read" } },
    { label: "Utflyttningar (30 dgr)", value: upcomingMoveOuts, href: "/admin/uppsagningar", permission: { resource: "terminations", action: "read" } },
    { label: "Uthyrningsgrad", value: `${occupancyRate} %`, href: "/admin/rapporter", permission: { resource: "reports", action: "read" } },
    { label: "Vakansgrad", value: `${vacancyRate} %`, href: "/admin/rapporter", permission: { resource: "reports", action: "read" } },
    { label: "Inbetalt (externt ekonomisystem)", value: `${formatSek(paidAmount ?? 0)} kr`, href: "/admin/fakturor", permission: { resource: "invoices", action: "read" } },
    { label: "Misslyckade webhooks", value: failedWebhooks, href: "/admin/webhooks", alert: failedWebhooks > 0, permission: { resource: "webhooks", action: "read" } },
    { label: "Synkfel / granskningskö", value: `${failedSyncJobs} / ${pendingReviewItems}`, href: "/admin/integrationer", alert: pendingReviewItems > 0, permission: { resource: "integrations", action: "read" } },
  ];
  const visibleCards = cards.filter((card) =>
    hasPermission(user.permissions, card.permission.resource, card.permission.action)
  );
  const owner = isOwnerAccount(user.roleSlugs);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">
            {owner ? "Ägarens dashboard" : "Fastighetsvärdens dashboard"}
          </h1>
          <p className="mt-1 text-stone-500">Läget just nu i FaddeBos bestånd.</p>
        </div>
        <div className="flex gap-2">
          {hasPermission(user.permissions, "contracts", "create") && (
            <Link href="/admin/hyresgaster/ny" className="btn-primary">Lägg till befintlig hyresgäst</Link>
          )}
          {hasPermission(user.permissions, "listings", "read") && (
            <Link href="/admin/annonser" className="btn-secondary">Annonser</Link>
          )}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visibleCards.map((card) => (
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
