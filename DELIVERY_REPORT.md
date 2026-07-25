# FaddeBo — leveransrapport 2026-07-25

## Utfall

FaddeBo är etablerat som kundvarumärke medan Östgöta El Teknik AB, org.nr
559350-5620, är kvar som juridisk part. Den generiska databasanpassningen är
helt avvecklad i källan: publika ytor, portal, Auth, admin, API och integrationer
använder nu avgränsade repositories och atomiska PostgreSQL-RPC:er.

Projektet är fortfarande **inte produktionsklart**. Källkod, tester och build
är gröna, men migrationskedjan, RLS, Storage, verklig concurrency,
browser-E2E, providerflöden och deployment måste verifieras i en riktig
Supabase-testmiljö.

## Levererat

- Central FaddeBo-konfiguration, kundcopy, metadata, e-postavsändare, OpenAPI,
  portaltexter och bevarad juridisk identitet.
- `Brand`-modell med constraints, RLS/grants, primärt varumärke och koppling
  till centrala domänposter.
- 29 ordnade forward-only migrationer, varav 14 nya för varumärke, avgränsade
  läsningar och atomiska admin-, portal-, staff-, tenant- och
  integrationskommandon.
- 17 domänspecifika repositorymoduler med explicita projektioner och
  organisationsavgränsning.
- Atomisk provisionering, inbjudan, betalnings-/kund-/fakturaimport,
  webhookclaim/försöksloggning och integrationsköer.
- Borttagning av `src/lib/db.ts`, `src/lib/database-schema.json` och
  `src/lib/counters.ts`.
- Permanenta lint- och testregler som blockerar adapterimporter, falska
  `$transaction`-anrop och `select("*")`.
- Bestående projektminne, arbetsregler och en verifieringsmatris med exakta
  återupptagningssteg.

## Verifierat i denna miljö

Kört på Node 24.14.0/npm 11.9.0. Projektets låsta mål är Node 22.16.0/npm
10.9.2.

- `npm run lint` — godkänd, 29 migrationer statiskt inspekterade
- `npm run typecheck` — godkänd
- `npm test` — 40 av 40 tester i 6 testfiler godkända
- `npm run build` — godkänd med Next.js 15.5.20 och 32 statiska sidor
- `npm run test:concurrency` — endast statisk primitive-kontroll godkänd

## Inte kört

- Fresh-install och uppgraderingsväg för migrationskedjan
- DB-integration och verkligt parallella concurrency-/rollbacktester
- Negativa RLS- och Storage-tester
- Browser-E2E för registrering till avflyttning
- Externa accounting-, e-post-, webhook- och outboxflöden
- Vercel/Supabase deploy och production smoke test

Docker/PostgreSQL och godkända testdatabasuppgifter saknades. Arkivet innehöll
ingen `.git`, så remote, branch och commit är **UNVERIFIED**; ingen push, PR
eller deploy har gjorts.

## Nästa releasegrind

```bash
supabase start
npm run db:reset
npm run db:verify
npm run test:rls
npm run test:concurrency
npm run test:e2e
```

Verkliga parallella databastester måste komplettera det statiska
`test:concurrency`-skriptet. Exakt arbetsläge finns i
`.agent-memory/current-state.md`.
