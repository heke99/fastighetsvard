import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { ImportWizard } from "./ImportWizard";

export const metadata = { title: "Admin – Import av hyresgäster" };

export default async function ImportPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId || !hasPermission(user.permissions, "imports", "create")) {
    redirect("/admin");
  }

  const recentJobs = await db.importJob.findMany({
    where: { organizationId: user.organizationId, importType: "tenants" },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div className="max-w-4xl space-y-6">
      <nav aria-label="Brödsmulor" className="text-sm text-stone-500">
        <Link href="/admin/hyresgaster" className="hover:text-brand-700">← Hyresgäster</Link>
      </nav>
      <header>
        <h1 className="text-2xl font-bold text-stone-900">Importera befintliga hyresgäster</h1>
        <p className="mt-1 text-stone-500">
          Klistra in CSV (komma- eller semikolonseparerad, Excel-export fungerar).
          Obligatoriska kolumner: <code className="rounded bg-stone-100 px-1">firstName</code>,{" "}
          <code className="rounded bg-stone-100 px-1">lastName</code>,{" "}
          <code className="rounded bg-stone-100 px-1">unitNumber</code>,{" "}
          <code className="rounded bg-stone-100 px-1">contractStartDate</code>,{" "}
          <code className="rounded bg-stone-100 px-1">rent</code>. Valfria:{" "}
          <code className="rounded bg-stone-100 px-1">email</code>,{" "}
          <code className="rounded bg-stone-100 px-1">phone</code>,{" "}
          <code className="rounded bg-stone-100 px-1">personalNumber</code>,{" "}
          <code className="rounded bg-stone-100 px-1">contractNumber</code>,{" "}
          <code className="rounded bg-stone-100 px-1">externalCustomerId</code>,{" "}
          <code className="rounded bg-stone-100 px-1">externalSystem</code>.
        </p>
        <p className="mt-2 text-sm text-stone-500">
          Importen kör alltid dubblettkontroll (e-post och personnummer), hoppar över
          objekt med befintliga avtal och kan köras om säkert – redan importerade
          rader hoppas över.
        </p>
      </header>

      <ImportWizard />

      {recentJobs.length > 0 && (
        <section aria-labelledby="importlogg" className="card p-5">
          <h2 id="importlogg" className="font-semibold text-stone-900">Importlogg</h2>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                <th scope="col" className="py-2 pr-4">Datum</th>
                <th scope="col" className="py-2 pr-4">Status</th>
                <th scope="col" className="py-2 pr-4 text-right">Rader</th>
                <th scope="col" className="py-2 pr-4 text-right">Skapade</th>
                <th scope="col" className="py-2 pr-4 text-right">Överhoppade</th>
                <th scope="col" className="py-2 text-right">Fel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {recentJobs.map((job) => (
                <tr key={job.id}>
                  <td className="py-2 pr-4">{new Date(job.createdAt).toLocaleString("sv-SE")}</td>
                  <td className="py-2 pr-4">
                    <span className={`badge ${job.status === "COMPLETED" ? "bg-brand-100 text-brand-800" : job.status === "FAILED" ? "bg-red-100 text-red-800" : "bg-accent-500/20 text-accent-600"}`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-right">{job.totalRows}</td>
                  <td className="py-2 pr-4 text-right">{job.successRows}</td>
                  <td className="py-2 pr-4 text-right">{job.skippedRows}</td>
                  <td className="py-2 text-right">{job.errorRows}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
