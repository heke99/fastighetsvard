# Installation

## Krav

- Node.js 22
- npm
- Supabase-projekt
- Supabase CLI

## Installera

```bash
npm ci
cp .env.example .env.local
```

Fyll i `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` och
`SUPABASE_SECRET_KEY`. Kontrollera att alla värden tillhör samma Supabase-projekt med `npm run verify:auth`.

## Databas

```bash
npx supabase login
npm run supabase:link -- --project-ref DIN_PROJECT_REF
npm run db:push
```

Auth-mejl och SMTP konfigureras enligt `docs/SUPABASE_SMTP_AND_AUTH.md`.

## Första administratör

```bash
npm run bootstrap:admin
```

## Kontroll

```bash
npm run typecheck
npm test
npm run build
```

## Lokal drift

```bash
npm run dev
```

## Produktion

Vercel bygger med `npm run vercel-build`. SQL-migrationerna ska appliceras med
Supabase CLI innan en release som kräver schemaändringar.
