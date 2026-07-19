import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatSek } from "@/components/ListingCard";

export const metadata = { title: "Mitt boende" };

export default async function MyHousingPage() {
  const user = await getCurrentUser();
  if (!user?.personId) redirect("/logga-in");

  const contracts = await prisma.contract.findMany({
    where: {
      status: { in: ["ACTIVE", "TERMINATED"] },
      parties: { some: { personId: user.personId, role: { in: ["TENANT", "CO_TENANT"] } } },
    },
    include: {
      unit: { include: { property: true } },
      terminations: { where: { status: { notIn: ["CANCELLED"] } } },
    },
    orderBy: { startDate: "desc" },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-stone-900">Mitt boende</h1>
        <p className="mt-1 text-stone-500">Objekt du hyr av Östgöta El Teknik.</p>
      </header>

      {contracts.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-semibold text-stone-700">Du har inget registrerat boende hos oss ännu.</p>
          <p className="mt-1 text-sm text-stone-500">
            Sök bland våra lediga bostäder och skicka in en ansökan.
          </p>
          <Link href="/lediga-bostader" className="btn-primary mt-4">Sök bostad</Link>
        </div>
      ) : (
        contracts.map((contract) => {
          const { unit } = contract;
          return (
            <section key={contract.id} className="card p-6" aria-label={`Boende ${unit.address}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-stone-900">{unit.address}</h2>
                  <p className="text-sm text-stone-500">
                    {unit.postalCode} {unit.city} · {unit.property.name}
                  </p>
                </div>
                <span
                  className={`badge ${
                    contract.status === "ACTIVE" ? "bg-brand-50 text-brand-800" : "bg-accent-500/20 text-accent-600"
                  }`}
                >
                  {contract.status === "ACTIVE" ? "Aktivt avtal" : "Uppsagt"}
                </span>
              </div>
              <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                <div className="flex justify-between border-b border-stone-100 py-1.5">
                  <dt className="text-stone-500">Avtalsnummer</dt>
                  <dd className="font-medium">{contract.contractNumber}</dd>
                </div>
                <div className="flex justify-between border-b border-stone-100 py-1.5">
                  <dt className="text-stone-500">Objektsnummer</dt>
                  <dd className="font-medium">{unit.unitNumber}</dd>
                </div>
                {unit.rooms != null && (
                  <div className="flex justify-between border-b border-stone-100 py-1.5">
                    <dt className="text-stone-500">Antal rum</dt>
                    <dd className="font-medium">{Number(unit.rooms)}</dd>
                  </div>
                )}
                {unit.livingArea != null && (
                  <div className="flex justify-between border-b border-stone-100 py-1.5">
                    <dt className="text-stone-500">Boyta</dt>
                    <dd className="font-medium">{Number(unit.livingArea)} m²</dd>
                  </div>
                )}
                <div className="flex justify-between border-b border-stone-100 py-1.5">
                  <dt className="text-stone-500">Hyra</dt>
                  <dd className="font-medium">{formatSek(contract.rent)} kr/mån</dd>
                </div>
                <div className="flex justify-between border-b border-stone-100 py-1.5">
                  <dt className="text-stone-500">Inflyttning</dt>
                  <dd className="font-medium">{new Date(contract.startDate).toLocaleDateString("sv-SE")}</dd>
                </div>
                <div className="flex justify-between border-b border-stone-100 py-1.5">
                  <dt className="text-stone-500">Uppsägningstid</dt>
                  <dd className="font-medium">{contract.noticePeriodMonths} månader</dd>
                </div>
                {contract.terminationEffectiveDate && (
                  <div className="flex justify-between border-b border-stone-100 py-1.5">
                    <dt className="text-stone-500">Avtalet upphör</dt>
                    <dd className="font-medium text-red-700">
                      {new Date(contract.terminationEffectiveDate).toLocaleDateString("sv-SE")}
                    </dd>
                  </div>
                )}
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/mina-sidor/avtal/${contract.id}`} className="btn-secondary">Visa avtal</Link>
                <Link href={`/mina-sidor/felanmalan/ny?unit=${unit.id}`} className="btn-secondary">Felanmälan för bostaden</Link>
                <Link href="/mina-sidor/fakturor" className="btn-secondary">Fakturor</Link>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
