export const metadata = { title: "Vanliga frågor" };

const faqs: { q: string; a: string }[] = [
  {
    q: "Hur ansöker jag om en lägenhet?",
    a: "Skapa ett konto, öppna annonsen och klicka på Ansök. Fyll i uppgifter om hushåll, sysselsättning och inkomst. Du följer sedan ansökans status under Mina sidor.",
  },
  {
    q: "Kan jag söka ny lägenhet fast jag redan hyr hos er?",
    a: "Ja. Du använder samma konto och kan ansöka precis som vanligt. Markera gärna ansökan som intern omflyttning så samordnar vi uppsägningen av ditt nuvarande avtal med inflyttningen i det nya.",
  },
  {
    q: "Var hittar jag mina fakturor?",
    a: "Under Mina sidor → Mina fakturor. Fakturorna hämtas från vårt ekonomisystem och visar OCR, förfallodatum, belopp och betalningsstatus.",
  },
  {
    q: "Hur säger jag upp mitt avtal?",
    a: "Logga in på Mina sidor, öppna ditt avtal och välj Säg upp avtal. Systemet visar din uppsägningstid och räknar ut tidigaste möjliga slutdatum.",
  },
  {
    q: "Hur gör jag en felanmälan?",
    a: "Via Mina sidor → Felanmälan. Vid akuta fel ska du alltid ringa vår jour på 013000000.",
  },
  {
    q: "Vad krävs för att bli godkänd som hyresgäst?",
    a: "Vi gör en samlad bedömning av inkomst, referenser och eventuella betalningsanmärkningar. Krav kan variera per objekt och framgår i annonsens kravprofil.",
  },
  {
    q: "Hur behandlar ni mina personuppgifter?",
    a: "Vi behandlar personuppgifter enligt GDPR. Du kan begära registerutdrag, rättelse och radering via Mina sidor → Min profil. Se integritetspolicyn för detaljer.",
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl">Vanliga frågor</h1>
      <dl className="mt-8 space-y-4">
        {faqs.map((f) => (
          <div key={f.q} className="card p-5">
            <dt className="font-semibold text-stone-900">{f.q}</dt>
            <dd className="mt-1.5 text-sm leading-relaxed text-stone-600">{f.a}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
