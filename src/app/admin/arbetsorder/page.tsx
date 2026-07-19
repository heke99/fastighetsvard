import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { WorkOrderStatusBadge } from "@/components/StatusBadges";
import { changeWorkOrderStatusAction } from "../actions";
import { workOrderTransitions } from "@/lib/state-machines";
import { formatSek } from "@/components/ListingCard";

export const metadata = { title: "Admin – Arbetsorder" };

export default async function AdminWorkOrdersPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId || !hasPermission(user.permissions, "workorders", "read")) {
    redirect("/admin");
  }

  const workOrders = await db.workOrder.findMany({
    where: { organizationId: user.organizationId },
    include: {
      supplier: { select: { name: true } },
      request: { select: { requestNumber: true, unit: { select: { address: true } } } },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  const canUpdate = hasPermission(user.permissions, "workorders", "update");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-stone-900">Arbetsorder</h1>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <caption className="sr-only">Arbetsorder</caption>
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
              <th scope="col" className="px-4 py-3">Nr</th>
              <th scope="col" className="px-4 py-3">Rubrik</th>
              <th scope="col" className="px-4 py-3">Entreprenör</th>
              <th scope="col" className="px-4 py-3">Felanmälan</th>
              <th scope="col" className="px-4 py-3 text-right">Tid (h)</th>
              <th scope="col" className="px-4 py-3 text-right">Kostnad</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3">Åtgärder</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {workOrders.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-stone-500">Inga arbetsorder.</td></tr>
            )}
            {workOrders.map((wo) => (
              <tr key={wo.id} className="hover:bg-stone-50">
                <td className="px-4 py-3 font-medium text-stone-900">#{wo.orderNumber}</td>
                <td className="px-4 py-3">{wo.title}</td>
                <td className="px-4 py-3">{wo.supplier?.name ?? "Intern"}</td>
                <td className="px-4 py-3">
                  {wo.request ? `#${wo.request.requestNumber} · ${wo.request.unit?.address ?? ""}` : "–"}
                </td>
                <td className="px-4 py-3 text-right">{wo.timeReported ? Number(wo.timeReported) : "–"}</td>
                <td className="px-4 py-3 text-right">{wo.cost ? `${formatSek(wo.cost)} kr` : "–"}</td>
                <td className="px-4 py-3"><WorkOrderStatusBadge status={wo.status} /></td>
                <td className="px-4 py-3">
                  {canUpdate && (
                    <div className="flex flex-wrap gap-1.5">
                      {(workOrderTransitions[wo.status] ?? []).map((next) => (
                        <form key={next} action={changeWorkOrderStatusAction}>
                          <input type="hidden" name="workOrderId" value={wo.id} />
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
