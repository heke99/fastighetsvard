# Current State

Last updated: 2026-08-04 11:55 Europe/Stockholm  
Last verified commit: UNVERIFIED — the supplied archive contains no `.git`  
Current branch: UNVERIFIED  
Current phase: role, tenant, listing-media and maintenance consistency  
Current task: apply the latest migration and execute runtime acceptance tests

## Production status

Not production-verified. The requested role, tenant, apartment/listing and
fault-report consistency changes are implemented and statically verified, but
the new migration, Storage writes, Resend delivery, browser flows and deployed
Supabase behavior have not been exercised in an approved runtime.

## Current source status

STATICALLY VERIFIED in this environment:

- `node scripts/lint.mjs` passed and inspected 36 canonical migrations;
- `node scripts/verify-account-lifecycle.mjs` passed 16 checks;
- `node scripts/verify-login-dashboard.mjs` passed 10 checks;
- `node scripts/verify-role-maintenance-consistency.mjs` passed 27 checks;
- all 27 changed TypeScript/TSX files passed TypeScript syntax transpilation;
- the 13 TypeScript system-role permission sets exactly match the latest SQL
  synchronization migration;
- logged-in staff see exact role names in the admin header and person lists;
- organization-specific custom roles route to `/admin`, require a description,
  accept only canonical permission identifiers, require an active same-organization actor with `roles:create`, and cannot receive global `*` unless created by a superadmin;
- role names, permissions and person linkage in `current_user_context()` are organization-scoped, and person-list role hydration filters out roles from other organizations;
- units display primary and co-tenants from active contracts;
- apartment/listing administration supports organization-bound image and
  floorplan uploads to canonical `UnitMedia`/`listing-media` storage;
- tenant fault reports are written atomically before e-mail/webhook/attachment
  side effects, appear in both portals, accept validated private attachments
  and send receipt/internal/status e-mail notifications;
- post-commit e-mail/webhook/media failures no longer report the already-saved
  domain record as missing or encourage duplicate submissions.

NOT RUN after the 2026-08-04 changes:

- dependency installation, complete semantic typecheck, Vitest and Next build;
- migration execution, DB/RLS/Storage suites and real browser/e-mail flows.

Reason: `npm ci` is blocked by the environment's internal npm registry returning
404 for the locked `zod-3.25.76.tgz` tarball. Running the global TypeScript
compiler without installed dependencies produced expected missing Next/React/
Zod/Node declarations and is not counted as a release typecheck.

## Database status

The ordered source chain contains 36 forward migrations. The latest is:

```text
supabase/migrations/20260804120000_role_context_consistency.sql
```

It synchronizes canonical role labels/permissions, protects privileged custom
roles and adds organization-scoped role names to the authenticated context. It
has not been applied in this environment.

## External configuration still required

- Supabase Site URL and callback URL for `https://faddebo.se`;
- production-like Supabase database with all 36 migrations;
- verified Resend domain, `RESEND_API_KEY` and `EMAIL_FROM=FaddeBo <info@faddebo.se>`;
- `listing-media` public bucket and `maintenance-files` private bucket created by
  the existing storage migration;
- Vercel environment variables from `.env.example`.

## Exact resume point

In the canonical clone with working npm access and approved Supabase staging:

```bash
npm ci
npm run lint
npm run verify:accounts
npm run verify:login-dashboard
npm run verify:consistency
npm run typecheck
npm run test:unit
npm run build
supabase db push
npm run db:verify
npm run test:rls
```

Then execute the manual role, listing-media and maintenance acceptance matrix in
`FADDEBO_KONSEKVENSRAPPORT.md` and verify real Resend delivery and Storage URLs.
