# FaddeBo

FaddeBo är Östgöta El Teknik AB:s Next.js- och Supabase-plattform för hela
uthyrningsflödet: annons, sökande, ansökan, visning, erbjudande, avtal,
inflyttning, hyresgästportal, uppsägning och avflyttning.

## Status

Projektet har fått en första produktionshärdning av migrationskedja, atomiska kärnoperationer, Auth, RLS, Storage, idempotens, OTP-signering, rate limiting och CI. Den tidigare generiska heltabellsadaptern är borttagen; läsningar går via avgränsade repositories och fler-radsoperationer via PostgreSQL-RPC:er.

Hela målbilden är **inte** färdig och projektet ska inte hantera skarpa personuppgifter innan blockerarna i [`docs/PRODUCTION_HARDENING_PHASE1.md`](docs/PRODUCTION_HARDENING_PHASE1.md) är stängda. Särskilt återstår att exekvera och verifiera migrationskedjan, RLS, Storage, verklig concurrency, browser-E2E och providerflöden i en riktig Supabase-testmiljö.

## Låsta verktygsversioner

- Node.js 22.16.0
- npm 10.9.2
- Next.js 15.5.20
- Supabase CLI 2.109.1

## Lokal start och verifiering

```bash
nvm install 22.16.0
nvm use 22.16.0
npm install -g npm@10.9.2
npm ci
cp .env.example .env.local
supabase start
npm run db:reset
npm run db:verify
npm run test:rls
npm run lint
npm run typecheck
npm run test:unit
npm run test:concurrency
npm run build
npm run dev
npm run test:e2e
```

## Struktur

```text
supabase/migrations/       Canonical schema och härdningsmigrationer
supabase/tests/            Schema- och RLS-verifiering
supabase/manual/           Preflight/backfill-rapport för befintlig miljö
src/lib/repositories/      Domänspecifik PostgreSQL/Supabase-åtkomst
src/lib/services/          Domäntjänster
src/app/(public)/          Publik webb
src/app/(portal)/          Sökande- och hyresgästportal
src/app/admin/             Administration
src/app/entreprenor/       Entreprenörsportal
src/app/api/               API, integrationer och skyddade systemroutes
docs/                      Arkitektur, deployment, drift och releasegrind
```

## Dokumentation

- [Produktionshärdning och kvarvarande blockerare](docs/PRODUCTION_HARDENING_PHASE1.md)
- [Databas, RLS och Storage](docs/DATABASE_RLS_STORAGE.md)
- [Installation och deployment](docs/DEPLOYMENT.md)
- [Konton, roller och e-post](docs/ACCOUNT_AND_EMAIL_SETUP.md)
- [Drift, backup och incidenter](docs/OPERATIONS_AND_INCIDENTS.md)
- [Test- och releasegrind](docs/TEST_AND_RELEASE_GATE.md)
- [Leveransrapport](DELIVERY_REPORT.md)
