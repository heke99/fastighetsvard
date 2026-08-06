import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { MaintenanceStatusBadge } from "@/components/StatusBadges";
import { listMyMaintenanceRequests } from "@/lib/repositories/portal-records";

export const metadata = { title: "Mina felanmälningar" };

export default async function MyMaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; attachments?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.personId) redirect("/logga-in");

  const [requests, query] = await Promise.all([
    listMyMaintenanceRequests(user.personId),
    searchParams,
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Mina felanmälningar</h1>
          <p className="mt-1 text-stone-500">Följ status, meddelanden och bilagor för dina ärenden.</p>
        </div>
        <Link href="/mina-sidor/felanmalan/ny" className="btn-primary">Ny felanmälan</Link>
      </header>

      {query.created && (
        <div role="status" className="rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
          Felanmälan #{query.created} är registrerad, synlig för ansvarig personal och e-postavisering har initierats.
          {query.attachments === "partial" && " Några bilagor kunde inte laddas upp."}
          {query.attachments === "failed" && " Bilagorna kunde inte laddas upp, men själva felanmälan är sparad."}
        </div>
      )}

      {requests.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-semibold text-stone-700">Du har inga felanmälningar.</p>
          <Link href="/mina-sidor/felanmalan/ny" className="btn-primary mt-4">Gör en felanmälan</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {requests.map((r) => (
            <li key={r.id}>
              <Link href={`/mina-sidor/felanmalan/${r.id}`} className="card flex flex-col gap-2 p-4 transition hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-stone-900">
                    #{r.requestNumber} · {r.title}
                    {r.isEmergency && <span className="badge ml-2 bg-red-100 text-red-800">Akut</span>}
                  </p>
                  <p className="text-sm text-stone-500">
                    {r.unit?.address ?? "Allmänt utrymme"} · {r.category} ·{" "}
                    {new Date(r.createdAt).toLocaleDateString("sv-SE")}
                  </p>
                </div>
                <MaintenanceStatusBadge status={r.status} audience="tenant" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}