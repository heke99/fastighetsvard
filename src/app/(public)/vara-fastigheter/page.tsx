import { db } from "@/lib/db";

export const metadata = { title: "Våra fastigheter" };
export const dynamic = "force-dynamic";

export default async function PropertiesPage() {
  const properties = await db.property.findMany({
    where: { status: { in: ["ACTIVE", "UNDER_RENOVATION"] } },
    include: { _count: { select: { units: true } } },
    orderBy: [{ city: "asc" }, { name: "asc" }],
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl">Våra fastigheter</h1>
      <p className="mt-1 max-w-2xl text-stone-500">
        Östgöta El Teknik äger och förvaltar fastigheter i Östergötland. Här ser du
        hela vårt bestånd.
      </p>
      {properties.length === 0 ? (
        <div className="card mt-8 p-12 text-center text-stone-500">
          Fastighetsinformation publiceras inom kort.
        </div>
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => (
            <li key={p.id} className="card overflow-hidden">
              <div className="flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-brand-100 to-brand-200" aria-hidden="true">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="text-brand-400">
                  <path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M14 9h5a1 1 0 0 1 1 1v11M4 21h16M8 8h2m-2 4h2m-2 4h2m7-4h1m-1 4h1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div className="p-4">
                <h2 className="font-semibold text-stone-900">{p.name}</h2>
                <p className="text-sm text-stone-500">{p.address}, {p.city}</p>
                <dl className="mt-3 flex flex-wrap gap-x-4 text-sm text-stone-600">
                  {p.yearBuilt && (
                    <div><dt className="sr-only">Byggnadsår</dt><dd>Byggt {p.yearBuilt}</dd></div>
                  )}
                  {p.energyClass && (
                    <div><dt className="sr-only">Energiklass</dt><dd>Energiklass {p.energyClass}</dd></div>
                  )}
                  <div><dt className="sr-only">Antal objekt</dt><dd>{p._count.units} objekt</dd></div>
                </dl>
                {p.status === "UNDER_RENOVATION" && (
                  <span className="badge mt-3 bg-accent-500/20 text-accent-600">Renoveras</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
