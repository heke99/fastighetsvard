# Current State

Last updated: 2026-07-25 16:17 Europe/Stockholm
Last verified commit: UNVERIFIED — the supplied archive contains no `.git`
Current branch: UNVERIFIED
Current phase: Phase 1 — external runtime verification
Current task: execute the canonical migration chain and security suites in Supabase

## Production status

Not ready. The source/build gate is green, but the database, RLS, Storage,
real-concurrency, browser-E2E, provider and deployment gates have not run.

## Source and build status

VERIFIED on Node 24.14.0 and npm 11.9.0, while the repository contract is Node
22.16.0 and npm 10.9.2:

- `npm run lint` passed and inspected 29 canonical migrations.
- `npm run typecheck` passed.
- `npm test` passed: 40 of 40 tests in 6 files.
- `npm run build` passed with Next.js 15.5.20 and 32 generated static pages.
- `npm run test:concurrency` passed its static primitive check only.
- `src/lib/db.ts`, `src/lib/database-schema.json` and `src/lib/counters.ts`
  are deleted; no source import, fake `$transaction` or wildcard projection
  remains.

## Database status

The ordered source chain contains 29 forward migrations. Applied remote state,
fresh install, upgrade, DB integration, RLS and Storage behavior are NOT RUN.

## FaddeBo brand status

STATICALLY VERIFIED. FaddeBo is the customer brand and Östgöta El Teknik AB,
org.nr 559350-5620, remains the legal entity. The forward Brand migration has
not been executed against a database in this environment.

## Active blockers

Missing live database/provider runtime and absent Git metadata.

## Exact resume point

Use Node 22.16.0/npm 10.9.2 in a clone with Git metadata. Start local Supabase
and run, in order:

```bash
supabase start
npm run db:reset
npm run db:verify
npm run test:rls
npm run test:concurrency
```

Fix the first SQL/runtime failure with a new forward migration; never edit an
already-installed migration. After the DB gate is green, run `npm run
test:e2e`, provider/webhook/outbox tests and deployment smoke tests.
