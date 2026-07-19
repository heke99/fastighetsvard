import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getCurrentUser } from "@/lib/auth";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const staffRoles = [
    "superadmin", "org-admin", "property-owner", "property-manager",
    "caretaker", "leasing-agent", "sales-manager", "finance",
    "customer-service", "facility-worker", "inspector", "report-viewer",
  ];
  return (
    <>
      <SiteHeader
        user={
          user
            ? {
                name: user.person ? user.person.firstName : user.email,
                isStaff: user.roleSlugs.some((r) => staffRoles.includes(r)),
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
