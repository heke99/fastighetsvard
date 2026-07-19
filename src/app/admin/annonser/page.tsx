import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { ActionForm } from "@/components/admin/ActionForm";
import { createListingAction, changeListingStatusAction } from "../actions";
import { listingTransitions } from "@/lib/state-machines";

export const metadata = { title: "Admin – Annonser" };

const statusLabels: Record<string, string> = {
  DRAFT: "Utkast", SCHEDULED: "Schemalagd", PUBLISHED: "Publicerad",
  PAUSED: "Pausad", UNPUBLISHED: "Avpublicerad", COMPLETED: "Avslutad",
};

export default async function AdminListingsPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId || !hasPermission(user.permissions, "listings", "read")) {
    redirect("/admin");
  }

  const [listings, units] = await Promise.all([
    prisma.listing.findMany({
      where: { organizationId: user.organizationId },
      include: {
        unit: { select: { unitNumber: true, address: true, city: true } },
        _count: { select: { applications: true, favorites: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.unit.findMany({
      where: {
        organizationId: user.organizationId,
        status: { in: ["NOT_PUBLISHED", "UPCOMING", "DRAFT", "PUBLISHED"] },
      },
      orderBy: { unitNumber: "asc" },
    }),
  ]);

  const canUpdate = hasPermission(user.permissions, "listings", "update");
  const canCreate = hasPermission(user.permissions, "listings", "create");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-stone-900">Annonser</h1>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <caption className="sr-only">Annonser</caption>
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
              <th scope="col" className="px-4 py-3">Rubrik</th>
              <th scope="col" className="px-4 py-3">Objekt</th>
              <th scope="col" className="px-4 py-3">Kategori</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3 text-right">Ansökn.</th>
              <th scope="col" className="px-4 py-3 text-right">Favoriter</th>
              <th scope="col" className="px-4 py-3">Åtgärder</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {listings.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-stone-500">Inga annonser ännu.</td></tr>
            )}
            {listings.map((l) => (
              <tr key={l.id} className="hover:bg-stone-50">
                <td className="px-4 py-3 font-medium text-stone-900">
                  <Link href={`/annons/${l.slug}`} className="hover:underline">{l.title}</Link>
                </td>
                <td className="px-4 py-3">{l.unit.unitNumber} · {l.unit.address}</td>
                <td className="px-4 py-3">{l.category}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${l.status === "PUBLISHED" ? "bg-brand-100 text-brand-800" : "bg-stone-100 text-stone-700"}`}>
                    {statusLabels[l.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">{l._count.applications}</td>
                <td className="px-4 py-3 text-right">{l._count.favorites}</td>
                <td className="px-4 py-3">
                  {canUpdate && (
                    <div className="flex flex-wrap gap-1.5">
                      {(listingTransitions[l.status] ?? []).map((next) => (
                        <form key={next} action={changeListingStatusAction}>
                          <input type="hidden" name="listingId" value={l.id} />
                          <input type="hidden" name="toStatus" value={next} />
                          <button type="submit" className="rounded border border-stone-300 px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100">
                            → {statusLabels[next]}
                          </button>
                        </form>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canCreate && (
        <section aria-labelledby="ny-annons" className="card p-5">
          <h2 id="ny-annons" className="mb-4 font-semibold text-stone-900">Ny annons</h2>
          {units.length === 0 ? (
            <p className="text-sm text-stone-500">Inga publicerbara objekt. Skapa ett objekt först.</p>
          ) : (
            <ActionForm action={createListingAction} submitLabel="Skapa annons (utkast)">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="unitId" className="label">Objekt</label>
                  <select id="unitId" name="unitId" required className="input">
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>{u.unitNumber} · {u.address}, {u.city}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="category" className="label">Kategori</label>
                  <select id="category" name="category" required className="input">
                    <option value="RENTAL">Uthyrning</option>
                    <option value="SALE">Försäljning</option>
                    <option value="COMMERCIAL">Lokal</option>
                    <option value="PARKING">Parkering</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="title" className="label">Rubrik</label>
                  <input id="title" name="title" required className="input" placeholder="T.ex. Ljus 3:a med balkong i Innerstaden" />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="description" className="label">Beskrivning</label>
                  <textarea id="description" name="description" required rows={4} className="input" />
                </div>
                <div>
                  <label htmlFor="rent" className="label">Hyra (kr/mån, lämna tomt för objektets)</label>
                  <input id="rent" name="rent" type="number" className="input" />
                </div>
                <div>
                  <label htmlFor="price" className="label">Pris (kr, vid försäljning)</label>
                  <input id="price" name="price" type="number" className="input" />
                </div>
                <div>
                  <label htmlFor="moveInDate" className="label">Inflyttningsdatum</label>
                  <input id="moveInDate" name="moveInDate" type="date" className="input" />
                </div>
                <div>
                  <label htmlFor="applicationDeadline" className="label">Sista ansökningsdag</label>
                  <input id="applicationDeadline" name="applicationDeadline" type="date" className="input" />
                </div>
                <div>
                  <label htmlFor="contactName" className="label">Kontaktperson</label>
                  <input id="contactName" name="contactName" className="input" />
                </div>
                <div>
                  <label htmlFor="contactEmail" className="label">Kontakt-e-post</label>
                  <input id="contactEmail" name="contactEmail" type="email" className="input" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-stone-700">
                <input type="checkbox" name="featured" value="1" className="h-4 w-4 rounded border-stone-300 text-brand-700" />
                Visa som utvalt objekt på startsidan
              </label>
            </ActionForm>
          )}
        </section>
      )}
    </div>
  );
}
