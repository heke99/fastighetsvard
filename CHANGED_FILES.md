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

# Tillägg — FaddeBo konton, dashboards och varumärke — 2026-08-03

## Konton, Auth och roller

- `src/lib/role-routing.ts`
- `src/lib/auth.ts`
- `src/lib/permissions.ts`
- `src/lib/supabase/users.ts`
- `src/lib/supabase/admin.ts`
- `src/lib/repositories/staff-operations.ts`
- `src/app/(public)/auth-actions.ts`
- `src/app/(public)/logga-in/page.tsx`
- `src/app/(public)/logga-in/ResendConfirmationForm.tsx`
- `src/app/(public)/glomt-losenord/page.tsx`
- `src/app/(public)/aterstall-losenord/ResetPasswordForm.tsx`
- `src/app/(public)/skapa-konto/page.tsx`
- `src/app/admin/actions.ts`
- `src/app/admin/anvandare/page.tsx`
- `src/app/admin/entreprenorer/page.tsx`
- `src/app/entreprenor/layout.tsx`
- `scripts/bootstrap-admin.mjs`
- `package.json`

## Dashboards och konsekvent navigation

- `src/app/admin/AdminNav.tsx`
- `src/app/admin/layout.tsx`
- `src/app/admin/page.tsx`
- `src/app/(portal)/mina-sidor/PortalNav.tsx`
- `src/app/(portal)/mina-sidor/layout.tsx`
- `src/app/(portal)/mina-sidor/page.tsx`
- `src/components/SiteHeader.tsx`

## FaddeBo-identitet, e-post och webb

- `.env.example`
- `src/lib/branding.ts`
- `src/lib/email.ts`
- `src/components/Logo.tsx`
- `src/components/SiteFooter.tsx`
- `src/app/layout.tsx`
- `src/app/icon.png`
- `src/app/apple-icon.png`
- `public/brand/faddebo-logo.png`
- `public/brand/faddebo-mark.png`
- `src/app/(public)/page.tsx`
- `src/app/(public)/layout.tsx`
- `src/app/(public)/felanmalan/page.tsx`
- `src/app/(public)/tillganglighet/page.tsx`
- `src/app/(public)/aktivera/[token]/page.tsx`
- `src/app/(public)/annons/[slug]/page.tsx`
- `src/app/(portal)/mina-sidor/profil/page.tsx`
- `src/lib/repositories/public-catalog.ts`
- `next.config.ts`

## Databas, tester och dokumentation

- `supabase/migrations/20260803230000_faddebo_accounts_and_roles.sql`
- `supabase/seed.sql`
- `tests/branding.test.ts`
- `tests/role-routing.test.ts`
- `tests/production-hardening.test.ts`
- `tests/supabase-schema.test.ts`
- `docs/ACCOUNT_AND_EMAIL_SETUP.md`
- `README.md`
- `.agent-memory/**` relevanta status-, beslut-, blockerar- och sessionsfiler

## Borttaget

- `src/app/(public)/till-salu/page.tsx`
- `src/app/(public)/parkering/page.tsx`
- `src/app/(public)/aterstall-losenord/[token]/page.tsx`
- `src/app/(public)/aterstall-losenord/[token]/ResetPasswordForm.tsx`
