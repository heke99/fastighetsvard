import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { MaintenanceForm } from "./MaintenanceForm";

export const metadata = { title: "Ny felanmälan" };

export default async function NewMaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.personId) redirect("/logga-in?next=/mina-sidor/felanmalan/ny");
  const { unit: preselectedUnit } = await searchParams;

  // Objekt personen har aktiva avtal på.
  const contracts = await db.contract.findMany({
    where: {
      status: { in: ["ACTIVE", "TERMINATED"] },
      parties: { some: { personId: user.personId, role: { in: ["TENANT", "CO_TENANT"] } } },
    },
    include: { unit: { select: { id: true, address: true, city: true, propertyId: true } } },
  });
  const units = [...new Map<string, { id: string; address: string; city: string }>(contracts.map((c: any) => [c.unit.id, c.unit])).values()];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-stone-900">Ny felanmälan</h1>
        <p className="mt-1 text-stone-500">
          Beskriv felet så utförligt som möjligt. Vid akuta fel – ring alltid{" "}
          <a href="tel:+4613100001" className="font-semibold text-brand-700">013-10 00 01</a>.
        </p>
      </header>
      <MaintenanceForm units={units} preselectedUnitId={preselectedUnit} />
    </div>
  );
}
