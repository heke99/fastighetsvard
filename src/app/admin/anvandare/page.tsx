import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { ActionForm } from "@/components/admin/ActionForm";
import { createStaffUserAction, createRoleAction } from "../actions";

export const metadata = { title: "Admin – Användare & roller" };

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId || !hasPermission(user.permissions, "users", "read")) {
    redirect("/admin");
  }

  const [users, roles] = await Promise.all([
    db.user.findMany({
      where: { organizationId: user.organizationId },
      include: {
        person: { select: { firstName: true, lastName: true } },
        userRoles: { include: { role: { select: { name: true, slug: true } } } },
        supplier: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.role.findMany({
      where: { OR: [{ organizationId: null }, { organizationId: user.organizationId }] },
      include: { permissions: true, _count: { select: { userRoles: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const canCreateUser = hasPermission(user.permissions, "users", "create");
  const canCreateRole = hasPermission(user.permissions, "roles", "create");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-stone-900">Användare & roller</h1>

      <section aria-labelledby="anvandare" className="card overflow-x-auto">
        <h2 id="anvandare" className="px-4 pt-4 font-semibold text-stone-900">Användare</h2>
        <table className="mt-2 w-full min-w-[720px] text-sm">
          <caption className="sr-only">Användare</caption>
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
              <th scope="col" className="px-4 py-3">Namn</th>
              <th scope="col" className="px-4 py-3">E-post</th>
              <th scope="col" className="px-4 py-3">Roller</th>
              <th scope="col" className="px-4 py-3">Entreprenör</th>
              <th scope="col" className="px-4 py-3">Senaste inloggning</th>
              <th scope="col" className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-stone-50">
                <td className="px-4 py-3 font-medium text-stone-900">
                  {u.person ? `${u.person.firstName} ${u.person.lastName}` : "–"}
                </td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {u.userRoles.length === 0 && <span className="badge bg-stone-100 text-stone-600">Hyresgäst/Sökande</span>}
                    {u.userRoles.map((ur) => (
                      <span key={ur.id} className="badge bg-brand-50 text-brand-800">{ur.role.name}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">{u.supplier?.name ?? "–"}</td>
                <td className="px-4 py-3">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("sv-SE") : "Aldrig"}
                </td>
                <td className="px-4 py-3">
                  <span className={`badge ${u.isActive ? "bg-brand-100 text-brand-800" : "bg-red-100 text-red-800"}`}>
                    {u.isActive ? "Aktiv" : "Avstängd"}
                  </span>
                  {u.lockedUntil && u.lockedUntil > new Date() && (
                    <span className="badge ml-1 bg-red-100 text-red-800">Låst</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {canCreateUser && (
          <section aria-labelledby="ny-anvandare" className="card p-5">
            <h2 id="ny-anvandare" className="mb-4 font-semibold text-stone-900">Ny personal-användare</h2>
            <ActionForm action={createStaffUserAction} submitLabel="Skapa användare">
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="firstName" className="label">Förnamn</label>
                    <input id="firstName" name="firstName" required className="input" />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="label">Efternamn</label>
                    <input id="lastName" name="lastName" required className="input" />
                  </div>
                </div>
                <div>
                  <label htmlFor="email" className="label">E-post</label>
                  <input id="email" name="email" type="email" required className="input" />
                </div>
                <div>
                  <label htmlFor="password" className="label">Lösenord (minst 10 tecken)</label>
                  <input id="password" name="password" type="password" required className="input" />
                </div>
                <div>
                  <label htmlFor="roleId" className="label">Roll</label>
                  <select id="roleId" name="roleId" required className="input">
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </ActionForm>
          </section>
        )}

        <section aria-labelledby="roller" className="card p-5">
          <h2 id="roller" className="mb-2 font-semibold text-stone-900">Roller</h2>
          <ul className="divide-y divide-stone-100">
            {roles.map((r) => (
              <li key={r.id} className="py-2.5">
                <p className="text-sm font-medium text-stone-900">
                  {r.name}{" "}
                  <span className="text-xs font-normal text-stone-400">
                    ({r._count.userRoles} användare{r.isSystem || !r.organizationId ? " · systemroll" : " · egen roll"})
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-stone-500">
                  {r.permissions.map((p) => p.permission).join(", ")}
                </p>
              </li>
            ))}
          </ul>
          {canCreateRole && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold text-brand-700">Skapa egen roll</summary>
              <div className="mt-3">
                <ActionForm action={createRoleAction} submitLabel="Skapa roll">
                  <div>
                    <label htmlFor="roleName" className="label">Namn</label>
                    <input id="roleName" name="name" required className="input" />
                  </div>
                  <div>
                    <label htmlFor="rolePermissions" className="label">Behörigheter (kommaseparerade)</label>
                    <input
                      id="rolePermissions"
                      name="permissions"
                      required
                      className="input font-mono text-xs"
                      placeholder="units:read, maintenance:*, reports:read"
                    />
                    <p className="mt-1 text-xs text-stone-500">
                      Format: resurs:åtgärd. Åtgärder: read, create, update, delete, approve, export eller *.
                    </p>
                  </div>
                </ActionForm>
              </div>
            </details>
          )}
        </section>
      </div>
    </div>
  );
}
