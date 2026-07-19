import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { ContractStatusBadge } from "@/components/StatusBadges";
import { changeContractStatusAction } from "../actions";
import { contractTransitions } from "@/lib/state-machines";
import { formatSek } from "@/components/ListingCard";
import type { ContractStatus } from "@prisma/client";

export const metadata = { title: "Admin – Avtal" };

export default async function AdminContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.organizationId || !hasPermission(user.permissions, "contracts", "read")) {
    redirect("/admin");
  }
  const { status } = await searchParams;

  const contracts = await prisma.contract.findMany({
    where: {
      organizationId: user.organizationId,
      ...(status ? { status: status as ContractStatus } : {}),
    },
    include: {
      unit: { select: { unitNumber: true, address: true } },
      parties: { include: { person: true } },
      externalReferences: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const canUpdate = hasPermission(user.permissions, "contracts", "update");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-stone-900">Avtal</h1>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <caption className="sr-only">Avtal</caption>
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
              <th scope="col" className="px-4 py-3">Avtalsnr</th>
              <th scope="col" className="px-4 py-3">Objekt</th>
              <th scope="col" className="px-4 py-3">Hyresgäst</th>
              <th scope="col" className="px-4 py-3 text-right">Hyra</th>
              <th scope="col" className="px-4 py-3">Start</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3">Åtgärder</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {contracts.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-stone-500">Inga avtal.</td></tr>
            )}
            {contracts.map((c) => {
              const tenants = c.parties
                .filter((p) => ["TENANT", "CO_TENANT"].includes(p.role))
                .map((p) => `${p.person.firstName} ${p.person.lastName}`)
                .join(", ");
              return (
                <tr key={c.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 font-medium text-stone-900">
                    {c.contractNumber}
                    {c.isImported && <span className="badge ml-1.5 bg-stone-100 text-stone-600">Importerat</span>}
                  </td>
                  <td className="px-4 py-3">{c.unit.unitNumber} · {c.unit.address}</td>
                  <td className="px-4 py-3">{tenants || "–"}</td>
                  <td className="px-4 py-3 text-right">{formatSek(c.rent)} kr</td>
                  <td className="px-4 py-3">{new Date(c.startDate).toLocaleDateString("sv-SE")}</td>
                  <td className="px-4 py-3"><ContractStatusBadge status={c.status} /></td>
                  <td className="px-4 py-3">
                    {canUpdate && (
                      <div className="flex flex-wrap gap-1.5">
                        {(contractTransitions[c.status] ?? [])
                          .filter((next) => !["TERMINATED", "RESCINDED"].includes(next) || c.status === "ACTIVE")
                          .map((next) => (
                            <form key={next} action={changeContractStatusAction}>
                              <input type="hidden" name="contractId" value={c.id} />
                              <input type="hidden" name="toStatus" value={next} />
                              <button type="submit" className="rounded border border-stone-300 px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100">
                                → {next}
                              </button>
                            </form>
                          ))}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
