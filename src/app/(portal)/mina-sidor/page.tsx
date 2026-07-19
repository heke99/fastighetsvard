import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatSek } from "@/components/ListingCard";

export const metadata = { title: "Mina sidor" };

export default async function PortalOverviewPage() {
  const user = await getCurrentUser();
  if (!user?.personId) redirect("/logga-in?next=/mina-sidor");
  const personId = user.personId;

  const [activeContracts, unpaidInvoices, activeRequests, applications, pendingOffers, unsignedContracts, unreadMessages, notifications, favoritesCount, savedSearchesCount, upcomingViewings] =
    await Promise.all([
      db.contract.findMany({
        where: {
          status: "ACTIVE",
          parties: { some: { personId, role: { in: ["TENANT", "CO_TENANT"] } } },
        },
        include: { unit: true },
      }),
      db.invoice.findMany({
        where: {
          personId,
          status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE", "REMINDED"] },
        },
        orderBy: { dueDate: "asc" },
        take: 5,
      }),
      db.maintenanceRequest.findMany({
        where: { personId, status: { notIn: ["CLOSED", "REJECTED"] } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      db.application.findMany({
        where: {
          members: { some: { personId } },
          status: { notIn: ["CLOSED", "WITHDRAWN"] },
        },
        include: { listing: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      db.offer.findMany({
        where: { personId, status: "SENT", expiresAt: { gte: new Date() } },
        include: { listing: true },
      }),
      db.contract.findMany({
        where: {
          status: { in: ["SENT_FOR_SIGNING", "PARTIALLY_SIGNED"] },
          parties: { some: { personId, signedAt: null } },
        },
        include: { unit: true },
      }),
      db.message.count({ where: { recipientPersonId: personId, readAt: null } }),
      db.notification.findMany({
        where: { personId, readAt: null },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      db.favorite.count({ where: { personId } }),
      db.savedSearch.count({ where: { personId } }),
      db.viewingAttendee.findMany({
        where: { personId, status: "BOOKED", viewing: { startsAt: { gte: new Date() } } },
        include: { viewing: { include: { listing: true } } },
        take: 3,
      }),
    ]);

  const firstName = user.person?.firstName ?? "";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-stone-900">Hej {firstName}!</h1>
        <p className="mt-1 text-stone-500">Här är en översikt över ditt boende och dina ärenden.</p>
      </header>

      {/* Kräver åtgärd */}
      {(pendingOffers.length > 0 || unsignedContracts.length > 0) && (
        <section aria-labelledby="atgard" className="space-y-3">
          <h2 id="atgard" className="text-lg font-semibold text-stone-900">Kräver din åtgärd</h2>
          {pendingOffers.map((offer) => (
            <div key={offer.id} className="card flex flex-col gap-3 border-l-4 border-l-accent-500 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-stone-900">Erbjudande: {offer.listing.title}</p>
                <p className="text-sm text-stone-500">
                  Svara senast {new Date(offer.expiresAt).toLocaleDateString("sv-SE")}
                </p>
              </div>
              <Link href="/mina-sidor/ansokningar" className="btn-accent shrink-0">Svara på erbjudandet</Link>
            </div>
          ))}
          {unsignedContracts.map((contract) => (
            <div key={contract.id} className="card flex flex-col gap-3 border-l-4 border-l-brand-600 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-stone-900">Avtal att signera: {contract.contractNumber}</p>
                <p className="text-sm text-stone-500">{contract.unit.address}, {contract.unit.city}</p>
              </div>
              <Link href={`/mina-sidor/avtal/${contract.id}`} className="btn-primary shrink-0">Öppna och signera</Link>
            </div>
          ))}
        </section>
      )}

      {/* Nyckeltal */}
      <section aria-label="Sammanfattning" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/mina-sidor/boende" className="card p-4 transition hover:shadow-md">
          <p className="text-sm text-stone-500">Nuvarande boende</p>
          <p className="mt-1 text-xl font-bold text-stone-900">
            {activeContracts.length > 0 ? activeContracts[0].unit.address : "Inget aktivt avtal"}
          </p>
          {activeContracts.length > 1 && (
            <p className="text-xs text-stone-500">+{activeContracts.length - 1} fler avtal</p>
          )}
        </Link>
        <Link href="/mina-sidor/fakturor" className="card p-4 transition hover:shadow-md">
          <p className="text-sm text-stone-500">Obetalda fakturor</p>
          <p className={`mt-1 text-xl font-bold ${unpaidInvoices.length > 0 ? "text-red-700" : "text-stone-900"}`}>
            {unpaidInvoices.length} st
          </p>
          {unpaidInvoices[0] && (
            <p className="text-xs text-stone-500">
              Nästa förfaller {new Date(unpaidInvoices[0].dueDate).toLocaleDateString("sv-SE")}
            </p>
          )}
        </Link>
        <Link href="/mina-sidor/felanmalan" className="card p-4 transition hover:shadow-md">
          <p className="text-sm text-stone-500">Aktiva felanmälningar</p>
          <p className="mt-1 text-xl font-bold text-stone-900">{activeRequests.length} st</p>
        </Link>
        <Link href="/mina-sidor/ansokningar" className="card p-4 transition hover:shadow-md">
          <p className="text-sm text-stone-500">Pågående ansökningar</p>
          <p className="mt-1 text-xl font-bold text-stone-900">{applications.length} st</p>
        </Link>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Nästa faktura */}
        <section aria-labelledby="fakturor" className="card p-5">
          <div className="flex items-center justify-between">
            <h2 id="fakturor" className="font-semibold text-stone-900">Fakturor</h2>
            <Link href="/mina-sidor/fakturor" className="text-sm font-medium text-brand-700 hover:underline">Visa alla</Link>
          </div>
          {unpaidInvoices.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">Du har inga obetalda fakturor. Bra jobbat!</p>
          ) : (
            <ul className="mt-3 divide-y divide-stone-100">
              {unpaidInvoices.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span>
                    <span className="font-medium text-stone-900">{inv.invoiceNumber}</span>
                    <span className="ml-2 text-stone-500">
                      förfaller {new Date(inv.dueDate).toLocaleDateString("sv-SE")}
                    </span>
                  </span>
                  <span className="font-semibold text-stone-900">
                    {formatSek(Number(inv.totalAmount) - Number(inv.paidAmount))} kr
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Meddelanden och notiser */}
        <section aria-labelledby="handelser" className="card p-5">
          <div className="flex items-center justify-between">
            <h2 id="handelser" className="font-semibold text-stone-900">
              Händelser {unreadMessages > 0 && <span className="badge ml-1 bg-brand-700 text-white">{unreadMessages} olästa</span>}
            </h2>
            <Link href="/mina-sidor/meddelanden" className="text-sm font-medium text-brand-700 hover:underline">Meddelanden</Link>
          </div>
          {notifications.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">Inga nya händelser.</p>
          ) : (
            <ul className="mt-3 divide-y divide-stone-100">
              {notifications.map((n) => (
                <li key={n.id} className="py-2.5 text-sm">
                  <p className="font-medium text-stone-900">{n.title}</p>
                  <p className="text-stone-500">{n.body}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Kommande visningar */}
      {upcomingViewings.length > 0 && (
        <section aria-labelledby="visningar" className="card p-5">
          <h2 id="visningar" className="font-semibold text-stone-900">Kommande visningar</h2>
          <ul className="mt-3 divide-y divide-stone-100">
            {upcomingViewings.map((va) => (
              <li key={va.id} className="py-2.5 text-sm">
                <p className="font-medium text-stone-900">{va.viewing.listing.title}</p>
                <p className="text-stone-500">
                  {new Date(va.viewing.startsAt).toLocaleString("sv-SE", { dateStyle: "full", timeStyle: "short" })}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Genvägar */}
      <section aria-label="Genvägar" className="grid gap-4 sm:grid-cols-3">
        <Link href="/mina-sidor/felanmalan/ny" className="btn-primary justify-center">Gör felanmälan</Link>
        <Link href="/lediga-bostader" className="btn-secondary justify-center">Sök bostad ({favoritesCount} favoriter)</Link>
        <Link href="/mina-sidor/bevakningar" className="btn-secondary justify-center">Bevakningar ({savedSearchesCount})</Link>
      </section>
    </div>
  );
}
