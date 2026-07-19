import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { WorkOrderStatusBadge } from "@/components/StatusBadges";
import { ContractorWorkOrderActions } from "./ContractorActions";

export const metadata = { title: "Mina arbetsorder" };

export default async function ContractorPage() {
  const user = await getCurrentUser();
  if (!user?.supplierId) redirect("/logga-in");

  // Entreprenören ser ENDAST arbetsorder tilldelade den egna leverantören.
  const workOrders = await prisma.workOrder.findMany({
    where: { supplierId: user.supplierId },
    include: {
      request: {
        select: {
          requestNumber: true,
          contactPhone: true,
          preferredTime: true,
          masterKeyAllowed: true,
          petsInHome: true,
          unit: { select: { address: true, city: true } },
        },
      },
      documents: { select: { id: true, title: true } },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-stone-900">Mina arbetsorder</h1>
        <p className="mt-1 text-stone-500">
          Arbetsorder tilldelade ditt företag. Acceptera, boka tid, rapportera
          tid/material och färdigmarkera.
        </p>
      </header>

      {workOrders.length === 0 ? (
        <div className="card p-10 text-center text-stone-500">
          Inga arbetsorder tilldelade just nu.
        </div>
      ) : (
        <ul className="space-y-4">
          {workOrders.map((wo) => (
            <li key={wo.id} className={`card p-5 ${wo.priority === "URGENT" ? "border-l-4 border-l-red-500" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-stone-900">
                    #{wo.orderNumber} · {wo.title}
                    {wo.priority === "URGENT" && <span className="badge ml-2 bg-red-100 text-red-800">Akut</span>}
                  </h2>
                  <p className="text-sm text-stone-500">
                    {wo.request?.unit ? `${wo.request.unit.address}, ${wo.request.unit.city}` : "Adress via beskrivning"}
                    {wo.scheduledAt && ` · Bokad ${new Date(wo.scheduledAt).toLocaleString("sv-SE")}`}
                  </p>
                </div>
                <WorkOrderStatusBadge status={wo.status} />
              </div>

              <p className="mt-2 text-sm text-stone-600">{wo.description}</p>

              <dl className="mt-3 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
                {wo.accessInfo && (
                  <div className="flex justify-between border-b border-stone-100 py-1.5">
                    <dt className="text-stone-500">Tillträde</dt>
                    <dd className="font-medium">{wo.accessInfo}</dd>
                  </div>
                )}
                {wo.request?.contactPhone && (
                  <div className="flex justify-between border-b border-stone-100 py-1.5">
                    <dt className="text-stone-500">Kontakt</dt>
                    <dd className="font-medium">
                      <a href={`tel:${wo.request.contactPhone}`} className="text-brand-700">{wo.request.contactPhone}</a>
                    </dd>
                  </div>
                )}
                {wo.request?.preferredTime && (
                  <div className="flex justify-between border-b border-stone-100 py-1.5">
                    <dt className="text-stone-500">Önskad tid</dt>
                    <dd className="font-medium">{wo.request.preferredTime}</dd>
                  </div>
                )}
                {wo.request && (
                  <div className="flex justify-between border-b border-stone-100 py-1.5">
                    <dt className="text-stone-500">Husdjur</dt>
                    <dd className="font-medium">{wo.request.petsInHome ? "Ja" : "Nej"}</dd>
                  </div>
                )}
              </dl>

              <ContractorWorkOrderActions
                workOrderId={wo.id}
                status={wo.status}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
