import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatSek } from "@/components/ListingCard";
import { ContractStatusBadge } from "@/components/StatusBadges";

export const metadata = { title: "Mina avtal" };

export default async function MyContractsPage() {
  const user = await getCurrentUser();
  if (!user?.personId) redirect("/logga-in");

  const contracts = await prisma.contract.findMany({
    where: { parties: { some: { personId: user.personId } } },
    include: { unit: true, parties: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-stone-900">Mina avtal</h1>
        <p className="mt-1 text-stone-500">Alla dina hyresavtal – aktiva, historiska och sådana som väntar på signering.</p>
      </header>

      {contracts.length === 0 ? (
        <div className="card p-10 text-center text-stone-500">Du har inga avtal ännu.</div>
      ) : (
        <ul className="space-y-3">
          {contracts.map((contract) => {
            const needsMySignature =
              ["SENT_FOR_SIGNING", "PARTIALLY_SIGNED"].includes(contract.status) &&
              contract.parties.some((p) => p.personId === user.personId && !p.signedAt);
            return (
              <li key={contract.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-stone-900">
                    {contract.contractNumber} · {contract.unit.address}
                  </p>
                  <p className="text-sm text-stone-500">
                    {formatSek(contract.rent)} kr/mån · fr.o.m.{" "}
                    {new Date(contract.startDate).toLocaleDateString("sv-SE")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <ContractStatusBadge status={contract.status} />
                  <Link href={`/mina-sidor/avtal/${contract.id}`} className={needsMySignature ? "btn-primary" : "btn-secondary"}>
                    {needsMySignature ? "Signera" : "Visa"}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
