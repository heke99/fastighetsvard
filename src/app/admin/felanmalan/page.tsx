import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { MaintenanceStatusBadge } from "@/components/StatusBadges";
import { ActionForm } from "@/components/admin/ActionForm";
import { changeMaintenanceStatusAction, createWorkOrderAction } from "../actions";
import { maintenanceTransitions } from "@/lib/state-machines";

export const metadata = { title: "Admin – Felanmälningar" };

export default async function AdminMaintenancePage() {
  const user = await getCurrentUser();
  if (!user?.organizationId || !hasPermission(user.permissions, "maintenance", "read")) {
    redirect("/admin");
  }

  const [requests, suppliers] = await Promise.all([
    db.maintenanceRequest.findMany({
      where: { organizationId: user.organizationId },
      include: {
        unit: { select: { address: true, unitNumber: true } },
        person: { select: { firstName: true, lastName: true, phone: true } },
        workOrders: { select: { id: true, orderNumber: true, status: true } },
      },
      orderBy: [{ isEmergency: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
    db.supplier.findMany({
      where: { organizationId: user.organizationId, isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const canUpdate = hasPermission(user.permissions, "maintenance", "update");
  const canCreateWO = hasPermission(user.permissions, "workorders", "create");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-stone-900">Felanmälningar</h1>

      {requests.length === 0 ? (
        <div className="card p-10 text-center text-stone-500">Inga felanmälningar.</div>
      ) : (
        <ul className="space-y-4">
          {requests.map((r) => (
            <li key={r.id} className={`card p-5 ${r.isEmergency ? "border-l-4 border-l-red-500" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-stone-900">
                    #{r.requestNumber} · {r.title}
                    {r.isEmergency && <span className="badge ml-2 bg-red-100 text-red-800">Akut</span>}
                  </h2>
                  <p className="text-sm text-stone-500">
                    {r.unit ? `${r.unit.unitNumber} · ${r.unit.address}` : "Allmänt utrymme"} · {r.category}
                    {r.person && ` · Anmäld av ${r.person.firstName} ${r.person.lastName}${r.person.phone ? ` (${r.person.phone})` : ""}`}
                  </p>
                  <p className="mt-1 text-sm text-stone-600">{r.description}</p>
                  <p className="mt-1 text-xs text-stone-400">
                    Huvudnyckel: {r.masterKeyAllowed ? "OK" : "Nej"} · Husdjur: {r.petsInHome ? "Ja" : "Nej"}
                    {r.preferredTime && ` · Önskad tid: ${r.preferredTime}`}
                  </p>
                  {r.workOrders.length > 0 && (
                    <p className="mt-1 text-xs text-stone-500">
                      Arbetsorder: {r.workOrders.map((wo) => `#${wo.orderNumber} (${wo.status})`).join(", ")}
                    </p>
                  )}
                </div>
                <MaintenanceStatusBadge status={r.status} />
              </div>

              {canUpdate && (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-stone-100 pt-3">
                  {(maintenanceTransitions[r.status] ?? []).map((next) => (
                    <form key={next} action={changeMaintenanceStatusAction}>
                      <input type="hidden" name="requestId" value={r.id} />
                      <input type="hidden" name="toStatus" value={next} />
                      <button type="submit" className="rounded border border-stone-300 px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100">
                        → {next}
                      </button>
                    </form>
                  ))}
                </div>
              )}

              {canCreateWO && r.workOrders.length === 0 && !["CLOSED", "REJECTED"].includes(r.status) && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-brand-700">
                    Skapa arbetsorder
                  </summary>
                  <div className="mt-3">
                    <ActionForm action={createWorkOrderAction} submitLabel="Skapa arbetsorder">
                      <input type="hidden" name="requestId" value={r.id} />
                      <input type="hidden" name="title" value={`Felanmälan #${r.requestNumber}: ${r.title}`} />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label htmlFor={`desc-${r.id}`} className="label">Arbetsbeskrivning</label>
                          <textarea id={`desc-${r.id}`} name="description" rows={2} required defaultValue={r.description} className="input" />
                        </div>
                        <div>
                          <label htmlFor={`supplier-${r.id}`} className="label">Entreprenör</label>
                          <select id={`supplier-${r.id}`} name="supplierId" className="input">
                            <option value="">Ingen (intern)</option>
                            {suppliers.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}{s.specialty ? ` (${s.specialty})` : ""}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor={`prio-${r.id}`} className="label">Prioritet</label>
                          <select id={`prio-${r.id}`} name="priority" defaultValue={r.priority} className="input">
                            <option value="LOW">Låg</option>
                            <option value="NORMAL">Normal</option>
                            <option value="HIGH">Hög</option>
                            <option value="URGENT">Akut</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor={`access-${r.id}`} className="label">Tillträdesinformation</label>
                          <input
                            id={`access-${r.id}`}
                            name="accessInfo"
                            className="input"
                            defaultValue={r.masterKeyAllowed ? "Huvudnyckel tillåten." : "Kontakta hyresgäst för tillträde."}
                          />
                        </div>
                      </div>
                    </ActionForm>
                  </div>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
