import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatSek, formatDate } from "@/components/ListingCard";
import { FavoriteButton } from "@/components/FavoriteButton";

export const dynamic = "force-dynamic";

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = await prisma.listing.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: {
      unit: {
        include: {
          media: { orderBy: { sortOrder: "asc" } },
          property: { select: { name: true, energyClass: true, yearBuilt: true } },
        },
      },
      viewings: {
        where: { startsAt: { gte: new Date() } },
        orderBy: { startsAt: "asc" },
        take: 5,
      },
    },
  });
  if (!listing) notFound();

  const user = await getCurrentUser();
  const isFavorite = user?.personId
    ? Boolean(
        await prisma.favorite.findUnique({
          where: { personId_listingId: { personId: user.personId, listingId: listing.id } },
        })
      )
    : false;

  const hasActiveContract = user?.personId
    ? Boolean(
        await prisma.contract.findFirst({
          where: {
            status: "ACTIVE",
            parties: { some: { personId: user.personId, role: { in: ["TENANT", "CO_TENANT"] } } },
          },
        })
      )
    : false;

  const { unit } = listing;
  const isSale = listing.category === "SALE";
  const images = unit.media.filter((m) => m.kind === "IMAGE");
  const floorplans = unit.media.filter((m) => m.kind === "FLOORPLAN");

  const facts: [string, string][] = [
    ["Objektsnummer", unit.unitNumber],
    ...(unit.apartmentNumber ? ([["Lägenhetsnummer", unit.apartmentNumber]] as [string, string][]) : []),
    ...(unit.rooms != null ? ([["Antal rum", `${Number(unit.rooms)}`]] as [string, string][]) : []),
    ...(unit.livingArea != null ? ([["Boyta", `${Number(unit.livingArea)} m²`]] as [string, string][]) : []),
    ...(unit.secondaryArea != null ? ([["Biarea", `${Number(unit.secondaryArea)} m²`]] as [string, string][]) : []),
    ...(unit.floorLevel != null ? ([["Våning", `${unit.floorLevel}`]] as [string, string][]) : []),
    ["Tillträde", formatDate(listing.moveInDate)],
    ...(isSale
      ? ([["Pris", `${formatSek(listing.price ?? unit.price)} kr`]] as [string, string][])
      : ([
          ["Hyra", `${formatSek(listing.rent ?? unit.rent)} kr/mån`],
          ["Uppsägningstid", `${unit.noticePeriodMonths} månader`],
        ] as [string, string][])),
    ...(unit.deposit != null ? ([["Deposition", `${formatSek(unit.deposit)} kr`]] as [string, string][]) : []),
    ...(unit.operatingCost != null ? ([["Driftkostnad", `${formatSek(unit.operatingCost)} kr/mån`]] as [string, string][]) : []),
    ...(unit.property.energyClass ? ([["Energiklass", unit.property.energyClass]] as [string, string][]) : []),
    ...(unit.property.yearBuilt ? ([["Byggnadsår", `${unit.property.yearBuilt}`]] as [string, string][]) : []),
  ];

  const amenities = [
    unit.hasElevator && "Hiss",
    unit.hasBalcony && "Balkong",
    unit.hasPatio && "Uteplats",
    unit.hasStorage && "Förråd ingår",
    unit.hasParking && "Parkering finns",
    unit.furnished && "Möblerad",
    unit.accessible && "Tillgänglighetsanpassad",
    unit.petsAllowed && "Husdjur tillåtna",
    unit.internetIncluded && "Internet ingår",
    unit.tvIncluded && "TV ingår",
    unit.heatingIncluded && "Värme ingår",
    unit.waterIncluded && "Vatten ingår",
    unit.electricityIncluded && "El ingår",
  ].filter(Boolean) as string[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <nav aria-label="Brödsmulor" className="mb-4 text-sm text-stone-500">
        <ol className="flex flex-wrap items-center gap-2">
          <li><Link href="/" className="hover:text-brand-700">Startsida</Link></li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href={isSale ? "/till-salu" : listing.category === "COMMERCIAL" ? "/lokaler" : listing.category === "PARKING" ? "/parkering" : "/lediga-bostader"}
              className="hover:text-brand-700"
            >
              {isSale ? "Till salu" : listing.category === "COMMERCIAL" ? "Lokaler" : listing.category === "PARKING" ? "Parkering" : "Lediga bostäder"}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-medium text-stone-700">{listing.title}</li>
        </ol>
      </nav>

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-100 to-brand-200">
        {images.length > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={images[0].url} alt={images[0].caption ?? listing.title} className="aspect-[16/8] w-full object-cover" />
        ) : (
          <div className="flex aspect-[16/8] items-center justify-center" aria-hidden="true">
            <svg width="72" height="72" viewBox="0 0 24 24" fill="none" className="text-brand-400">
              <path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </div>
        )}
        <FavoriteButton listingId={listing.id} initialFavorite={isFavorite} />
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl">{listing.title}</h1>
          <p className="mt-1 text-stone-500">
            {unit.address}
            {unit.area ? `, ${unit.area}` : ""} · {unit.postalCode} {unit.city}
          </p>

          <section aria-labelledby="beskrivning" className="mt-6">
            <h2 id="beskrivning" className="text-lg font-semibold text-stone-900">Beskrivning</h2>
            <p className="mt-2 whitespace-pre-line leading-relaxed text-stone-600">{listing.description}</p>
          </section>

          {amenities.length > 0 && (
            <section aria-labelledby="egenskaper" className="mt-6">
              <h2 id="egenskaper" className="text-lg font-semibold text-stone-900">Egenskaper</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {amenities.map((a) => (
                  <li key={a} className="badge bg-brand-50 text-brand-800">{a}</li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="fakta" className="mt-6">
            <h2 id="fakta" className="text-lg font-semibold text-stone-900">Fakta</h2>
            <dl className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
              {facts.map(([label, value]) => (
                <div key={label} className="flex justify-between border-b border-stone-100 py-2 text-sm">
                  <dt className="text-stone-500">{label}</dt>
                  <dd className="font-medium text-stone-900">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {floorplans.length > 0 && (
            <section aria-labelledby="planritning" className="mt-6">
              <h2 id="planritning" className="text-lg font-semibold text-stone-900">Planritning</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {floorplans.map((f) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={f.id} src={f.url} alt={f.caption ?? "Planritning"} className="rounded-lg border border-stone-200" />
                ))}
              </div>
            </section>
          )}

          {listing.viewings.length > 0 && (
            <section aria-labelledby="visningar" className="mt-6">
              <h2 id="visningar" className="text-lg font-semibold text-stone-900">Kommande visningar</h2>
              <ul className="mt-3 space-y-2">
                {listing.viewings.map((v) => (
                  <li key={v.id} className="card flex items-center justify-between p-4 text-sm">
                    <span>
                      {new Date(v.startsAt).toLocaleString("sv-SE", { dateStyle: "full", timeStyle: "short" })}
                      {v.location ? ` · ${v.location}` : ""}
                    </span>
                    <span className="badge bg-brand-50 text-brand-800">
                      {v.kind === "GROUP" ? "Gruppvisning" : v.kind === "DIGITAL" ? "Digital" : v.kind === "SELF_SERVICE" ? "Självvisning" : "Individuell"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside>
          <div className="card sticky top-24 p-6">
            <p className="text-2xl font-bold text-brand-800">
              {isSale
                ? `${formatSek(listing.price ?? unit.price)} kr`
                : `${formatSek(listing.rent ?? unit.rent)} kr/mån`}
            </p>
            {listing.applicationDeadline && (
              <p className="mt-1 text-sm text-stone-500">
                Sista ansökningsdag {formatDate(listing.applicationDeadline)}
              </p>
            )}
            <div className="mt-5 flex flex-col gap-2">
              {user ? (
                <Link href={`/annons/${listing.slug}/ansok`} className="btn-primary w-full">
                  {isSale ? "Anmäl intresse" : "Ansök om bostaden"}
                </Link>
              ) : (
                <>
                  <Link href={`/logga-in?next=/annons/${listing.slug}/ansok`} className="btn-primary w-full">
                    Logga in för att ansöka
                  </Link>
                  <Link href="/skapa-konto" className="btn-secondary w-full">
                    Skapa konto
                  </Link>
                </>
              )}
            </div>
            {hasActiveContract && (
              <p className="mt-3 rounded-lg bg-brand-50 p-3 text-sm text-brand-800">
                Du hyr redan hos oss – du kan så klart ändå söka den här bostaden.
                Ansökan markeras som intern omflyttning.
              </p>
            )}
            {(listing.contactName || listing.contactEmail || listing.contactPhone) && (
              <div className="mt-5 border-t border-stone-100 pt-4 text-sm">
                <h2 className="font-semibold text-stone-900">Kontaktperson</h2>
                {listing.contactName && <p className="mt-1 text-stone-600">{listing.contactName}</p>}
                {listing.contactPhone && (
                  <p><a className="text-brand-700 hover:underline" href={`tel:${listing.contactPhone}`}>{listing.contactPhone}</a></p>
                )}
                {listing.contactEmail && (
                  <p><a className="text-brand-700 hover:underline" href={`mailto:${listing.contactEmail}`}>{listing.contactEmail}</a></p>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
