import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getCurrentUser } from "@/lib/auth";
import { PortalNav } from "./PortalNav";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/logga-in?next=/mina-sidor");

  const staffRoles = ["superadmin", "org-admin", "property-manager", "leasing-agent", "finance", "customer-service"];

  return (
    <>
      <SiteHeader
        user={{
          name: user.person ? user.person.firstName : user.email,
          isStaff: user.roleSlugs.some((r) => staffRoles.includes(r)),
        }}
      />
      <main id="huvudinnehall" className="flex-1 bg-stone-50">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[240px_1fr]">
          <aside aria-label="Mina sidor-meny">
            <PortalNav />
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
