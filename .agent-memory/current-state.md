# Current State

Last updated: 2026-08-03 23:25 Europe/Stockholm  
Last verified commit: UNVERIFIED — the supplied archive contains no `.git`  
Current branch: UNVERIFIED  
Current phase: FaddeBo account, role, brand and public-site rollout  
Current task: execute migration and verify Auth/e-mail flows in Supabase staging

## Production status

Not ready for production evidence. Account and branding changes are implemented
in source, but the new migration, Supabase Auth e-mail confirmation, Resend,
real login flows and deployment have not been exercised in an approved runtime.

## Current source status

STATICALLY VERIFIED in this environment:

- `node scripts/lint.mjs` passed and inspected 30 canonical migrations.
- `node --check scripts/bootstrap-admin.mjs` passed.
- owner/superadmin, fastighetsvärd, applicant and tenant routing is centralized
  in `src/lib/role-routing.ts`;
- public self-registration remains applicant-only and requires Supabase e-mail
  confirmation;
- owner-created staff accounts choose their password through a recovery link;
- public navigation no longer exposes `/till-salu` or `/parkering`;
- ordinary contact addresses resolve to `info@faddebo.se`; fault reports resolve
  to `felanmalan@faddebo.se`;
- the new logo assets are under `public/brand/` and are used by the shared Logo
  component and application icons.

NOT RUN after the 2026-08-03 changes:

- dependency installation, typecheck, Vitest and Next production build;
- migration execution, RLS/DB suites and real browser flows.

Reason: `npm ci` is blocked by the environment's internal npm registry returning
404 for `zod-3.25.76.tgz`. No source package versions were changed to mask this
environmental failure.

## Database status

The ordered source chain contains 30 forward migrations. The latest is:

```text
supabase/migrations/20260803230000_faddebo_accounts_and_roles.sql
```

It has not been applied in this environment.

## External configuration still required

- Supabase Site URL and callback URL for `https://faddebo.se`;
- Email/Password with required e-mail confirmation;
- custom Supabase SMTP sender `FaddeBo <info@faddebo.se>`;
- verified Resend domain and production `RESEND_API_KEY`;
- Vercel environment variables from `.env.example`.

## Exact resume point

In a normal clone with working npm access and approved Supabase staging:

```bash
npm ci
npm run lint
npm run typecheck
npm run test:unit
npm run build
supabase db push
npm run db:verify
npm run test:rls
```

Then follow `docs/ACCOUNT_AND_EMAIL_SETUP.md`, run `npm run bootstrap:owner`,
and exercise the ten account/e-mail/navigation checks listed in that document.
