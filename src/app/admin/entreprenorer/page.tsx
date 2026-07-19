import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { ActionForm } from "@/components/admin/ActionForm";
import { createSupplierAction } from "../actions";

export const metadata = { title: "Admin – Entreprenörer" };

export default async function AdminSuppliersPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId || !hasPermission(user.permissions, "suppliers", "read")) {
    redirect("/admin");
  }

  const suppliers = await prisma.supplier.findMany({
    where: { organizationId: user.organizationId },
    include: {
      users: { select: { email: true } },
      _count: { select: { workOrders: true } },
    },
    orderBy: { name: "asc" },
  });

  const canCreate = hasPermission(user.permissions, "suppliers", "create");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-stone-900">Entreprenörer</h1>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <caption className="sr-only">Entreprenörer</caption>
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
              <th scope="col" className="px-4 py-3">Namn</th>
              <th scope="col" className="px-4 py-3">Specialitet</th>
              <th scope="col" className="px-4 py-3">Kontakt</th>
              <th scope="col" className="px-4 py-3">Portalkonton</th>
              <th scope="col" className="px-4 py-3 text-right">Arbetsorder</th>
              <th scope="col" className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {suppliers.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-stone-500">Inga entreprenörer.</td></tr>
            )}
            {suppliers.map((s) => (
              <tr key={s.id} className="hover:bg-stone-50">
                <td className="px-4 py-3 font-medium text-stone-900">{s.name}</td>
                <td className="px-4 py-3">{s.specialty ?? "–"}</td>
                <td className="px-4 py-3">{[s.email, s.phone].filter(Boolean).join(" · ") || "–"}</td>
                <td className="px-4 py-3">{s.users.map((u) => u.email).join(", ") || "–"}</td>
                <td className="px-4 py-3 text-right">{s._count.workOrders}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${s.isActive ? "bg-brand-100 text-brand-800" : "bg-stone-100 text-stone-600"}`}>
                    {s.isActive ? "Aktiv" : "Inaktiv"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canCreate && (
        <section aria-labelledby="ny-entreprenor" className="card p-5">
          <h2 id="ny-entreprenor" className="mb-4 font-semibold text-stone-900">Ny entreprenör</h2>
          <ActionForm action={createSupplierAction} submitLabel="Skapa entreprenör">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="label">Företagsnamn</label>
                <input id="name" name="name" required className="input" />
              </div>
              <div>
                <label htmlFor="orgNumber" className="label">Organisationsnummer</label>
                <input id="orgNumber" name="orgNumber" className="input" />
              </div>
              <div>
                <label htmlFor="email" className="label">E-post</label>
                <input id="email" name="email" type="email" className="input" />
              </div>
              <div>
                <label htmlFor="phone" className="label">Telefon</label>
                <input id="phone" name="phone" type="tel" className="input" />
              </div>
              <div>
                <label htmlFor="specialty" className="label">Specialitet</label>
                <input id="specialty" name="specialty" className="input" placeholder="El, VVS, bygg …" />
              </div>
            </div>
            <fieldset className="rounded-lg border border-stone-200 p-4">
              <legend className="px-1 text-sm font-semibold text-stone-700">
                Skapa portalkonto (valfritt)
              </legend>
              <p className="mb-3 text-xs text-stone-500">
                Entreprenören ser endast sina egna tilldelade arbetsorder i portalen.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="contractorEmail" className="label">Inloggnings-e-post</label>
                  <input id="contractorEmail" name="contractorEmail" type="email" className="input" />
                </div>
                <div>
                  <label htmlFor="contractorPassword" className="label">Lösenord (minst 10 tecken)</label>
                  <input id="contractorPassword" name="contractorPassword" type="password" className="input" />
                </div>
              </div>
            </fieldset>
          </ActionForm>
        </section>
      )}
    </div>
  );
}
