export const metadata = { title: "Tillgänglighet" };

export default function AccessibilityPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl">Tillgänglighetsredogörelse</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-stone-700">
        <p>
          Östgöta El Teknik strävar efter att denna webbplats ska kunna användas av
          alla, oavsett funktionsförmåga. Målet är att uppfylla WCAG 2.2 nivå AA.
        </p>
        <p>Webbplatsen är byggd med:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Fullständig tangentbordsnavigering med synliga fokusmarkeringar.</li>
          <li>Semantisk HTML med landmärken, rubriknivåer och beskrivande länktexter.</li>
          <li>Skärmläsarstöd med aria-attribut i menyer, dialoger och formulär.</li>
          <li>Tydliga formulärfel kopplade till respektive fält.</li>
          <li>Tillräckliga färgkontraster och responsiv design för mobil och surfplatta.</li>
        </ul>
        <p>
          Upptäcker du brister i tillgängligheten? Kontakta oss på{" "}
          <a href="mailto:info@ostgotaelteknik.se" className="text-brand-700 underline">
            info@ostgotaelteknik.se
          </a>{" "}
          så åtgärdar vi dem.
        </p>
      </div>
    </div>
  );
}
