import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AdminNav } from "./AdminNav";
import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata = { title: "Administration" };
export const dynamic = "force-dynamic";

const STAFF_ROLES = [
  "superadmin", "org-admin", "property-owner", "property-manager",
  "caretaker", "leasing-agent", "sales-manager", "finance",
  "customer-service", "facility-worker", "inspector", "report-viewer",
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/logga-in?next=/admin");
  // Server-side auth: entreprenörer och hyresgäster kommer inte in.
  if (!user.roleSlugs.some((r) => STAFF_ROLES.includes(r))) redirect("/mina-sidor");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-white">
        <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="badge bg-brand-700 text-white">Admin</span>
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
        <AdminNav />
        <main id="huvudinnehall" className="min-w-0 flex-1 bg-stone-50 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
