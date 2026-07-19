import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ListingCard, type ListingWithUnit } from "@/components/ListingCard";

export const dynamic = "force-dynamic";

async function getHomeData(personId: string | null) {
  const [rentals, sales, commercial, parking, latest, upcoming, featured, favorites] =
    await Promise.all([
      prisma.listing.findMany({
        where: { status: "PUBLISHED", category: "RENTAL" },
        include: { unit: { include: { media: { where: { kind: "IMAGE" }, take: 1, orderBy: { sortOrder: "asc" } } } } },
        orderBy: { publishedAt: "desc" },
        take: 6,
      }),
      prisma.listing.findMany({
        where: { status: "PUBLISHED", category: "SALE" },
        include: { unit: { include: { media: { where: { kind: "IMAGE" }, take: 1, orderBy: { sortOrder: "asc" } } } } },
        orderBy: { publishedAt: "desc" },
        take: 3,
      }),
      prisma.listing.findMany({
        where: { status: "PUBLISHED", category: "COMMERCIAL" },
        include: { unit: { include: { media: { where: { kind: "IMAGE" }, take: 1, orderBy: { sortOrder: "asc" } } } } },
        orderBy: { publishedAt: "desc" },
        take: 3,
      }),
      prisma.listing.findMany({
        where: { status: "PUBLISHED", category: "PARKING" },
        include: { unit: { include: { media: { where: { kind: "IMAGE" }, take: 1, orderBy: { sortOrder: "asc" } } } } },
        orderBy: { publishedAt: "desc" },
        take: 3,
      }),
      prisma.listing.findMany({
        where: { status: "PUBLISHED" },
        include: { unit: { include: { media: { where: { kind: "IMAGE" }, take: 1, orderBy: { sortOrder: "asc" } } } } },
        orderBy: { publishedAt: "desc" },
        take: 3,
      }),
      prisma.unit.findMany({
        where: { status: "UPCOMING" },
        orderBy: { availableFrom: "asc" },
        take: 4,
      }),
      prisma.listing.findMany({
        where: { status: "PUBLISHED", featured: true },
        include: { unit: { include: { media: { where: { kind: "IMAGE" }, take: 1, orderBy: { sortOrder: "asc" } } } } },
        take: 3,
      }),
      personId
        ? prisma.favorite.findMany({ where: { personId }, select: { listingId: true } })
        : Promise.resolve([]),
    ]);
  return {
    rentals,
    sales,
    commercial,
    parking,
    latest,
    upcoming,
    featured,
    favoriteIds: new Set(favorites.map((f) => f.listingId)),
  };
}

function Section({
  id,
  title,
  moreHref,
  moreLabel,
  listings,
  favoriteIds,
}: {
  id: string;
  title: string;
  moreHref: string;
  moreLabel: string;
  listings: ListingWithUnit[];
  favoriteIds: Set<string>;
}) {
  if (listings.length === 0) return null;
  return (
    <section aria-labelledby={id} className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 id={id} className="text-xl font-bold text-stone-900 sm:text-2xl">
          {title}
        </h2>
        <Link href={moreHref} className="text-sm font-semibold text-brand-700 hover:underline">
          {moreLabel} →
        </Link>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((l) => (
          <ListingCard key={l.id} listing={l} isFavorite={favoriteIds.has(l.id)} />
        ))}
      </div>
    </section>
  );
}

