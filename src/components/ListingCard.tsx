import Link from "next/link";
import type { Listing, Unit, UnitMedia } from "@prisma/client";
import { FavoriteButton } from "./FavoriteButton";

export type ListingWithUnit = Listing & {
  unit: Unit & { media?: UnitMedia[] };
};

const typeLabels: Record<string, string> = {
  APARTMENT: "Hyreslägenhet",
  APARTMENT_SALE: "Bostad till salu",
  COMMERCIAL: "Lokal",
  OFFICE: "Kontor",
  RETAIL: "Butik",
  WAREHOUSE: "Lager",
  GARAGE: "Garage",
  PARKING: "Parkering",
  STORAGE: "Förråd",
  STUDENT: "Studentbostad",
  SHORT_TERM: "Korttidsboende",
  LAND: "Mark",
  PROPERTY_SALE: "Fastighet till salu",
};

export function formatSek(value: unknown): string {
  const n = Number(value);
  if (!isFinite(n)) return "–";
  return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(n);
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "Enligt överenskommelse";
  return new Date(d).toLocaleDateString("sv-SE");
}

export function ListingCard({
  listing,
  isFavorite,
  showFavorite = true,
}: {
  listing: ListingWithUnit;
  isFavorite?: boolean;
  showFavorite?: boolean;
}) {
  const { unit } = listing;
  const image = unit.media?.[0];
  const isSale = listing.category === "SALE";

  return (
    <article className="card group relative flex flex-col overflow-hidden transition hover:shadow-md">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-brand-100 to-brand-200">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.url}
            alt={image.caption ?? `Bild på ${listing.title}`}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center" aria-hidden="true">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="text-brand-400">
              <path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </div>
        )}
        <span className="badge absolute left-3 top-3 bg-white/95 text-stone-700 shadow-sm">
          {typeLabels[unit.type] ?? unit.type}
        </span>
        {showFavorite && <FavoriteButton listingId={listing.id} initialFavorite={isFavorite ?? false} />}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-base font-semibold text-stone-900">
          <Link href={`/annons/${listing.slug}`} className="after:absolute after:inset-0">
            {listing.title}
          </Link>
        </h3>
        <p className="mt-0.5 text-sm text-stone-500">
          {unit.address}
          {unit.area ? `, ${unit.area}` : ""} · {unit.city}
        </p>
        <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-600">
          {unit.rooms != null && (
            <div>
              <dt className="sr-only">Antal rum</dt>
              <dd>{Number(unit.rooms)} rum</dd>
            </div>
          )}
          {unit.livingArea != null && (
            <div>
              <dt className="sr-only">Boyta</dt>
              <dd>{Number(unit.livingArea)} m²</dd>
            </div>
          )}
          <div>
            <dt className="sr-only">Tillträde</dt>
            <dd>Tillträde {formatDate(listing.moveInDate)}</dd>
          </div>
        </dl>
        {listing.description && (
          <p className="mt-2 line-clamp-2 text-sm text-stone-500">{listing.description}</p>
        )}
        <div className="mt-auto flex items-end justify-between pt-4">
          <p className="text-lg font-bold text-brand-800">
            {isSale
              ? `${formatSek(listing.price ?? unit.price)} kr`
              : `${formatSek(listing.rent ?? unit.rent)} kr/mån`}
          </p>
          <span className="relative z-10 text-sm font-semibold text-brand-700 group-hover:underline">
            Läs mer →
          </span>
        </div>
      </div>
    </article>
  );
}
