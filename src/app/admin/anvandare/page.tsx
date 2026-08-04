import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPersonRoleLabels, hasPermission } from "@/lib/permissions";
import { ActionForm } from "@/components/admin/ActionForm";
import { createStaffUserAction, createRoleAction } from "../actions";
import { listAdminUsersAndRoles } from "@/lib/repositories/admin-records";

export const metadata = { title: "Admin – Användare & roller" };

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId || !hasPermission(user.permissions, "users", "read")) {
    redirect("/admin");
  }

  const { users, roles } = await listAdminUsersAndRoles(user.organizationId);

  const canCreateUser = hasPermission(user.permissions, "users", "create");
  const canCreateRole = hasPermission(user.permissions, "roles", "create");
  const canAssignAdminRoles = user.roleSlugs.includes("superadmin");
  const assignableRoles = roles.filter(
    (role) =>
      role.slug !== "contractor" &&
      (canAssignAdminRoles || !["superadmin", "org-admin"].includes(role.slug))
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-stone-900">Användare & roller</h1>
        <p className="mt-1 text-sm text-stone-600">
          Här visas både personalens behörighetsroller och personens roll i uthyrningsflödet.
        </p>
      </header>

      <section aria-labelledby="anvandare" className="card overflow-x-auto">
        <h2 id="anvandare" className="px-4 pt-4 font-semibold text-stone-900">Användare</h2>
        <table className="mt-2 w-full min-w-[860px] text-sm">
          <caption className="sr-only">Användare och deras exakta roller</caption>
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
              <th scope="col" className="px-4 py-3">Namn</th>
              <th scope="col" className="px-4 py-3">E-post</th>
              <th scope="col" className="px-4 py-3">Personalroll</th>
              <th scope="col" className="px-4 py-3">Personroll</th>
              <th scope="col" className="px-4 py-3">Entreprenör</th>
              <th scope="col" className="px-4 py-3">Senaste inloggning</th>
              <th scope="col" className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-stone-500">Inga användare hittades.</td>
              </tr>
            )}
            {users.map((u) => {
              const personRoles = getPersonRoleLabels(
                (u.person?.roles ?? []).map((role: { role: string }) => role.role)
              );
              return (
                <tr key={u.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 font-medium text-stone-900">
                    {u.person ? `${u.person.firstName} ${u.person.lastName}` : "Ej kopplad till person"}
                  </td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.userRoles.length === 0 ? (
                        <span className="badge bg-stone-100 text-stone-600">Ingen personalroll</span>
                      ) : (
                        u.userRoles.map((ur) => (
                          <span key={ur.id} className="badge bg-brand-50 text-brand-800">
                            {ur.role?.name ?? "Borttagen roll"}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {personRoles.length === 0 ? (
                        <span className="text-xs text-stone-400">Ingen registrerad</span>
                      ) : (
                        personRoles.map((role) => (
                          <span key={role} className="badge bg-stone-100 text-stone-700">{role}</span>
                        ))
                      )}
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
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {canCreateUser && (
          <section aria-labelledby="ny-anvandare" className="card p-5">
            <h2 id="ny-anvandare" className="font-semibold text-stone-900">Ny personalanvändare</h2>
            <p className="mb-4 mt-1 text-sm text-stone-600">
              Kontot skapas utan delat standardlösenord. Användaren får ett mejl och väljer sitt lösenord själv. Entreprenörskonton skapas under Entreprenörer.
            </p>
            {assignableRoles.length === 0 ? (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                Det finns ingen roll som du får tilldela. En superadmin behöver först skapa eller tillgängliggöra en roll.
              </p>
            ) : (
              <ActionForm action={createStaffUserAction} submitLabel="Skapa och skicka aktiveringsmejl">
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
                    <label htmlFor="roleId" className="label">Personalroll</label>
                    <select id="roleId" name="roleId" required className="input">
                      {assignableRoles.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-stone-500">
                      Rollen styr vilka delar av superadmin-/personalportalen användaren kan öppna och ändra.
                    </p>
                  </div>
                </div>
              </ActionForm>
            )}
          </section>
        )}

        <section aria-labelledby="roller" className="card p-5">
          <h2 id="roller" className="mb-2 font-semibold text-stone-900">Rollkatalog</h2>
          <ul className="divide-y divide-stone-100">
            {roles.map((r) => (
              <li key={r.id} className="py-3">
                <p className="text-sm font-medium text-stone-900">
                  {r.name}{" "}
                  <span className="text-xs font-normal text-stone-400">
                    ({r._count.userRoles} användare{r.isSystem || !r.organizationId ? " · systemroll" : " · egen roll"})
                  </span>
                </p>
                <p className="mt-0.5 text-sm text-stone-600">
                  {r.description || "Ingen beskrivning angiven."}
                </p>
                <p className="mt-1 break-words font-mono text-xs text-stone-500">
                  {r.permissions.map((p) => p.permission).join(", ") || "Inga behörigheter"}
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
                    <label htmlFor="roleDescription" className="label">Ansvar och användning</label>
                    <textarea
                      id="roleDescription"
                      name="description"
                      required
                      minLength={5}
                      rows={2}
                      className="input"
                      placeholder="T.ex. hanterar felanmälningar och arbetsorder för region öst."
                    />
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
                      Endast kända resurser och åtgärder godkänns. Format: resurs:åtgärd eller resurs:*.
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
