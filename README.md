# Östgöta El Teknik – Fastighetsplattform

Fastighetsplattform för uthyrning, försäljning, Mina sidor, felanmälan,
arbetsorder, avtal, fakturavisning, bokföringsintegrationer, REST API och
webhooks.

## Teknik

- Next.js 15, React 19 och TypeScript
- Supabase Auth för inloggning, återställning och sessionscookies
- Supabase Postgres via Data API
- Supabase SQL-migrationer och Row Level Security
- Supabase Storage för media och dokument
- Resend för transaktionsmejl
- Vercel för webb, API-routes och cron

Projektet har ingen Prisma-runtime, inget Prisma-schema och kräver varken
`DATABASE_URL` eller `DIRECT_URL`.

## Lokal start

```bash
npm ci
cp .env.example .env.local
# fyll i Supabase URL, publishable key och secret key
npm run typecheck
npm test
npm run dev
```

## Databas

Länka Supabase CLI och applicera SQL-migrationerna:

```bash
npx supabase login
npm run supabase:link -- --project-ref DIN_PROJECT_REF
npm run db:push
```

Migrationerna finns i `supabase/migrations/` och grunddata i
`supabase/seed.sql`.

Skapa första superadmin efter att migration och seed är applicerade:

```bash
cp .env.example .env.local
# fyll i BOOTSTRAP_ADMIN_EMAIL och BOOTSTRAP_ADMIN_PASSWORD
npm run bootstrap:admin
```

Ta därefter bort bootstrap-lösenordet ur `.env.local`.

## Verifiering

```bash
npm run typecheck
npm test
npm run build
```

## Struktur

```text
supabase/migrations/        Databasschema, constraints, RLS och Storage
supabase/seed.sql           Organisation och systemroller, inga demokonton
scripts/bootstrap-admin.mjs Säker engångsskapning av superadmin
src/lib/supabase/           Browser-, server-, middleware- och admin-klienter
src/lib/db.ts               Supabase Data API-gateway för domänlagret
src/lib/auth.ts             Supabase Auth + applikationens RBAC-profil
src/lib/services/           Affärslogik
src/app/(public)/           Publik webb
src/app/(portal)/           Mina sidor
src/app/admin/              Administration
src/app/entreprenor/        Entreprenörsportal
src/app/api/                REST API, integrationer, webhooks och cron
```

## Säkerhetsprinciper

- Supabase secret key används endast i serverkod.
- Supabase Auth-användaren länkas 1:1 till tabellen `User`.
- RBAC kontrolleras i server actions och API-routes.
- RLS är aktiverat på samtliga applikationstabeller.
- Offentlig direktåtkomst begränsas till publicerad katalogdata.
- Juridiska och ekonomiska förändringar revisionsloggas.
- API-nycklar och integrationsuppgifter lagras hashade eller krypterade.

Se [SUPABASE_VERCEL_SETUP.md](./SUPABASE_VERCEL_SETUP.md) för driftsättning.
