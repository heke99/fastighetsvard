import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ApplicationStatusBadge } from "@/components/StatusBadges";
import { OfferResponseForm } from "./OfferResponseForm";

export const metadata = { title: "Mina ansökningar" };

export default async function MyApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ skickad?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.personId) redirect("/logga-in");
  const { skickad } = await searchParams;

  const applications = await prisma.application.findMany({
    where: { members: { some: { personId: user.personId } } },
    include: {
      listing: { include: { unit: { select: { address: true, city: true } } } },
      offers: { where: { status: "SENT" } },
      members: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-stone-900">Mina ansökningar</h1>
        <p className="mt-1 text-stone-500">
          Följ status för dina bostadsansökningar och svara på erbjudanden.
        </p>
      </header>

      {skickad === "1" && (
        <div role="status" className="card border-l-4 border-l-brand-600 bg-brand-50 p-4 text-sm font-medium text-brand-900">
          Din ansökan är inskickad! Vi återkommer så snart den har granskats.
        </div>
      )}

      {applications.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-semibold text-stone-700">Du har inga ansökningar ännu.</p>
          <Link href="/lediga-bostader" className="btn-primary mt-4">Sök bostad</Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {applications.map((app) => {
            const activeOffer = app.offers.find((o) => o.personId === user.personId && new Date(o.expiresAt) > new Date());
            const isMain = app.members.some((m) => m.personId === user.personId && m.role === "MAIN_APPLICANT");
            return (
              <li key={app.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-stone-900">
                      <Link href={`/annons/${app.listing.slug}`} className="hover:underline">
                        {app.listing.title}
                      </Link>
                    </h2>
                    <p className="text-sm text-stone-500">
                      {app.listing.unit.address}, {app.listing.unit.city} · Ansökt{" "}
                      {app.submittedAt ? new Date(app.submittedAt).toLocaleDateString("sv-SE") : "–"}
                      {!isMain && " · Medsökande"}
                      {app.isInternalTransfer && " · Intern omflyttning"}
                    </p>
                  </div>
                  <ApplicationStatusBadge status={app.status} />
                </div>

                {activeOffer && isMain && (
                  <div className="mt-4 rounded-xl border border-accent-500/40 bg-accent-500/10 p-4">
                    <p className="font-semibold text-stone-900">
                      Du har fått ett erbjudande om denna bostad!
                    </p>
                    <p className="mt-1 text-sm text-stone-600">
                      Svara senast {new Date(activeOffer.expiresAt).toLocaleDateString("sv-SE")}.
                      {app.isInternalTransfer &&
                        " Om du accepterar sägs ditt nuvarande avtal upp automatiskt och datumen samordnas."}
                    </p>
                    <OfferResponseForm offerId={activeOffer.id} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
