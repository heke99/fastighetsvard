import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { sendInvitationAction } from "../actions";

export const metadata = { title: "Admin – Hyresgäster & personer" };

export default async function AdminTenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.organizationId || !hasPermission(user.permissions, "persons", "read")) {
    redirect("/admin");
  }
  const { q } = await searchParams;

  const persons = await db.person.findMany({
    where: {
      organizationId: user.organizationId,
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      roles: true,
      user: { select: { id: true, lastLoginAt: true } },
      contractParties: {
        where: { role: { in: ["TENANT", "CO_TENANT"] }, contract: { status: "ACTIVE" } },
        include: { contract: { include: { unit: { select: { address: true } } } } },
      },
      invitations: { orderBy: { createdAt: "desc" }, take: 1 },
      externalReferences: { where: { entityType: "customer" } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 200,
  });

  const roleLabels: Record<string, string> = {
    TENANT: "Hyresgäst", APPLICANT: "Sökande", CO_APPLICANT: "Medsökande",
    GUARANTOR: "Borgensman", BUYER: "Köpare", CONTACT: "Kontakt", HOUSEHOLD_MEMBER: "Hushållsmedlem",
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-stone-900">Hyresgäster & personer</h1>
        <div className="flex gap-2">
          <Link href="/admin/hyresgaster/import" className="btn-secondary">CSV-import</Link>
          <Link href="/admin/hyresgaster/ny" className="btn-primary">Lägg till befintlig hyresgäst</Link>
        </div>
      </header>

      <form method="GET" className="flex max-w-md gap-2">
        <label htmlFor="q" className="sr-only">Sök person</label>
        <input id="q" name="q" type="search" defaultValue={q ?? ""} placeholder="Sök namn eller e-post …" className="input" />
        <button type="submit" className="btn-secondary">Sök</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <caption className="sr-only">Personer</caption>
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
              <th scope="col" className="px-4 py-3">Namn</th>
              <th scope="col" className="px-4 py-3">E-post</th>
              <th scope="col" className="px-4 py-3">Roller</th>
              <th scope="col" className="px-4 py-3">Aktivt boende</th>
              <th scope="col" className="px-4 py-3">Externt kund-ID</th>
              <th scope="col" className="px-4 py-3">Mina sidor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {persons.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-stone-500">Inga personer hittades.</td></tr>
            )}
            {persons.map((p) => (
              <tr key={p.id} className="hover:bg-stone-50">
                <td className="px-4 py-3 font-medium text-stone-900">
                  {p.firstName} {p.lastName}
                  {p.protectedIdentity && <span className="badge ml-2 bg-red-100 text-red-800">Skyddad</span>}
                </td>
                <td className="px-4 py-3">{p.email ?? "–"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {p.roles.map((r) => (
                      <span key={r.id} className="badge bg-stone-100 text-stone-700">{roleLabels[r.role]}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {p.contractParties.map((cp) => cp.contract.unit.address).join(", ") || "–"}
                </td>
                <td className="px-4 py-3">
                  {p.externalReferences.map((r) => `${r.externalSystem}:${r.externalId}`).join(", ") || "–"}
                </td>
                <td className="px-4 py-3">
                  {p.user ? (
                    <span className="badge bg-brand-100 text-brand-800">Aktivt konto</span>
                  ) : p.invitations[0] && !p.invitations[0].acceptedAt && p.invitations[0].expiresAt > new Date() ? (
                    <span className="badge bg-accent-500/20 text-accent-600">Inbjuden</span>
                  ) : p.email ? (
                    <form action={sendInvitationAction}>
                      <input type="hidden" name="personId" value={p.id} />
                      <button type="submit" className="rounded border border-stone-300 px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100">
                        Bjud in
                      </button>
                    </form>
                  ) : (
                    <span className="text-xs text-stone-400">Saknar e-post</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
