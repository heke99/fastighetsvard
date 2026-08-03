import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getCurrentUser } from "@/lib/auth";
import { defaultDashboardForRoles, isTenantPerson } from "@/lib/role-routing";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <>
      <SiteHeader
        user={
          user
            ? {
                name: user.person ? user.person.firstName : user.email,
                isTenant: isTenantPerson(user.person?.roles ?? []),
                dashboardHref: defaultDashboardForRoles(user.roleSlugs),
              }
            : null
        }
      />
      <main id="huvudinnehall" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