export default async function HomePage() {
  const user = await getCurrentUser();
  const data = await getHomeData(user?.personId ?? null);

  return (
    <>
      {/* Hero med sökfunktion */}
      <section className="bg-gradient-to-br from-brand-900 via-brand-800 to-brand-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-extrabold leading-tight sm:text-5xl">
              Hitta ditt nästa hem i Östergötland
            </h1>
            <p className="mt-4 text-lg text-brand-100">
              Östgöta El Teknik hyr ut och säljer lägenheter, lokaler och
              parkeringsplatser. Sök bland våra publicerade objekt eller skapa
              en bevakning så hör vi av oss.
            </p>
          </div>
          <form
            action="/lediga-bostader"
            method="GET"
            className="mt-8 flex max-w-2xl flex-col gap-3 rounded-2xl bg-white p-3 shadow-lg sm:flex-row"
            role="search"
            aria-label="Sök bostäder"
          >
            <label htmlFor="hero-q" className="sr-only">
              Sök efter ort, område eller adress
            </label>
            <input
              id="hero-q"
              name="q"
              type="search"
              placeholder="Sök på ort, område eller adress …"
              className="input flex-1 border-0 shadow-none"
            />
            <button type="submit" className="btn-primary sm:px-8">
              Sök bostad
            </button>
          </form>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <Link href="/lediga-bostader" className="rounded-full bg-white/10 px-4 py-1.5 font-medium hover:bg-white/20">
              Till uthyrning
            </Link>
            <Link href="/till-salu" className="rounded-full bg-white/10 px-4 py-1.5 font-medium hover:bg-white/20">
              Till salu
            </Link>
            <Link href="/lokaler" className="rounded-full bg-white/10 px-4 py-1.5 font-medium hover:bg-white/20">
              Lokaler
            </Link>
            <Link href="/parkering" className="rounded-full bg-white/10 px-4 py-1.5 font-medium hover:bg-white/20">
              Parkering
            </Link>
          </div>
        </div>
      </section>

      {/* Snabblänkar */}
      <section aria-label="Snabblänkar" className="border-b border-stone-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:grid-cols-3 sm:px-6">
          <Link href="/felanmalan" className="card flex items-center gap-4 p-4 transition hover:shadow-md">
            <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-500/20 text-accent-600">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="m14.7 6.3 3 3L8 19H5v-3l9.7-9.7ZM16 5l1.6-1.6a1.5 1.5 0 0 1 2.1 0l.9.9a1.5 1.5 0 0 1 0 2.1L19 8l-3-3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>
            </span>
            <span>
              <span className="block font-semibold text-stone-900">Felanmälan</span>
              <span className="block text-sm text-stone-500">Anmäl fel i din bostad eller fastighet</span>
            </span>
          </Link>
          <Link href="/mina-sidor" className="card flex items-center gap-4 p-4 transition hover:shadow-md">
            <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            </span>
            <span>
              <span className="block font-semibold text-stone-900">Mina sidor</span>
              <span className="block text-sm text-stone-500">Avtal, fakturor, ansökningar och ärenden</span>
            </span>
          </Link>
          <Link href="/lediga-bostader" className="card flex items-center gap-4 p-4 transition hover:shadow-md">
            <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 11 12 4l9 7M5 9.5V20h5v-6h4v6h5V9.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>
            </span>
            <span>
              <span className="block font-semibold text-stone-900">Sök bostad</span>
              <span className="block text-sm text-stone-500">Ansök om lediga lägenheter direkt</span>
            </span>
          </Link>
        </div>
      </section>

      <Section
        id="featured"
        title="Utvalda objekt"
        moreHref="/lediga-bostader"
        moreLabel="Visa alla"
        listings={data.featured as ListingWithUnit[]}
        favoriteIds={data.favoriteIds}
      />
      <Section
        id="uthyrning"
        title="Till uthyrning"
        moreHref="/lediga-bostader"
        moreLabel="Alla lediga bostäder"
        listings={data.rentals as ListingWithUnit[]}
        favoriteIds={data.favoriteIds}
      />
      <Section
        id="till-salu"
        title="Till salu"
        moreHref="/till-salu"
        moreLabel="Allt till salu"
        listings={data.sales as ListingWithUnit[]}
        favoriteIds={data.favoriteIds}
      />
      <Section
        id="lokaler"
        title="Lediga lokaler"
        moreHref="/lokaler"
        moreLabel="Alla lokaler"
        listings={data.commercial as ListingWithUnit[]}
        favoriteIds={data.favoriteIds}
      />
      <Section
        id="parkering"
        title="Lediga parkeringsplatser"
        moreHref="/parkering"
        moreLabel="Alla parkeringar"
        listings={data.parking as ListingWithUnit[]}
        favoriteIds={data.favoriteIds}
      />

      {/* Kommande objekt */}
      {data.upcoming.length > 0 && (
        <section aria-labelledby="kommande" className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
            <h2 id="kommande" className="mb-5 text-xl font-bold text-stone-900 sm:text-2xl">
              Kommande lediga objekt
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {data.upcoming.map((u) => (
                <li key={u.id} className="card p-4">
                  <p className="font-semibold text-stone-900">{u.address}</p>
                  <p className="text-sm text-stone-500">{u.city}</p>
                  <p className="mt-2 text-sm text-stone-600">
                    {u.rooms != null ? `${Number(u.rooms)} rum · ` : ""}
                    {u.livingArea != null ? `${Number(u.livingArea)} m²` : ""}
                  </p>
                  <p className="mt-1 text-sm font-medium text-brand-700">
                    Ledigt från{" "}
                    {u.availableFrom
                      ? new Date(u.availableFrom).toLocaleDateString("sv-SE")
                      : "datum ej fastställt"}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-stone-500">
              Skapa en <Link href="/mina-sidor/bevakningar" className="font-medium text-brand-700 underline">bevakning</Link>{" "}
              så meddelar vi dig när objekten publiceras.
            </p>
          </div>
        </section>
      )}

      {/* Senast publicerade */}
      <Section
        id="senaste"
        title="Senast publicerade"
        moreHref="/lediga-bostader?sort=latest"
        moreLabel="Visa fler"
        listings={data.latest as ListingWithUnit[]}
        favoriteIds={data.favoriteIds}
      />

      {/* Om oss + FAQ */}
      <section aria-labelledby="om-oss" className="bg-brand-50">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 id="om-oss" className="text-2xl font-bold text-stone-900">
              Om Östgöta El Teknik
            </h2>
            <p className="mt-4 leading-relaxed text-stone-600">
              Östgöta El Teknik är ett familjeägt fastighetsbolag med rötterna i
              elteknikbranschen. Vi äger och förvaltar bostäder, lokaler och
              parkeringar i Linköping, Norrköping och Motala – alltid med fokus
              på trygghet, energieffektivitet och personlig service.
            </p>
            <p className="mt-3 leading-relaxed text-stone-600">
              Som hyresgäst hos oss får du tillgång till Mina sidor där du ser
              ditt avtal, dina fakturor och kan göra felanmälningar dygnet runt.
            </p>
            <Link href="/kontakt" className="btn-primary mt-6">
              Kontakta oss
            </Link>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-stone-900">Vanliga frågor</h2>
            <dl className="mt-4 space-y-4">
              <div className="card p-4">
                <dt className="font-semibold text-stone-900">Hur ansöker jag om en lägenhet?</dt>
                <dd className="mt-1 text-sm text-stone-600">
                  Skapa ett konto, öppna annonsen och klicka på &quot;Ansök&quot;. Du kan
                  ansöka även om du redan hyr en bostad av oss – ange då gärna att
                  det gäller intern omflyttning.
                </dd>
              </div>
              <div className="card p-4">
                <dt className="font-semibold text-stone-900">Var hittar jag mina fakturor?</dt>
                <dd className="mt-1 text-sm text-stone-600">
                  Under Mina sidor → Mina fakturor. Fakturorna hämtas automatiskt
                  från vårt ekonomisystem med OCR och förfallodatum.
                </dd>
              </div>
              <div className="card p-4">
                <dt className="font-semibold text-stone-900">Hur säger jag upp mitt avtal?</dt>
                <dd className="mt-1 text-sm text-stone-600">
                  Logga in på Mina sidor, öppna ditt avtal och välj &quot;Säg upp
                  avtal&quot;. Systemet räknar automatiskt ut tidigaste utflyttningsdatum
                  utifrån din uppsägningstid.
                </dd>
              </div>
            </dl>
            <Link href="/vanliga-fragor" className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:underline">
              Fler vanliga frågor →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
