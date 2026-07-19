import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatSek } from "@/components/ListingCard";
import { InvoiceStatusBadge } from "@/components/StatusBadges";

export const metadata = { title: "Faktura" };

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.personId) redirect("/logga-in");
  const { id } = await params;

  // Tenant-isolering i query: en användare kan aldrig öppna någon annans faktura.
  const invoice = await prisma.invoice.findFirst({
    where: { id, personId: user.personId },
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
      contract: { include: { unit: true } },
      paymentAllocations: { include: { payment: true } },
      creditNotes: true,
      statusHistory: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!invoice) notFound();

  const remaining = Number(invoice.totalAmount) - Number(invoice.paidAmount);

  return (
    <div className="space-y-6">
      <nav aria-label="Brödsmulor" className="text-sm text-stone-500">
        <Link href="/mina-sidor/fakturor" className="hover:text-brand-700">← Mina fakturor</Link>
      </nav>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">
            {invoice.isCreditNote ? "Kreditfaktura" : "Faktura"} {invoice.invoiceNumber}
          </h1>
          {invoice.contract && (
            <p className="mt-1 text-stone-500">
              Avtal {invoice.contract.contractNumber} · {invoice.contract.unit.address}
            </p>
          )}
        </div>
        <InvoiceStatusBadge status={invoice.status} />
      </header>

      <section aria-labelledby="betalning" className="card p-5">
        <h2 id="betalning" className="font-semibold text-stone-900">Betalningsinformation</h2>
        <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between border-b border-stone-100 py-1.5">
            <dt className="text-stone-500">Fakturadatum</dt>
            <dd className="font-medium">{new Date(invoice.invoiceDate).toLocaleDateString("sv-SE")}</dd>
          </div>
          <div className="flex justify-between border-b border-stone-100 py-1.5">
            <dt className="text-stone-500">Förfallodatum</dt>
            <dd className="font-medium">{new Date(invoice.dueDate).toLocaleDateString("sv-SE")}</dd>
          </div>
          {invoice.periodStart && invoice.periodEnd && (
            <div className="flex justify-between border-b border-stone-100 py-1.5">
              <dt className="text-stone-500">Period</dt>
              <dd className="font-medium">
                {new Date(invoice.periodStart).toLocaleDateString("sv-SE")} –{" "}
                {new Date(invoice.periodEnd).toLocaleDateString("sv-SE")}
              </dd>
            </div>
          )}
          <div className="flex justify-between border-b border-stone-100 py-1.5">
            <dt className="text-stone-500">Belopp</dt>
            <dd className="font-medium">{formatSek(invoice.totalAmount)} kr</dd>
          </div>
          <div className="flex justify-between border-b border-stone-100 py-1.5">
            <dt className="text-stone-500">Varav moms</dt>
            <dd className="font-medium">{formatSek(invoice.vatAmount)} kr</dd>
          </div>
          <div className="flex justify-between border-b border-stone-100 py-1.5">
            <dt className="text-stone-500">Betalt</dt>
            <dd className="font-medium">{formatSek(invoice.paidAmount)} kr</dd>
          </div>
          <div className="flex justify-between border-b border-stone-100 py-1.5">
            <dt className="text-stone-500">Återstående</dt>
            <dd className={`font-bold ${remaining > 0 ? "text-red-700" : "text-brand-700"}`}>
              {formatSek(remaining)} kr
            </dd>
          </div>
          {invoice.ocr && (
            <div className="flex justify-between border-b border-stone-100 py-1.5">
              <dt className="text-stone-500">OCR-nummer</dt>
              <dd className="font-mono font-medium">{invoice.ocr}</dd>
            </div>
          )}
          {invoice.bankgiro && (
            <div className="flex justify-between border-b border-stone-100 py-1.5">
              <dt className="text-stone-500">Bankgiro</dt>
              <dd className="font-mono font-medium">{invoice.bankgiro}</dd>
            </div>
          )}
          {invoice.reference && (
            <div className="flex justify-between border-b border-stone-100 py-1.5">
              <dt className="text-stone-500">Referens</dt>
              <dd className="font-medium">{invoice.reference}</dd>
            </div>
          )}
        </dl>
        {invoice.pdfUrl && (
          <a href={invoice.pdfUrl} className="btn-secondary mt-4" download>
            Ladda ner PDF
          </a>
        )}
      </section>

      {invoice.lines.length > 0 && (
        <section aria-labelledby="rader" className="card overflow-x-auto p-5">
          <h2 id="rader" className="font-semibold text-stone-900">Fakturarader</h2>
          <table className="mt-3 w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                <th scope="col" className="py-2 pr-4">Beskrivning</th>
                <th scope="col" className="py-2 pr-4 text-right">Antal</th>
                <th scope="col" className="py-2 pr-4 text-right">À-pris</th>
                <th scope="col" className="py-2 pr-4 text-right">Moms</th>
                <th scope="col" className="py-2 text-right">Belopp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {invoice.lines.map((line) => (
                <tr key={line.id}>
                  <td className="py-2.5 pr-4">{line.description}</td>
                  <td className="py-2.5 pr-4 text-right">{Number(line.quantity)}</td>
                  <td className="py-2.5 pr-4 text-right">{formatSek(line.unitPrice)} kr</td>
                  <td className="py-2.5 pr-4 text-right">{Number(line.vatRate)} %</td>
                  <td className="py-2.5 text-right font-medium">{formatSek(line.amount)} kr</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {invoice.paymentAllocations.length > 0 && (
        <section aria-labelledby="betalningar" className="card p-5">
          <h2 id="betalningar" className="font-semibold text-stone-900">Betalningshistorik</h2>
          <ul className="mt-3 divide-y divide-stone-100 text-sm">
            {invoice.paymentAllocations.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2.5">
                <span className="text-stone-600">
                  {new Date(a.payment.paidAt).toLocaleDateString("sv-SE")}
                  {a.payment.method ? ` · ${a.payment.method}` : ""}
                </span>
                <span className="font-medium text-brand-700">{formatSek(a.amount)} kr</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {invoice.creditNotes.length > 0 && (
        <section aria-labelledby="krediter" className="card p-5">
          <h2 id="krediter" className="font-semibold text-stone-900">Kreditfakturor</h2>
          <ul className="mt-3 divide-y divide-stone-100 text-sm">
            {invoice.creditNotes.map((cn) => (
              <li key={cn.id} className="flex items-center justify-between py-2.5">
                <Link href={`/mina-sidor/fakturor/${cn.id}`} className="font-medium text-brand-700 hover:underline">
                  {cn.invoiceNumber}
                </Link>
                <span>{formatSek(cn.totalAmount)} kr</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
