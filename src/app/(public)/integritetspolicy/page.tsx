export const metadata = { title: "Integritetspolicy" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl">Integritetspolicy</h1>
      <div className="prose prose-stone mt-6 max-w-none text-stone-700">
        <p>
          Östgöta El Teknik AB (org.nr 556000-0000) är personuppgiftsansvarig för
          behandlingen av personuppgifter på denna plattform.
        </p>
        <h2 className="mt-6 text-lg font-semibold text-stone-900">Vilka uppgifter behandlar vi?</h2>
        <p className="mt-2 text-sm leading-relaxed">
          Kontaktuppgifter, personnummer (för avtal och kreditprövning), uppgifter om
          bostadsansökningar (hushåll, sysselsättning, inkomst), avtalsinformation,
          fakturor och betalningsinformation från vårt ekonomisystem samt ärendedata
          som felanmälningar.
        </p>
        <h2 className="mt-6 text-lg font-semibold text-stone-900">Rättslig grund och lagringstid</h2>
        <p className="mt-2 text-sm leading-relaxed">
          Behandling sker med stöd av avtal (hyresförhållande), rättslig förpliktelse
          (bokföringslagen – ekonomiska uppgifter sparas i minst 7 år) och berättigat
          intresse (ansökningar). Uppgifter som inte längre behövs gallras eller
          anonymiseras. Juridiskt och bokföringsmässigt obligatoriska uppgifter
          raderas inte under lagstadgad lagringstid.
        </p>
        <h2 className="mt-6 text-lg font-semibold text-stone-900">Dina rättigheter</h2>
        <p className="mt-2 text-sm leading-relaxed">
          Du har rätt till registerutdrag, rättelse, radering (där det är juridiskt
          möjligt), dataportabilitet och att invända mot behandling. Kontakta{" "}
          <a href="mailto:dataskydd@ostgotaelteknik.se" className="text-brand-700 underline">
            dataskydd@ostgotaelteknik.se
          </a>{" "}
          eller använd funktionerna under Mina sidor → Min profil.
        </p>
        <h2 className="mt-6 text-lg font-semibold text-stone-900">Skyddade personuppgifter</h2>
        <p className="mt-2 text-sm leading-relaxed">
          Personer med skyddade personuppgifter hanteras med särskild begränsad
          åtkomst. Kontakta kundtjänst för säker hantering.
        </p>
      </div>
    </div>
  );
}
