import Link from "next/link";
import { searchListings, type ListingSearchParams } from "@/lib/services/listings";
import { ListingCard, type ListingWithUnit } from "@/components/ListingCard";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ListingCategory } from "@/lib/database-types";
import { SaveSearchButton } from "./SaveSearchButton";

export interface SearchPageProps {
  title: string;
  description: string;
  category?: ListingCategory;
  basePath: string;
  searchParams: Record<string, string | string[] | undefined>;
}

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function num(v: string | string[] | undefined): number | undefined {
  const s = str(v);
  if (!s) return undefined;
  const n = parseFloat(s);
  return isFinite(n) ? n : undefined;
}

function bool(v: string | string[] | undefined): boolean | undefined {
  return str(v) === "1" ? true : undefined;
}

export async function ListingSearchPage({
  title,
  description,
  category,
  basePath,
  searchParams,
}: SearchPageProps) {
  const user = await getCurrentUser();

  const params: ListingSearchParams = {
    q: str(searchParams.q),
    category,
    city: str(searchParams.city),
    area: str(searchParams.area),
    rentMin: num(searchParams.rentMin),
    rentMax: num(searchParams.rentMax),
    priceMin: num(searchParams.priceMin),
    priceMax: num(searchParams.priceMax),
    roomsMin: num(searchParams.rooms),
    livingAreaMin: num(searchParams.areaMin),
    floorMin: num(searchParams.floorMin),
    elevator: bool(searchParams.elevator),
    balcony: bool(searchParams.balcony),
    patio: bool(searchParams.patio),
    furnished: bool(searchParams.furnished),
    accessible: bool(searchParams.accessible),
    pets: bool(searchParams.pets),
    parking: bool(searchParams.parking),
    storage: bool(searchParams.storage),
    shortTerm: bool(searchParams.shortTerm),
    student: bool(searchParams.student),
    senior: bool(searchParams.senior),
    moveInBefore: str(searchParams.moveIn) ? new Date(str(searchParams.moveIn)!) : undefined,
    sort: (str(searchParams.sort) as ListingSearchParams["sort"]) ?? "latest",
    page: num(searchParams.page) ?? 1,
  };

  const [result, cities, favorites] = await Promise.all([
    searchListings(params),
    db.unit.findMany({
      where: { listings: { some: { status: "PUBLISHED" } } },
      select: { city: true },
      distinct: ["city"],
    }),
    user?.personId
      ? db.favorite.findMany({ where: { personId: user.personId }, select: { listingId: true } })
      : Promise.resolve([]),
  ]);
  const favoriteIds = new Set(favorites.map((f) => f.listingId));
  const isSale = category === "SALE";

  const checkboxes: { name: string; label: string }[] = [
    { name: "elevator", label: "Hiss" },
    { name: "balcony", label: "Balkong" },
    { name: "patio", label: "Uteplats" },
    { name: "furnished", label: "Möblerad" },
    { name: "accessible", label: "Tillgänglighetsanpassad" },
    { name: "pets", label: "Husdjur tillåtna" },
    { name: "parking", label: "Parkering" },
    { name: "storage", label: "Förråd" },
    { name: "shortTerm", label: "Korttidsavtal" },
    { name: "student", label: "Studentbostad" },
    { name: "senior", label: "Seniorboende" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl">{title}</h1>
        <p className="mt-1 text-stone-500">{description}</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
        {/* Filter */}
        <aside aria-label="Filtrera sökresultat">
          <form method="GET" action={basePath} className="card space-y-4 p-4">
            <div>
              <label htmlFor="q" className="label">Fritextsökning</label>
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={params.q ?? ""}
                placeholder="Ort, område eller adress"
                className="input"
              />
            </div>
            <div>
              <label htmlFor="city" className="label">Ort</label>
              <select id="city" name="city" defaultValue={params.city ?? ""} className="input">
                <option value="">Alla orter</option>
                {cities.map((c) => (
                  <option key={c.city} value={c.city}>{c.city}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="area" className="label">Område</label>
              <input id="area" name="area" defaultValue={str(searchParams.area) ?? ""} className="input" placeholder="T.ex. Innerstaden" />
            </div>
            {isSale ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="priceMin" className="label">Pris från</label>
                  <input id="priceMin" name="priceMin" type="number" min="0" defaultValue={params.priceMin ?? ""} className="input" />
                </div>
                <div>
                  <label htmlFor="priceMax" className="label">Pris till</label>
                  <input id="priceMax" name="priceMax" type="number" min="0" defaultValue={params.priceMax ?? ""} className="input" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="rentMin" className="label">Hyra från</label>
                  <input id="rentMin" name="rentMin" type="number" min="0" defaultValue={params.rentMin ?? ""} className="input" />
                </div>
                <div>
                  <label htmlFor="rentMax" className="label">Hyra till</label>
                  <input id="rentMax" name="rentMax" type="number" min="0" defaultValue={params.rentMax ?? ""} className="input" />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="rooms" className="label">Minst antal rum</label>
                <input id="rooms" name="rooms" type="number" min="1" step="0.5" defaultValue={params.roomsMin ?? ""} className="input" />
              </div>
              <div>
                <label htmlFor="areaMin" className="label">Minsta boyta</label>
                <input id="areaMin" name="areaMin" type="number" min="0" defaultValue={params.livingAreaMin ?? ""} className="input" />
              </div>
            </div>
            <div>
              <label htmlFor="moveIn" className="label">Inflyttning senast</label>
              <input id="moveIn" name="moveIn" type="date" defaultValue={str(searchParams.moveIn) ?? ""} className="input" />
            </div>
            <fieldset>
              <legend className="label">Egenskaper</legend>
              <div className="grid grid-cols-1 gap-1.5">
                {checkboxes.map((c) => (
                  <label key={c.name} className="flex items-center gap-2 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      name={c.name}
                      value="1"
                      defaultChecked={bool(searchParams[c.name]) === true}
                      className="h-4 w-4 rounded border-stone-300 text-brand-700"
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1">Filtrera</button>
              <Link href={basePath} className="btn-secondary">Rensa</Link>
            </div>
          </form>
          {user?.personId && (
            <SaveSearchButton searchParams={searchParams} basePath={basePath} />
          )}
        </aside>

        {/* Resultat */}
        <section aria-label="Sökresultat">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-stone-600" role="status">
              {result.total === 0
                ? "Inga objekt matchade din sökning."
                : `${result.total} objekt hittades.`}
            </p>
            <form method="GET" action={basePath} className="flex items-center gap-2">
              {Object.entries(searchParams)
                .filter(([k, v]) => k !== "sort" && k !== "page" && typeof v === "string" && v)
                .map(([k, v]) => (
                  <input key={k} type="hidden" name={k} value={v as string} />
                ))}
              <label htmlFor="sort" className="text-sm text-stone-600">Sortera:</label>
              <select
                id="sort"
                name="sort"
                defaultValue={params.sort}
                className="input w-auto py-1.5"
              >
                <option value="latest">Senaste</option>
                {isSale ? (
                  <>
                    <option value="price_asc">Pris, lägst först</option>
                    <option value="price_desc">Pris, högst först</option>
                  </>
                ) : (
                  <>
                    <option value="rent_asc">Hyra, lägst först</option>
                    <option value="rent_desc">Hyra, högst först</option>
                  </>
                )}
                <option value="area_desc">Boyta, störst först</option>
                <option value="move_in">Inflyttningsdatum</option>
              </select>
              <button type="submit" className="btn-secondary py-1.5">OK</button>
            </form>
          </div>

          {result.items.length === 0 ? (
            <div className="card flex flex-col items-center gap-3 p-12 text-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="text-stone-300" aria-hidden="true">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
                <path d="m16 16 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <p className="font-semibold text-stone-700">Inga objekt matchade din sökning</p>
              <p className="max-w-sm text-sm text-stone-500">
                Prova att bredda dina filter eller spara sökningen som bevakning så
                meddelar vi dig när nya matchande objekt publiceras.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {result.items.map((l) => (
                <ListingCard
                  key={l.id}
                  listing={l as ListingWithUnit}
                  isFavorite={favoriteIds.has(l.id)}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {result.totalPages > 1 && (
            <nav aria-label="Sidor" className="mt-8 flex justify-center gap-2">
              {Array.from({ length: result.totalPages }, (_, i) => i + 1).map((p) => {
                const sp = new URLSearchParams();
                for (const [k, v] of Object.entries(searchParams)) {
                  if (typeof v === "string" && v && k !== "page") sp.set(k, v);
                }
                sp.set("page", String(p));
                return (
                  <Link
                    key={p}
                    href={`${basePath}?${sp.toString()}`}
                    aria-current={p === result.page ? "page" : undefined}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium ${
                      p === result.page
                        ? "bg-brand-700 text-white"
                        : "bg-white text-stone-700 hover:bg-stone-100"
                    }`}
                  >
                    {p}
                  </Link>
                );
              })}
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
