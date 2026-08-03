import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getCurrentUser } from "@/lib/auth";
import { defaultDashboardForRoles, isTenantPerson } from "@/lib/role-routing";
import { PortalNav } from "./PortalNav";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/logga-in?next=/mina-sidor");
  const dashboardHref = defaultDashboardForRoles(user.roleSlugs);
  if (dashboardHref !== "/mina-sidor") redirect(dashboardHref);

  return (
    <>
      <SiteHeader
        user={{
          name: user.person ? user.person.firstName : user.email,
          isTenant: isTenantPerson(user.person?.roles ?? []),
          dashboardHref,
        }}
      />
      <main id="huvudinnehall" className="flex-1 bg-stone-50">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[240px_1fr]">
          <aside aria-label="Mina sidor-meny">
            <PortalNav personRoles={user.person?.roles ?? []} />
            <div className="mt-4 lg:hidden" />
          </aside>
          <div className="min-w-0">{children}</div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

export const dynamic = "force-dynamic";
