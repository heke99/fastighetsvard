import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getRoleDisplayNames } from "@/lib/permissions";
import { defaultDashboardForRoles, isStaffAccount } from "@/lib/role-routing";
import { Logo } from "@/components/Logo";
import { AdminNav } from "./AdminNav";

export const metadata = { title: "Administration" };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/logga-in?next=/admin");
  if (!isStaffAccount(user.roleSlugs)) redirect(defaultDashboardForRoles(user.roleSlugs));

  const roleNames = getRoleDisplayNames(user.roleSlugs, user.roleNames);
  const personName = user.person
    ? `${user.person.firstName} ${user.person.lastName}`.trim()
    : user.email;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-white">
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Logo />
            <div className="min-w-0 border-l border-stone-200 pl-3">
              <p className="truncate text-sm font-semibold text-stone-900">{personName}</p>
              <div className="mt-1 flex flex-wrap gap-1" aria-label="Dina roller">
                {roleNames.map((roleName) => (
                  <span key={roleName} className="badge bg-brand-50 text-brand-800">
                    {roleName}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/" className="font-medium text-stone-600 hover:text-brand-700">
              Till webbplatsen
            </Link>
            <form action="/api/auth/logout" method="POST">
              <button type="submit" className="font-medium text-red-700 hover:underline">
                Logga ut
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="flex flex-1">
        <AdminNav permissions={user.permissions} />
        <main id="huvudinnehall" className="min-w-0 flex-1 bg-stone-50 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
