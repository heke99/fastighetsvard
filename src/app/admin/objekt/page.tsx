import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { formatSek } from "@/components/ListingCard";
import { ActionForm } from "@/components/admin/ActionForm";
import { createUnitAction } from "../actions";
import type { UnitStatus } from "@/lib/database-types";

export const metadata = { title: "Admin – Objekt" };

const statusLabels: Record<string, string> = {
  DRAFT: "Utkast", NOT_PUBLISHED: "Ej publicerad", UPCOMING: "Kommande",
  PUBLISHED: "Publicerad", APPLICATION_OPEN: "Ansökan öppen", VIEWING: "Visning",
  OFFER_SENT: "Erbjudande skickat", RESERVED: "Reserverad", CONTRACT_SENT: "Avtal skickat",
  RENTED: "Uthyrd", FOR_SALE: "Till salu", BIDDING: "Budgivning", SOLD: "Såld",
  RENOVATING: "Renoveras", BLOCKED: "Spärrad", NOT_RENTABLE: "Ej uthyrningsbar", ARCHIVED: "Arkiverad",
};

export default async function AdminUnitsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.organizationId || !hasPermission(user.permissions, "units", "read")) {
    redirect("/admin");
  }
  const { status } = await searchParams;

  const [units, properties] = await Promise.all([
    db.unit.findMany({
      where: {
        organizationId: user.organizationId,
        ...(status && status in statusLabels ? { status: status as UnitStatus } : {}),
      },
      include: {
        property: { select: { name: true } },
        contracts: { where: { status: "ACTIVE" }, include: { parties: { include: { person: true } } } },
      },
      orderBy: { unitNumber: "asc" },
      take: 200,
    }),
    db.property.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { name: "asc" },
    }),
  ]);

  const canCreate = hasPermission(user.permissions, "units", "create");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-stone-900">Objekt</h1>
        <form method="GET" className="flex items-center gap-2">
          <label htmlFor="status" className="text-sm text-stone-600">Status:</label>
          <select id="status" name="status" defaultValue={status ?? ""} className="input w-auto py-1.5">
            <option value="">Alla</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button type="submit" className="btn-secondary py-1.5">Filtrera</button>
        </form>
      </header>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <caption className="sr-only">Objekt</caption>
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
              <th scope="col" className="px-4 py-3">Objektsnr</th>
              <th scope="col" className="px-4 py-3">Typ</th>
              <th scope="col" className="px-4 py-3">Adress</th>
              <th scope="col" className="px-4 py-3">Fastighet</th>
              <th scope="col" className="px-4 py-3 text-right">Hyra/Pris</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3">Hyresgäst</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {units.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-stone-500">Inga objekt matchade.</td></tr>
            )}
            {units.map((u) => {
              const tenant = u.contracts[0]?.parties.find((p) => p.role === "TENANT")?.person;
              return (
                <tr key={u.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 font-medium text-stone-900">{u.unitNumber}</td>
                  <td className="px-4 py-3">{u.type}</td>
                  <td className="px-4 py-3">{u.address}, {u.city}</td>
                  <td className="px-4 py-3">{u.property.name}</td>
                  <td className="px-4 py-3 text-right">
                    {u.rent ? `${formatSek(u.rent)} kr/mån` : u.price ? `${formatSek(u.price)} kr` : "–"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge bg-stone-100 text-stone-700">{statusLabels[u.status]}</span>
                  </td>
                  <td className="px-4 py-3">
                    {tenant ? `${tenant.firstName} ${tenant.lastName}` : "–"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canCreate && (
        <section aria-labelledby="nytt-objekt" className="card p-5">
          <h2 id="nytt-objekt" className="mb-4 font-semibold text-stone-900">Nytt objekt</h2>
          {properties.length === 0 ? (
            <p className="text-sm text-stone-500">Skapa först en fastighet.</p>
          ) : (
            <ActionForm action={createUnitAction} submitLabel="Skapa objekt">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="propertyId" className="label">Fastighet</label>
                  <select id="propertyId" name="propertyId" required className="input">
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="unitNumber" className="label">Objektsnummer</label>
                  <input id="unitNumber" name="unitNumber" required className="input" placeholder="T.ex. 1101" />
                </div>
                <div>
                  <label htmlFor="apartmentNumber" className="label">Lägenhetsnummer</label>
                  <input id="apartmentNumber" name="apartmentNumber" className="input" placeholder="T.ex. 1201" />
                </div>
                <div>
                  <label htmlFor="type" className="label">Objektstyp</label>
                  <select id="type" name="type" required className="input">
                    <option value="APARTMENT">Hyreslägenhet</option>
                    <option value="APARTMENT_SALE">Bostad till salu</option>
                    <option value="COMMERCIAL">Lokal</option>
                    <option value="OFFICE">Kontor</option>
                    <option value="RETAIL">Butik</option>
                    <option value="WAREHOUSE">Lager</option>
                    <option value="GARAGE">Garage</option>
                    <option value="PARKING">Parkeringsplats</option>
                    <option value="STORAGE">Förråd</option>
                    <option value="STUDENT">Studentbostad</option>
                    <option value="SHORT_TERM">Korttidsboende</option>
                    <option value="LAND">Mark</option>
                    <option value="PROPERTY_SALE">Fastighet till salu</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="address" className="label">Adress</label>
                  <input id="address" name="address" required className="input" />
                </div>
                <div>
                  <label htmlFor="city" className="label">Ort</label>
                  <input id="city" name="city" required className="input" />
                </div>
                <div>
                  <label htmlFor="area" className="label">Område</label>
                  <input id="area" name="area" className="input" />
                </div>
                <div>
                  <label htmlFor="floorLevel" className="label">Våning</label>
                  <input id="floorLevel" name="floorLevel" type="number" className="input" />
                </div>
                <div>
                  <label htmlFor="rooms" className="label">Antal rum</label>
                  <input id="rooms" name="rooms" type="number" step="0.5" className="input" />
                </div>
                <div>
                  <label htmlFor="livingArea" className="label">Boyta (m²)</label>
                  <input id="livingArea" name="livingArea" type="number" step="0.1" className="input" />
                </div>
                <div>
                  <label htmlFor="rent" className="label">Hyra (kr/mån)</label>
                  <input id="rent" name="rent" type="number" className="input" />
                </div>
                <div>
                  <label htmlFor="price" className="label">Pris (kr)</label>
                  <input id="price" name="price" type="number" className="input" />
                </div>
                <div>
                  <label htmlFor="noticePeriodMonths" className="label">Uppsägningstid (mån)</label>
                  <input id="noticePeriodMonths" name="noticePeriodMonths" type="number" defaultValue={3} className="input" />
                </div>
              </div>
              <fieldset className="mt-2">
                <legend className="label">Egenskaper</legend>
                <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-stone-700">
                  {[
                    ["hasElevator", "Hiss"], ["hasBalcony", "Balkong"], ["hasPatio", "Uteplats"],
                    ["hasStorage", "Förråd"], ["hasParking", "Parkering"], ["furnished", "Möblerad"],
                    ["accessible", "Tillgänglighetsanpassad"], ["petsAllowed", "Husdjur ok"],
                  ].map(([name, label]) => (
                    <label key={name} className="flex items-center gap-1.5">
                      <input type="checkbox" name={name} value="1" className="h-4 w-4 rounded border-stone-300 text-brand-700" />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div>
                <label htmlFor="description" className="label">Beskrivning</label>
                <textarea id="description" name="description" rows={3} className="input" />
              </div>
            </ActionForm>
          )}
        </section>
      )}
    </div>
  );
}
