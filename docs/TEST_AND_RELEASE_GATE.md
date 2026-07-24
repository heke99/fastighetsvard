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

- `node scripts/lint.mjs`: godkänd med varning om kvarvarande legacy-adapter.
- `node scripts/verify-concurrency-primitives.mjs`: godkänd statisk kontroll.
- TypeScript syntaxtranspilering: godkänd för 160 `.ts/.tsx`-filer.
- Funktions-/grant-signaturkontroll: 38 funktioner, 34 grants, 0 mismatchar.
- `npm ci`: fastnade utan output och avbröts; dependencies kunde därför inte installeras.
- `tsc --noEmit`: kördes men kan inte ge giltigt resultat utan dependencies; rapporterade huvudsakligen saknade moduler/typer.
- Supabase reset/schema/RLS: ej körbart eftersom Supabase CLI, Docker och psql saknas.
- Vitest/build/E2E: ej körbara utan dependencies.
