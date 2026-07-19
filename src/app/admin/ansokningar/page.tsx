import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { ApplicationStatusBadge } from "@/components/StatusBadges";
import { changeApplicationStatusAction, sendOfferAction } from "../actions";
import { applicationTransitions } from "@/lib/state-machines";
import { formatSek } from "@/components/ListingCard";

export const metadata = { title: "Admin – Ansökningar" };

export default async function AdminApplicationsPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId || !hasPermission(user.permissions, "applications", "read")) {
    redirect("/admin");
  }

  const applications = await prisma.application.findMany({
    where: { organizationId: user.organizationId },
    include: {
      listing: { include: { unit: { select: { address: true, unitNumber: true } } } },
      members: { include: { person: true } },
      offers: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const canUpdate = hasPermission(user.permissions, "applications", "update");
  const canOffer = hasPermission(user.permissions, "offers", "create");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-stone-900">Ansökningar</h1>

      {applications.length === 0 ? (
        <div className="card p-10 text-center text-stone-500">Inga ansökningar ännu.</div>
      ) : (
        <ul className="space-y-4">
          {applications.map((app) => {
            const main = app.members.find((m) => m.role === "MAIN_APPLICANT");
            const nextStatuses = (applicationTransitions[app.status] ?? []).filter(
              (s) => s !== "OFFER_SENT"
            );
            return (
              <li key={app.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-stone-900">
                      {app.listing.title}{" "}
                      <span className="font-normal text-stone-500">
                        ({app.listing.unit.unitNumber} · {app.listing.unit.address})
                      </span>
                    </h2>
                    <p className="mt-0.5 text-sm text-stone-600">
                      Huvudsökande:{" "}
                      <strong>{main ? `${main.person.firstName} ${main.person.lastName}` : "–"}</strong>
                      {main?.person.email && ` · ${main.person.email}`}
                    </p>
                    <p className="text-sm text-stone-500">
                      Inkomst: {app.monthlyIncome ? `${formatSek(app.monthlyIncome)} kr/mån` : "–"} ·{" "}
                      Sysselsättning: {app.employment ?? "–"} ·{" "}
                      Ansökt: {app.submittedAt ? new Date(app.submittedAt).toLocaleDateString("sv-SE") : "–"}
                      {app.isInternalTransfer && (
                        <span className="badge ml-2 bg-brand-700 text-white">Intern omflyttning</span>
                      )}
                    </p>
                    {app.message && <p className="mt-1 text-sm italic text-stone-500">&quot;{app.message}&quot;</p>}
                  </div>
                  <ApplicationStatusBadge status={app.status} />
                </div>

                {canUpdate && (
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-stone-100 pt-3">
                    {nextStatuses.map((next) => (
                      <form key={next} action={changeApplicationStatusAction}>
                        <input type="hidden" name="applicationId" value={app.id} />
                        <input type="hidden" name="toStatus" value={next} />
                        <button type="submit" className="rounded border border-stone-300 px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100">
                          → {next}
                        </button>
                      </form>
                    ))}
                    {canOffer &&
                      (applicationTransitions[app.status] ?? []).includes("OFFER_SENT") &&
                      app.offers.filter((o) => o.status === "SENT").length === 0 && (
                        <form action={sendOfferAction}>
                          <input type="hidden" name="applicationId" value={app.id} />
                          <button type="submit" className="rounded bg-brand-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-800">
                            Skicka erbjudande
                          </button>
                        </form>
                      )}
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
