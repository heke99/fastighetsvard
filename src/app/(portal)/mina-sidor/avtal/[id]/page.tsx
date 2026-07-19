import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatSek } from "@/components/ListingCard";
import { ContractStatusBadge } from "@/components/StatusBadges";
import { calculateEarliestEndDate } from "@/lib/services/contracts";
import { SignContractForm, TerminateContractForm } from "./forms";

export const metadata = { title: "Avtal" };

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.personId) redirect("/logga-in");
  const { id } = await params;

  // Tenant-isolering: endast avtal där personen är part.
  const contract = await db.contract.findFirst({
    where: { id, parties: { some: { personId: user.personId } } },
    include: {
      unit: { include: { property: true } },
      parties: { include: { person: true } },
      versions: { orderBy: { versionNumber: "desc" } },
      documents: true,
      statusHistory: { orderBy: { createdAt: "desc" }, take: 10 },
      terminations: { where: { status: { not: "CANCELLED" } } },
    },
  });
  if (!contract) notFound();

  const myParty = contract.parties.find((p) => p.personId === user.personId);
  const canSign =
    ["SENT_FOR_SIGNING", "PARTIALLY_SIGNED"].includes(contract.status) &&
    myParty &&
    !myParty.signedAt;
  const canTerminate =
    contract.status === "ACTIVE" &&
    myParty &&
    ["TENANT", "CO_TENANT"].includes(myParty.role) &&
    contract.terminations.length === 0;
  const earliestEnd = calculateEarliestEndDate(contract.noticePeriodMonths);

  return (
    <div className="space-y-6">
      <nav aria-label="Brödsmulor" className="text-sm text-stone-500">
        <Link href="/mina-sidor/avtal" className="hover:text-brand-700">← Mina avtal</Link>
      </nav>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Avtal {contract.contractNumber}</h1>
          <p className="mt-1 text-stone-500">
            {contract.unit.address}, {contract.unit.city} · {contract.unit.property.name}
          </p>
        </div>
        <ContractStatusBadge status={contract.status} />
      </header>

      {canSign && (
        <section aria-labelledby="signera" className="card border-l-4 border-l-brand-600 p-5">
          <h2 id="signera" className="font-semibold text-stone-900">Avtalet väntar på din signering</h2>
          <p className="mt-1 text-sm text-stone-600">
            Läs igenom avtalsvillkoren nedan. Genom att signera bekräftar du att du
            accepterar villkoren.
          </p>
          <SignContractForm contractId={contract.id} />
        </section>
      )}

      <section aria-labelledby="villkor" className="card p-5">
        <h2 id="villkor" className="font-semibold text-stone-900">Avtalsvillkor</h2>
        <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between border-b border-stone-100 py-1.5">
            <dt className="text-stone-500">Avtalstyp</dt>
            <dd className="font-medium">{contract.type === "RESIDENTIAL" ? "Bostad" : contract.type === "PARKING" ? "Parkering" : contract.type === "STORAGE" ? "Förråd" : contract.type}</dd>
          </div>
          <div className="flex justify-between border-b border-stone-100 py-1.5">
            <dt className="text-stone-500">Hyra</dt>
            <dd className="font-medium">{formatSek(contract.rent)} kr/mån</dd>
          </div>
          <div className="flex justify-between border-b border-stone-100 py-1.5">
            <dt className="text-stone-500">Startdatum</dt>
            <dd className="font-medium">{new Date(contract.startDate).toLocaleDateString("sv-SE")}</dd>
          </div>
          <div className="flex justify-between border-b border-stone-100 py-1.5">
            <dt className="text-stone-500">Slutdatum</dt>
            <dd className="font-medium">
              {contract.endDate ? new Date(contract.endDate).toLocaleDateString("sv-SE") : "Tillsvidare"}
            </dd>
          </div>
          <div className="flex justify-between border-b border-stone-100 py-1.5">
            <dt className="text-stone-500">Uppsägningstid</dt>
            <dd className="font-medium">{contract.noticePeriodMonths} månader</dd>
          </div>
          {contract.deposit != null && (
            <div className="flex justify-between border-b border-stone-100 py-1.5">
              <dt className="text-stone-500">Deposition</dt>
              <dd className="font-medium">{formatSek(contract.deposit)} kr</dd>
            </div>
          )}
          {contract.invoiceReference && (
            <div className="flex justify-between border-b border-stone-100 py-1.5">
              <dt className="text-stone-500">Fakturareferens</dt>
              <dd className="font-medium">{contract.invoiceReference}</dd>
            </div>
          )}
        </dl>
      </section>

      <section aria-labelledby="parter" className="card p-5">
        <h2 id="parter" className="font-semibold text-stone-900">Avtalsparter</h2>
        <ul className="mt-3 divide-y divide-stone-100 text-sm">
          {contract.parties.map((party) => (
            <li key={party.id} className="flex items-center justify-between py-2.5">
              <span>
                <span className="font-medium text-stone-900">
                  {party.person.firstName} {party.person.lastName}
                </span>
                <span className="ml-2 text-stone-500">
                  {party.role === "LANDLORD" ? "Hyresvärd" : party.role === "TENANT" ? "Hyresgäst" : party.role === "CO_TENANT" ? "Medhyresgäst" : "Borgensman"}
                </span>
              </span>
              {party.signedAt ? (
                <span className="badge bg-brand-100 text-brand-800">
                  Signerad {new Date(party.signedAt).toLocaleDateString("sv-SE")}
                </span>
              ) : (
                <span className="badge bg-stone-100 text-stone-600">Ej signerad</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {contract.documents.length > 0 && (
        <section aria-labelledby="dokument" className="card p-5">
          <h2 id="dokument" className="font-semibold text-stone-900">Dokument</h2>
          <ul className="mt-3 divide-y divide-stone-100 text-sm">
            {contract.documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between py-2.5">
                <span className="font-medium text-stone-900">{doc.title}</span>
                <span className="text-stone-500">v{doc.version}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canTerminate && (
        <section aria-labelledby="uppsagning" className="card border-l-4 border-l-orange-400 p-5">
          <h2 id="uppsagning" className="font-semibold text-stone-900">Säg upp avtalet</h2>
          <p className="mt-1 text-sm text-stone-600">
            Din uppsägningstid är {contract.noticePeriodMonths} månader. Tidigaste
            möjliga slutdatum är{" "}
            <strong>{earliestEnd.toLocaleDateString("sv-SE")}</strong>. Efter
            uppsägningen bokar vi förbesiktning och slutbesiktning, och du får
            information om nyckelåterlämning och slutfaktura.
          </p>
          <TerminateContractForm
            contractId={contract.id}
            earliestEndDate={earliestEnd.toISOString().slice(0, 10)}
          />
        </section>
      )}

      {contract.terminations.length > 0 && (
        <section aria-labelledby="uppsagningsinfo" className="card p-5">
          <h2 id="uppsagningsinfo" className="font-semibold text-stone-900">Uppsägning</h2>
          {contract.terminations.map((t) => (
            <dl key={t.id} className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <div className="flex justify-between border-b border-stone-100 py-1.5">
                <dt className="text-stone-500">Begärd</dt>
                <dd className="font-medium">{new Date(t.requestedAt).toLocaleDateString("sv-SE")}</dd>
              </div>
              <div className="flex justify-between border-b border-stone-100 py-1.5">
                <dt className="text-stone-500">Avtalet upphör</dt>
                <dd className="font-medium">
                  {t.effectiveEndDate ? new Date(t.effectiveEndDate).toLocaleDateString("sv-SE") : "–"}
                </dd>
              </div>
              {t.isInternalTransfer && (
                <div className="flex justify-between border-b border-stone-100 py-1.5 sm:col-span-2">
                  <dt className="text-stone-500">Typ</dt>
                  <dd className="font-medium">Intern omflyttning</dd>
                </div>
              )}
            </dl>
          ))}
        </section>
      )}
    </div>
  );
}
