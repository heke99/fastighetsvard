import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { MaintenanceStatusBadge } from "@/components/StatusBadges";

export const metadata = { title: "Mina felanmälningar" };

export default async function MyMaintenancePage() {
  const user = await getCurrentUser();
  if (!user?.personId) redirect("/logga-in");

  const requests = await db.maintenanceRequest.findMany({
    where: { personId: user.personId },
    include: { unit: { select: { address: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Mina felanmälningar</h1>
          <p className="mt-1 text-stone-500">Följ status för dina ärenden.</p>
        </div>
        <Link href="/mina-sidor/felanmalan/ny" className="btn-primary">Ny felanmälan</Link>
      </header>

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
                <MaintenanceStatusBadge status={r.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
