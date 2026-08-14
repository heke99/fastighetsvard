import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { ActionForm } from "@/components/admin/ActionForm";
import { DangerActionForm } from "@/components/admin/DangerActionForm";
import { NotesPanel } from "@/components/admin/NotesPanel";
import { createPropertyAction, deletePropertyAction } from "../actions";
import { listAdminProperties } from "@/lib/repositories/admin-records";
import { listNotesForEntities } from "@/lib/repositories/notes";

export const metadata = { title: "Admin – Fastigheter" };

export default async function AdminPropertiesPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId || !hasPermission(user.permissions, "properties", "read")) {
    redirect("/admin");
  }

  const properties = await listAdminProperties(user.organizationId);
  const notesByProperty = await listNotesForEntities({
    organizationId: user.organizationId,
    entityType: "PROPERTY",
    entityIds: properties.map((property) => property.id),
  });

  const canCreate = hasPermission(user.permissions, "properties", "create");
  const canUpdate = hasPermission(user.permissions, "properties", "update");
  const canDelete = hasPermission(user.permissions, "properties", "delete");

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
              <th scope="col" className="px-4 py-3">Åtgärder</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {properties.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-stone-500">
                Inga fastigheter ännu.{canCreate ? " Skapa den första i formuläret nedan." : ""}
              </td></tr>
            )}
            {properties.map((p) => (
              <tr key={p.id} className="align-top hover:bg-stone-50">
                <td className="px-4 py-3 font-medium text-stone-900">{p.name}</td>
                <td className="px-4 py-3">{p.designation ?? "–"}</td>
                <td className="px-4 py-3">{p.address}</td>
                <td className="px-4 py-3">{p.city}</td>
                <td className="px-4 py-3 text-right">{p._count.units}</td>
                <td className="px-4 py-3">
                  <span className="badge bg-brand-50 text-brand-800">{p.status === "ACTIVE" ? "Aktiv" : p.status}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-3">
                    <details>
                      <summary className="cursor-pointer text-xs font-semibold text-brand-700">
                        Anteckningar ({notesByProperty.get(p.id)?.length ?? 0})
                      </summary>
                      <div className="mt-2 min-w-[280px]">
                        <NotesPanel
                          entityType="PROPERTY"
                          entityId={p.id}
                          notes={notesByProperty.get(p.id) ?? []}
                          canWrite={canUpdate}
                        />
                      </div>
                    </details>
                    {canDelete && (
                      <DangerActionForm
                        action={deletePropertyAction}
                        label="Radera"
                        confirmTitle={`Radera fastigheten ${p.name}?`}
                        confirmDescription="Fastigheten kan bara raderas när den saknar objekt, byggnader och felanmälningar. Åtgärden går inte att ångra."
                        fields={{ propertyId: p.id }}
                      />
                    )}
                  </div>
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
