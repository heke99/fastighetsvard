import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { MaintenanceStatusBadge } from "@/components/StatusBadges";

export const metadata = { title: "Felanmälan" };

export default async function MaintenanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.personId) redirect("/logga-in");
  const { id } = await params;

  // Tenant-isolering: endast egna ärenden.
  const request = await prisma.maintenanceRequest.findFirst({
    where: { id, personId: user.personId },
    include: {
      unit: { select: { address: true, city: true } },
      comments: { where: { isInternal: false }, orderBy: { createdAt: "asc" } },
      statusHistory: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!request) notFound();

  return (
    <div className="space-y-6">
      <nav aria-label="Brödsmulor" className="text-sm text-stone-500">
        <Link href="/mina-sidor/felanmalan" className="hover:text-brand-700">← Mina felanmälningar</Link>
      </nav>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">
            #{request.requestNumber} · {request.title}
          </h1>
          <p className="mt-1 text-stone-500">
            {request.unit ? `${request.unit.address}, ${request.unit.city}` : "Allmänt utrymme"} ·{" "}
            {request.category}
            {request.room ? ` · ${request.room}` : ""}
          </p>
        </div>
        <MaintenanceStatusBadge status={request.status} />
      </header>

      <section aria-labelledby="beskrivning" className="card p-5">
        <h2 id="beskrivning" className="font-semibold text-stone-900">Beskrivning</h2>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-stone-600">
          {request.description}
        </p>
        <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between border-b border-stone-100 py-1.5">
            <dt className="text-stone-500">Anmäld</dt>
            <dd className="font-medium">{new Date(request.createdAt).toLocaleString("sv-SE")}</dd>
          </div>
          <div className="flex justify-between border-b border-stone-100 py-1.5">
            <dt className="text-stone-500">Prioritet</dt>
            <dd className="font-medium">
              {request.priority === "URGENT" ? "Akut" : request.priority === "HIGH" ? "Hög" : request.priority === "LOW" ? "Låg" : "Normal"}
            </dd>
          </div>
          <div className="flex justify-between border-b border-stone-100 py-1.5">
            <dt className="text-stone-500">Huvudnyckel</dt>
            <dd className="font-medium">{request.masterKeyAllowed ? "Tillåten" : "Ej tillåten"}</dd>
          </div>
          <div className="flex justify-between border-b border-stone-100 py-1.5">
            <dt className="text-stone-500">Husdjur i bostaden</dt>
            <dd className="font-medium">{request.petsInHome ? "Ja" : "Nej"}</dd>
          </div>
        </dl>
      </section>

      {request.comments.length > 0 && (
        <section aria-labelledby="kommentarer" className="card p-5">
          <h2 id="kommentarer" className="font-semibold text-stone-900">Meddelanden i ärendet</h2>
          <ul className="mt-3 space-y-3">
            {request.comments.map((c) => (
              <li key={c.id} className="rounded-lg bg-stone-50 p-3 text-sm">
                <p className="font-medium text-stone-900">{c.authorName}</p>
                <p className="mt-0.5 text-stone-600">{c.body}</p>
                <p className="mt-1 text-xs text-stone-400">{new Date(c.createdAt).toLocaleString("sv-SE")}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="historik" className="card p-5">
        <h2 id="historik" className="font-semibold text-stone-900">Statushistorik</h2>
        <ol className="mt-3 space-y-2 text-sm">
          {request.statusHistory.map((e) => (
            <li key={e.id} className="flex items-center gap-3">
              <span className="h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-hidden="true" />
              <span className="text-stone-500">{new Date(e.createdAt).toLocaleString("sv-SE")}</span>
              <MaintenanceStatusBadge status={e.toStatus} />
              {e.comment && <span className="text-stone-600">{e.comment}</span>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
