import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatSek } from "@/components/ListingCard";
import { InvoiceStatusBadge } from "@/components/StatusBadges";

export const metadata = { title: "Mina fakturor" };

export default async function MyInvoicesPage() {
  const user = await getCurrentUser();
  if (!user?.personId) redirect("/logga-in");

  // Tenant-isolering: endast fakturor kopplade till min person.
  const invoices = await db.invoice.findMany({
    where: { personId: user.personId },
    orderBy: { invoiceDate: "desc" },
    take: 50,
  });

  const unpaid = invoices.filter((i) =>
    ["SENT", "PARTIALLY_PAID", "OVERDUE", "REMINDED", "COLLECTION"].includes(i.status)
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-stone-900">Mina fakturor</h1>
        <p className="mt-1 text-stone-500">
          Fakturor hämtas automatiskt från vårt ekonomisystem. Kontakta oss om
          något inte stämmer.
        </p>
      </header>

      {unpaid.length > 0 && (
        <div className="card border-l-4 border-l-accent-500 p-4 text-sm">
          <p className="font-semibold text-stone-900">
            Du har {unpaid.length} obetald{unpaid.length > 1 ? "a" : ""} faktur{unpaid.length > 1 ? "or" : "a"} på totalt{" "}
            {formatSek(unpaid.reduce((s, i) => s + Number(i.totalAmount) - Number(i.paidAmount), 0))} kr.
          </p>
        </div>
      )}

      {invoices.length === 0 ? (
        <div className="card p-10 text-center text-stone-500">
          Inga fakturor att visa ännu.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Dina fakturor</caption>
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                <th scope="col" className="px-4 py-3">Fakturanr</th>
                <th scope="col" className="px-4 py-3">Förfallodatum</th>
                <th scope="col" className="px-4 py-3">Period</th>
                <th scope="col" className="px-4 py-3 text-right">Belopp</th>
                <th scope="col" className="px-4 py-3 text-right">Återstår</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Åtgärder</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 font-medium text-stone-900">
                    {inv.invoiceNumber}
                    {inv.isCreditNote && <span className="badge ml-2 bg-stone-100 text-stone-600">Kredit</span>}
                  </td>
                  <td className="px-4 py-3">{new Date(inv.dueDate).toLocaleDateString("sv-SE")}</td>
                  <td className="px-4 py-3 text-stone-500">
                    {inv.periodStart && inv.periodEnd
                      ? `${new Date(inv.periodStart).toLocaleDateString("sv-SE")} – ${new Date(inv.periodEnd).toLocaleDateString("sv-SE")}`
                      : "–"}
                  </td>
                  <td className="px-4 py-3 text-right">{formatSek(inv.totalAmount)} kr</td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatSek(Number(inv.totalAmount) - Number(inv.paidAmount))} kr
                  </td>
                  <td className="px-4 py-3"><InvoiceStatusBadge status={inv.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/mina-sidor/fakturor/${inv.id}`} className="font-medium text-brand-700 hover:underline">
                      Visa
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
