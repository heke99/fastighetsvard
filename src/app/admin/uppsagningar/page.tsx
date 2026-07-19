import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export const metadata = { title: "Admin – Uppsägningar" };

const statusLabels: Record<string, string> = {
  REQUESTED: "Begärd",
  CONFIRMED: "Bekräftad",
  INSPECTION_BOOKED: "Besiktning bokad",
  COMPLETED: "Slutförd",
  CANCELLED: "Avbruten",
};

export default async function AdminTerminationsPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId || !hasPermission(user.permissions, "terminations", "read")) {
    redirect("/admin");
  }

  const terminations = await prisma.termination.findMany({
    where: { organizationId: user.organizationId },
    include: {
      contract: { include: { unit: { select: { unitNumber: true, address: true } } } },
      requestedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { requestedAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-stone-900">Uppsägningar</h1>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <caption className="sr-only">Uppsägningar</caption>
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
              <th scope="col" className="px-4 py-3">Avtal</th>
              <th scope="col" className="px-4 py-3">Objekt</th>
              <th scope="col" className="px-4 py-3">Begärd av</th>
              <th scope="col" className="px-4 py-3">Begärd</th>
              <th scope="col" className="px-4 py-3">Slutdatum</th>
              <th scope="col" className="px-4 py-3">Typ</th>
              <th scope="col" className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {terminations.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-stone-500">Inga uppsägningar.</td></tr>
            )}
            {terminations.map((t) => (
              <tr key={t.id} className="hover:bg-stone-50">
                <td className="px-4 py-3 font-medium text-stone-900">{t.contract.contractNumber}</td>
                <td className="px-4 py-3">{t.contract.unit.unitNumber} · {t.contract.unit.address}</td>
                <td className="px-4 py-3">{t.requestedBy.firstName} {t.requestedBy.lastName}</td>
                <td className="px-4 py-3">{new Date(t.requestedAt).toLocaleDateString("sv-SE")}</td>
                <td className="px-4 py-3 font-medium">
                  {t.effectiveEndDate ? new Date(t.effectiveEndDate).toLocaleDateString("sv-SE") : "–"}
                </td>
                <td className="px-4 py-3">
                  {t.isInternalTransfer ? (
                    <span className="badge bg-brand-700 text-white">Intern flytt</span>
                  ) : (
                    "Ordinarie"
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="badge bg-stone-100 text-stone-700">{statusLabels[t.status]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
