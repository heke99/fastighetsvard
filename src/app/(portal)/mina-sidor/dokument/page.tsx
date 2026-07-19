import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Dokument" };

const typeLabels: Record<string, string> = {
  CONTRACT: "Hyresavtal",
  TERMINATION: "Uppsägning",
  INSPECTION_PROTOCOL: "Besiktningsprotokoll",
  KEY_RECEIPT: "Nyckelkvittens",
  INFO_LETTER: "Informationsbrev",
  INVOICE: "Faktura",
  CREDIT_NOTE: "Kreditfaktura",
  PAYMENT_PLAN: "Betalningsplan",
  POWER_OF_ATTORNEY: "Fullmakt",
  SUBLEASE: "Andrahandsuthyrning",
  TRANSFER: "Överlåtelse",
  GUARANTEE: "Borgensförbindelse",
  SALE_DOCUMENT: "Försäljningsdokument",
  ENERGY_DECLARATION: "Energideklaration",
  FLOORPLAN: "Ritning",
  OTHER: "Övrigt",
};

export default async function DocumentsPage() {
  const user = await getCurrentUser();
  if (!user?.personId) redirect("/logga-in");

  // Behörighet: endast dokument kopplade till min person eller mina avtal.
  const documents = await prisma.document.findMany({
    where: {
      OR: [
        { personId: user.personId },
        { contract: { parties: { some: { personId: user.personId } } } },
      ],
      archivedAt: null,
    },
    include: { contract: { select: { contractNumber: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-stone-900">Dokument</h1>
        <p className="mt-1 text-stone-500">Avtal, protokoll och andra dokument kopplade till dig.</p>
      </header>

      {documents.length === 0 ? (
        <div className="card p-10 text-center text-stone-500">Inga dokument att visa.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <caption className="sr-only">Dina dokument</caption>
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                <th scope="col" className="px-4 py-3">Dokument</th>
                <th scope="col" className="px-4 py-3">Typ</th>
                <th scope="col" className="px-4 py-3">Avtal</th>
                <th scope="col" className="px-4 py-3">Version</th>
                <th scope="col" className="px-4 py-3">Datum</th>
                <th scope="col" className="px-4 py-3">Signering</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 font-medium text-stone-900">{doc.title}</td>
                  <td className="px-4 py-3 text-stone-600">{typeLabels[doc.type] ?? doc.type}</td>
                  <td className="px-4 py-3 text-stone-600">{doc.contract?.contractNumber ?? "–"}</td>
                  <td className="px-4 py-3 text-stone-600">v{doc.version}</td>
                  <td className="px-4 py-3 text-stone-600">{new Date(doc.createdAt).toLocaleDateString("sv-SE")}</td>
                  <td className="px-4 py-3">
                    {doc.signStatus === "signed" ? (
                      <span className="badge bg-brand-100 text-brand-800">Signerat</span>
                    ) : doc.signStatus === "pending" ? (
                      <span className="badge bg-accent-500/20 text-accent-600">Väntar</span>
                    ) : (
                      <span className="badge bg-stone-100 text-stone-600">–</span>
                    )}
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
