import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ApplicationForm } from "./ApplicationForm";

export const metadata = { title: "Ansök om bostad" };
export const dynamic = "force-dynamic";

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/logga-in?next=/annons/${slug}/ansok`);
  if (!user.personId) redirect("/mina-sidor/profil?komplettera=1");

  const listing = await prisma.listing.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: { unit: true },
  });
  if (!listing) notFound();

  const activeContract = await prisma.contract.findFirst({
    where: {
      status: "ACTIVE",
      parties: { some: { personId: user.personId, role: { in: ["TENANT", "CO_TENANT"] } } },
    },
    include: { unit: { select: { address: true, city: true } } },
  });

  const existingApplication = await prisma.application.findFirst({
    where: {
      listingId: listing.id,
      members: { some: { personId: user.personId, role: "MAIN_APPLICANT" } },
      status: { notIn: ["CLOSED", "WITHDRAWN", "DECLINED"] },
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <nav aria-label="Brödsmulor" className="mb-4 text-sm text-stone-500">
        <Link href={`/annons/${listing.slug}`} className="hover:text-brand-700">
          ← Tillbaka till annonsen
        </Link>
      </nav>
      <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl">
        Ansök om {listing.title}
      </h1>
      <p className="mt-1 text-stone-500">
        {listing.unit.address}, {listing.unit.city}
      </p>

      {existingApplication ? (
        <div className="card mt-6 p-6">
          <p className="font-semibold text-stone-900">Du har redan en aktiv ansökan för detta objekt.</p>
          <p className="mt-1 text-sm text-stone-600">
            Du kan följa din ansökan under{" "}
            <Link href="/mina-sidor/ansokningar" className="font-medium text-brand-700 underline">
              Mina ansökningar
            </Link>.
          </p>
        </div>
      ) : (
        <>
          {activeContract && (
            <div className="mt-6 rounded-xl bg-brand-50 p-4 text-sm text-brand-900">
              <p className="font-semibold">Du hyr redan {activeContract.unit.address}, {activeContract.unit.city}.</p>
              <p className="mt-1">
                Du kan ändå söka den här bostaden. Om du får den hjälper vi dig att
                samordna uppsägningen av ditt nuvarande avtal (intern omflyttning).
              </p>
            </div>
          )}
          <ApplicationForm
            listingId={listing.id}
            slug={listing.slug}
            hasActiveContract={Boolean(activeContract)}
          />
        </>
      )}
    </div>
  );
}
