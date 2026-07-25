import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { MaintenanceForm } from "./MaintenanceForm";
import { listMyRentalUnits } from "@/lib/repositories/portal-records";

export const metadata = { title: "Ny felanmälan" };

export default async function NewMaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.personId) redirect("/logga-in?next=/mina-sidor/felanmalan/ny");
  const { unit: preselectedUnit } = await searchParams;

  const units = await listMyRentalUnits();

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
