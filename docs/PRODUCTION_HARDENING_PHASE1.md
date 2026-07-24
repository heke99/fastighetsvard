# Produktionshärdning – etapp 1

## Omfattning

Denna etapp åtgärdar de mest riskfyllda fundamenten i den ursprungliga lösningen. Den är inte en deklaration att hela HomeQ-målbilden är färdig.

Genomfört:

- en enda aktiv migrationskedja;
- nya atomiska RPC-operationer för ansökan, visning, erbjudande, signering, kontraktsaktivering, uppsägning, in-/avflyttning och jobbclaims;
- constraints för aktiva ansökningar, reservationer och överlappande bindande kontraktsperioder;
- immutable ansökningssnapshot och låsta avtalsbevis;
- transactional outbox och atomisk idempotensmodell;
- riktig Supabase e-postverifiering för självregistrering;
- separat, tokenbunden claim av importerad person;
- verifierad e-post-OTP bunden till avtalsversionens dokumenthash;
- append-only audit-skydd;
- default-deny RLS för nya domäntabeller och path-bunden privat Storage-läsning;
- databasbaserad distribuerad rate limiting;
- synkroniserad Node/npm-version och utökad CI;
- central grundkonfiguration för branding.

## Kända blockerare

Följande måste slutföras innan riktiga personuppgifter eller juridiskt bindande avtal används:

1. `src/lib/db.ts` finns kvar och används av äldre admin- och read-flöden. Den gör heltabellsläsningar, Node-filtrering och har en falsk `$transaction`.
2. Alla adminmuteringar är ännu inte flyttade till domänspecifika repositories/RPC-funktioner.
3. Personnummerkolumnen i legacy-schemat är inte fullt backfillad till krypterat värde + HMAC-sökhash.
4. E-post-OTP skickas direkt i requesten; leveransen ska flyttas till transactional outbox-worker.
5. Full e-signeringsprovider/BankID, certifikatbevis och slut-PDF-generering återstår.
6. SSRF-skydd och asynkron inkommande webhookprocessor är inte komplett.
7. Ekonomiprovider är inte produktionskopplad och mockprovider måste hållas avstängd i produktion.
8. Fullständig RLS-matris för alla äldre tabeller och samtliga skrivoperationer måste verifieras mot riktig lokal Supabase.
9. Verkliga parallella concurrencytester och E2E har inte körts i denna miljö.
10. Publik sökning, bevakningar, kravmotor, visningsväntelista, dokumentgranskning, full in-/avflyttning och entreprenörsflöden är inte kompletta enligt masterplanen.

## Säkerhetsgräns

Systemet ska tills dessa blockerare är lösta behandlas som utvecklings-/pilotkod, inte som färdig produktion för skarpa hyresgäster.
