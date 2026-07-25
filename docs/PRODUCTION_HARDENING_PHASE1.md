# Produktionshärdning – etapp 1

## Omfattning

Denna etapp åtgärdar de mest riskfyllda fundamenten i den ursprungliga lösningen. Den är inte en deklaration att hela FaddeBo-målbilden är färdig.

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
- central grundkonfiguration för branding;
- separat FaddeBo-varumärke och juridisk organisation;
- avvecklad generisk heltabellsadapter och domänspecifika repositories/RPC:er.

## Kända blockerare

Följande måste slutföras innan riktiga personuppgifter eller juridiskt bindande avtal används:

1. Personnummerkolumnen i legacy-schemat är inte fullt backfillad till krypterat värde + HMAC-sökhash.
2. E-post-OTP skickas direkt i requesten; leveransen ska flyttas till transactional outbox-worker.
3. Full e-signeringsprovider/BankID, certifikatbevis och slut-PDF-generering återstår.
4. SSRF-skydd och asynkron inkommande webhookprocessor måste runtime-verifieras.
5. Ekonomiprovider är inte produktionskopplad och mockprovider måste hållas avstängd i produktion.
6. Fullständig migrationskedja, RLS-matris och Storage-policyer måste exekveras och verifieras mot riktig Supabase.
7. Verkliga parallella concurrencytester och E2E har inte körts i denna miljö.
8. Publik sökning, bevakningar, kravmotor, visningsväntelista, dokumentgranskning, full in-/avflyttning och entreprenörsflöden behöver fullständig produktacceptans mot masterplanen.

## Säkerhetsgräns

Systemet ska tills dessa blockerare är lösta behandlas som utvecklings-/pilotkod, inte som färdig produktion för skarpa hyresgäster.
