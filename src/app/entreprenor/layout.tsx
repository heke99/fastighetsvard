import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "@/components/Logo";

export const metadata = { title: "Entreprenörsportal" };
export const dynamic = "force-dynamic";

export default async function ContractorLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/logga-in?next=/entreprenor");
  // Endast entreprenörskonton (kopplade till leverantör) släpps in.
  if (!user.supplierId || !user.roleSlugs.includes("contractor")) redirect("/mina-sidor");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="badge bg-accent-500 text-stone-900">Entreprenör</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/entreprenor" className="font-medium text-stone-600 hover:text-brand-700">
              Mina arbetsorder
            </Link>
            <form action="/api/auth/logout" method="POST">
              <button type="submit" className="font-medium text-red-700 hover:underline">Logga ut</button>
            </form>
          </div>
        </div>
      </header>
      <main id="huvudinnehall" className="flex-1 bg-stone-50">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</div>
      </main>
    </div>
  );
}
