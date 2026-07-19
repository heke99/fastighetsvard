import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ProfileForm, DataExportButton } from "./forms";

export const metadata = { title: "Min profil" };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/logga-in");

  const person = user.personId
    ? await db.person.findUnique({ where: { id: user.personId } })
    : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-stone-900">Min profil</h1>
        <p className="mt-1 text-stone-500">Kontaktuppgifter och kontoinställningar.</p>
      </header>

      <ProfileForm
        initial={{
          firstName: person?.firstName ?? "",
          lastName: person?.lastName ?? "",
          email: person?.email ?? user.email,
          phone: person?.phone ?? "",
          address: person?.address ?? "",
          postalCode: person?.postalCode ?? "",
          city: person?.city ?? "",
        }}
      />

      <section aria-labelledby="gdpr" className="card p-5">
        <h2 id="gdpr" className="font-semibold text-stone-900">Dina uppgifter (GDPR)</h2>
        <p className="mt-1 text-sm text-stone-600">
          Du kan när som helst begära ett registerutdrag med alla uppgifter vi har om
          dig. Uppgifter som krävs enligt bokförings- eller hyreslagstiftning kan inte
          raderas under lagstadgad lagringstid, men vi anonymiserar det som är möjligt.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <DataExportButton />
          <a href="mailto:dataskydd@ostgotaelteknik.se?subject=Begäran om rättelse eller radering" className="btn-secondary">
            Begär rättelse eller radering
          </a>
        </div>
      </section>
    </div>
  );
}
