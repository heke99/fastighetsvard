# Ändrade, tillagda och borttagna filer — 2026-07-25

## Projektstyrning och spårbarhet

- `AGENTS.md`
- `.cursor/rules/**`
- `.agent-memory/**`
- `README.md`
- `DELIVERY_REPORT.md`
- `CHANGED_FILES.md`
- `DELETE_FILES.txt`
- `docs/PRODUCTION_HARDENING_PHASE1.md`
- `docs/TEST_AND_RELEASE_GATE.md`

## FaddeBo och juridisk identitet

- `.env.example`, `package.json`, `package-lock.json`
- `src/lib/branding.ts`, `src/components/Logo.tsx`
- `src/app/layout.tsx`, publika ytor och portalytor
- `src/lib/email.ts`, OpenAPI-route, permissions och bootstrap
- `supabase/seed.sql`

## Databas

- 14 forward migrationer:
  `20260725010000_faddebo_brand.sql` till
  `20260725140000_external_invoice_commands.sql`
- `supabase/tests/**` och `supabase/manual/**`

## Repositories, tjänster och routes

- 17 filer under `src/lib/repositories/**`
- admin-, auth-, portal-, API- och integrationsflöden under `src/app/**`
- domäntjänster under `src/lib/services/**`
- integrationslager under `src/lib/integrations/**`

## Verifiering

- `scripts/lint.mjs`
- `tests/branding.test.ts`
- `tests/production-hardening.test.ts`
- `tests/supabase-schema.test.ts`

## Borttaget

- `src/lib/db.ts`
- `src/lib/database-schema.json`
- `src/lib/counters.ts`

Den tidigare leveransrapporten bevaras under
`.agent-memory/archive/historical-status/`.
