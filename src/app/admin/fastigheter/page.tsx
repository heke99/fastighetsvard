import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { ActionForm } from "@/components/admin/ActionForm";
import { createPropertyAction } from "../actions";

export const metadata = { title: "Admin – Fastigheter" };

export default async function AdminPropertiesPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId || !hasPermission(user.permissions, "properties", "read")) {
    redirect("/admin");
  }

  const properties = await db.property.findMany({
    where: { organizationId: user.organizationId },
    include: { _count: { select: { units: true, buildings: true } } },
    orderBy: [{ city: "asc" }, { name: "asc" }],
  });

  const canCreate = hasPermission(user.permissions, "properties", "create");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-stone-900">Fastigheter</h1>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">Fastigheter</caption>
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
              <th scope="col" className="px-4 py-3">Namn</th>
              <th scope="col" className="px-4 py-3">Beteckning</th>
              <th scope="col" className="px-4 py-3">Adress</th>
              <th scope="col" className="px-4 py-3">Ort</th>
              <th scope="col" className="px-4 py-3 text-right">Objekt</th>
              <th scope="col" className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {properties.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-stone-500">Inga fastigheter ännu.</td></tr>
            )}
            {properties.map((p) => (
              <tr key={p.id} className="hover:bg-stone-50">
                <td className="px-4 py-3 font-medium text-stone-900">{p.name}</td>
                <td className="px-4 py-3">{p.designation ?? "–"}</td>
                <td className="px-4 py-3">{p.address}</td>
                <td className="px-4 py-3">{p.city}</td>
                <td className="px-4 py-3 text-right">{p._count.units}</td>
                <td className="px-4 py-3">
                  <span className="badge bg-brand-50 text-brand-800">{p.status === "ACTIVE" ? "Aktiv" : p.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canCreate && (
        <section aria-labelledby="ny-fastighet" className="card p-5">
          <h2 id="ny-fastighet" className="mb-4 font-semibold text-stone-900">Ny fastighet</h2>
          <ActionForm action={createPropertyAction} submitLabel="Skapa fastighet">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="label">Namn</label>
                <input id="name" name="name" required className="input" />
              </div>
              <div>
                <label htmlFor="designation" className="label">Fastighetsbeteckning</label>
                <input id="designation" name="designation" className="input" placeholder="T.ex. Eken 3" />
              </div>
              <div>
                <label htmlFor="address" className="label">Adress</label>
                <input id="address" name="address" required className="input" />
              </div>
              <div>
                <label htmlFor="postalCode" className="label">Postnummer</label>
                <input id="postalCode" name="postalCode" className="input" />
              </div>
              <div>
                <label htmlFor="city" className="label">Ort</label>
                <input id="city" name="city" required className="input" />
              </div>
              <div>
                <label htmlFor="municipality" className="label">Kommun</label>
                <input id="municipality" name="municipality" className="input" />
              </div>
              <div>
                <label htmlFor="yearBuilt" className="label">Byggnadsår</label>
                <input id="yearBuilt" name="yearBuilt" type="number" className="input" />
              </div>
              <div>
                <label htmlFor="energyClass" className="label">Energiklass</label>
                <input id="energyClass" name="energyClass" className="input" placeholder="A–G" />
              </div>
              <div>
                <label htmlFor="emergencyPhone" className="label">Akutnummer</label>
                <input id="emergencyPhone" name="emergencyPhone" className="input" />
              </div>
            </div>
          </ActionForm>
        </section>
      )}
    </div>
  );
}
