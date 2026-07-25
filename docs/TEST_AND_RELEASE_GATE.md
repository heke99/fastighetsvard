# Test- och releasegrind

En release är blockerad om någon av följande inte är grön i en miljö med installerade dependencies, Docker och Supabase CLI:

```bash
npm ci
npm run lint
npm run typecheck
npm run test:unit
supabase start
npm run db:reset
npm run db:verify
npm run test:rls
npm run test:concurrency
npm run build
npm run dev
npm run test:e2e
```

Därutöver krävs riktiga parallella tester för ansökan, visningskapacitet, erbjudandeacceptans, avtalsaktivering, versionsskapande, workerclaim och idempotens. Statiska strängtester räcker inte som produktionsbevis.

## Resultat i denna arbetsmiljö

- `npm run lint`: godkänd; 29 migrationer och adapterregler statiskt verifierade.
- `node scripts/verify-concurrency-primitives.mjs`: godkänd statisk kontroll.
- `npm run typecheck`: godkänd.
- `npm test`: 40 av 40 tester i 6 filer godkända.
- `npm run build`: godkänd med Next.js 15.5.20.
- Supabase reset/schema/RLS: inte körda; Docker/PostgreSQL saknas.
- Verklig concurrency, E2E, providers och deployment: inte körda.

Kontrollerna kördes på Node 24.14.0/npm 11.9.0, inte projektets låsta Node
22.16.0/npm 10.9.2. Releasegrinden ska därför upprepas på målversionerna.
