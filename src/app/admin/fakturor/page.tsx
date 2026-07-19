import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { InvoiceStatusBadge } from "@/components/StatusBadges";
import { formatSek } from "@/components/ListingCard";
import type { InvoiceStatus } from "@/lib/database-types";

export const metadata = { title: "Admin – Fakturor" };

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.organizationId || !hasPermission(user.permissions, "invoices", "read")) {
    redirect("/admin");
  }
  const { status } = await searchParams;

  const invoices = await db.invoice.findMany({
    where: {
      organizationId: user.organizationId,
      ...(status ? { status: status as InvoiceStatus } : {}),
    },
    include: {
      person: { select: { firstName: true, lastName: true } },
      contract: { select: { contractNumber: true } },
      externalReferences: true,
    },
    orderBy: { invoiceDate: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Fakturor</h1>
          <p className="mt-1 text-sm text-stone-500">
            Fakturor synkroniseras från bokföringssystemet (master). Status kan inte
            ändras manuellt här – rätta i källsystemet eller via granskningskön.
          </p>
        </div>
        <form method="GET" className="flex items-center gap-2">
          <label htmlFor="status" className="text-sm text-stone-600">Status:</label>
          <select id="status" name="status" defaultValue={status ?? ""} className="input w-auto py-1.5">
            <option value="">Alla</option>
            {["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "REMINDED", "COLLECTION", "CREDITED", "CANCELLED", "DISPUTED"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button type="submit" className="btn-secondary py-1.5">Filtrera</button>
        </form>
      </header>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <caption className="sr-only">Fakturor</caption>
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
              <th scope="col" className="px-4 py-3">Fakturanr</th>
              <th scope="col" className="px-4 py-3">Kund</th>
              <th scope="col" className="px-4 py-3">Avtal</th>
              <th scope="col" className="px-4 py-3">Förfaller</th>
              <th scope="col" className="px-4 py-3 text-right">Belopp</th>
              <th scope="col" className="px-4 py-3 text-right">Betalt</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3">Extern källa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {invoices.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-stone-500">Inga fakturor.</td></tr>
            )}
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-stone-50">
                <td className="px-4 py-3 font-medium text-stone-900">
                  {inv.invoiceNumber}
                  {inv.isCreditNote && <span className="badge ml-1.5 bg-stone-100 text-stone-600">Kredit</span>}
                </td>
                <td className="px-4 py-3">{inv.person.firstName} {inv.person.lastName}</td>
                <td className="px-4 py-3">{inv.contract?.contractNumber ?? "–"}</td>
                <td className="px-4 py-3">{new Date(inv.dueDate).toLocaleDateString("sv-SE")}</td>
                <td className="px-4 py-3 text-right">{formatSek(inv.totalAmount)} kr</td>
                <td className="px-4 py-3 text-right">{formatSek(inv.paidAmount)} kr</td>
                <td className="px-4 py-3"><InvoiceStatusBadge status={inv.status} /></td>
                <td className="px-4 py-3 text-xs text-stone-500">
                  {inv.externalReferences.map((r) => `${r.externalSystem}:${r.externalId}`).join(", ") || "Intern"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
