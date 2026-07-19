import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { ActionForm } from "@/components/admin/ActionForm";
import { registerExistingTenantAction } from "../../actions";

export const metadata = { title: "Admin – Lägg till befintlig hyresgäst" };

export default async function NewExistingTenantPage() {
  const user = await getCurrentUser();
  if (!user?.organizationId || !hasPermission(user.permissions, "contracts", "create")) {
    redirect("/admin");
  }

  // Objekt utan aktivt avtal kan kopplas till befintlig hyresgäst.
  const units = await prisma.unit.findMany({
    where: {
      organizationId: user.organizationId,
      contracts: { none: { status: { in: ["ACTIVE", "SIGNED", "SENT_FOR_SIGNING", "PARTIALLY_SIGNED"] } } },
    },
    orderBy: { unitNumber: "asc" },
  });

  return (
    <div className="max-w-3xl space-y-6">
      <nav aria-label="Brödsmulor" className="text-sm text-stone-500">
        <Link href="/admin/hyresgaster" className="hover:text-brand-700">← Hyresgäster</Link>
      </nav>
      <header>
        <h1 className="text-2xl font-bold text-stone-900">Lägg till befintlig hyresgäst</h1>
        <p className="mt-1 text-stone-500">
          Registrera ett redan pågående hyresförhållande i efterhand. Personen matchas
          automatiskt mot befintliga personer via e-post eller personnummer
          (dubblettkontroll). Objektet markeras som uthyrt och avtalet blir aktivt.
        </p>
      </header>

      {units.length === 0 ? (
        <div className="card p-8 text-center text-stone-500">
          Alla objekt har redan aktiva avtal. Skapa först ett objekt under{" "}
          <Link href="/admin/objekt" className="font-medium text-brand-700 underline">Objekt</Link>.
        </div>
      ) : (
        <div className="card p-6">
          <ActionForm action={registerExistingTenantAction} submitLabel="Registrera hyresgäst och avtal">
            <fieldset className="space-y-4">
              <legend className="text-base font-semibold text-stone-900">Person</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="firstName" className="label">Förnamn</label>
                  <input id="firstName" name="firstName" required className="input" />
                </div>
                <div>
                  <label htmlFor="lastName" className="label">Efternamn</label>
                  <input id="lastName" name="lastName" required className="input" />
                </div>
                <div>
                  <label htmlFor="email" className="label">E-postadress</label>
                  <input id="email" name="email" type="email" className="input" />
                  <p className="mt-1 text-xs text-stone-500">Används för matchning och inbjudan till Mina sidor.</p>
                </div>
                <div>
                  <label htmlFor="phone" className="label">Telefon</label>
                  <input id="phone" name="phone" type="tel" className="input" />
                </div>
                <div>
                  <label htmlFor="personalNumber" className="label">Personnummer</label>
                  <input id="personalNumber" name="personalNumber" className="input" placeholder="ÅÅÅÅMMDD-XXXX" />
                </div>
              </div>
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="text-base font-semibold text-stone-900">Avtal</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="unitId" className="label">Objekt</label>
                  <select id="unitId" name="unitId" required className="input">
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>{u.unitNumber} · {u.address}, {u.city}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="contractNumber" className="label">Avtalsnummer (lämna tomt för automatiskt)</label>
                  <input id="contractNumber" name="contractNumber" className="input" />
                </div>
                <div>
                  <label htmlFor="contractStartDate" className="label">Avtalets startdatum (inflyttning)</label>
                  <input id="contractStartDate" name="contractStartDate" type="date" required className="input" />
                </div>
                <div>
                  <label htmlFor="contractEndDate" className="label">Slutdatum (tomt = tillsvidare)</label>
                  <input id="contractEndDate" name="contractEndDate" type="date" className="input" />
                </div>
                <div>
                  <label htmlFor="rent" className="label">Hyra (kr/mån)</label>
                  <input id="rent" name="rent" type="number" required className="input" />
                </div>
                <div>
                  <label htmlFor="deposit" className="label">Deposition (kr)</label>
                  <input id="deposit" name="deposit" type="number" className="input" />
                </div>
                <div>
                  <label htmlFor="noticePeriodMonths" className="label">Uppsägningstid (månader)</label>
                  <input id="noticePeriodMonths" name="noticePeriodMonths" type="number" defaultValue={3} className="input" />
                </div>
              </div>
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="text-base font-semibold text-stone-900">Ekonomikopplingar (bokföringssystem)</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="externalSystem" className="label">Externt system</label>
                  <select id="externalSystem" name="externalSystem" className="input">
                    <option value="">Inget</option>
                    <option value="fortnox">Fortnox</option>
                    <option value="visma">Visma</option>
                    <option value="bjornlunden">Björn Lundén</option>
                    <option value="business_central">Business Central</option>
                    <option value="mock">Mock (test)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="externalCustomerId" className="label">Externt kund-ID / kundnummer</label>
                  <input id="externalCustomerId" name="externalCustomerId" className="input" />
                </div>
                <div>
                  <label htmlFor="externalContractId" className="label">Externt avtalsnummer</label>
                  <input id="externalContractId" name="externalContractId" className="input" />
                </div>
                <div>
                  <label htmlFor="invoiceReference" className="label">Fakturareferens</label>
                  <input id="invoiceReference" name="invoiceReference" className="input" />
                </div>
              </div>
            </fieldset>

            <label className="flex items-start gap-2 text-sm text-stone-700">
              <input type="checkbox" name="sendInvitation" value="1" defaultChecked className="mt-0.5 h-4 w-4 rounded border-stone-300 text-brand-700" />
              <span>Skicka inbjudan till Mina sidor (kräver e-postadress).</span>
            </label>
          </ActionForm>
        </div>
      )}
    </div>
  );
}
