# Session Log

## 2026-07-25 14:45 — Bootstrap and verified baseline

### Goal

Start the full FaddeBo migration and establish persistent project memory.

### Inspected

Master prompt, package/runtime, source tree, 15 migrations, RLS/Storage
hardening, branding, Auth/RBAC, RPC repository and legacy adapter usage.

### Changes

Added AGENTS contract, Cursor rules and project-specific memory.

### Decisions

Keep legal organization separate from FaddeBo. Add only forward migrations.
Treat the generic adapter as a P0 migration target.

### Verification performed

`npm ci`; lint; typecheck; 27 Vitest tests; Next.js build; static concurrency check.

### Verification result

All executed checks passed. DB/RLS/Storage/E2E runtime checks were not run.

### Remaining issues

Brand migration, fake transactions, full-table adapter and external DB gate.

### Exact resume point

Create `supabase/migrations/20260725010000_faddebo_brand.sql`.

### Memory files updated

All initial memory files.

## 2026-07-25 15:07 — FaddeBo phase-one implementation

### Goal

Separate FaddeBo from the legal organization and replace critical fake
transaction commands.

### Changes

Added two forward migrations, Brand configuration/copy/seed/bootstrap, direct
RPC repository wrappers, admin preconditions, tests and canonical project
rules. Archived the previous delivery report and wrote a source-accurate
current report.

### Verification performed

Sequential `lint`, `typecheck`, Vitest, Next.js production build and static
concurrency primitive verification.

### Verification result

All executed checks passed; 31 of 31 tests passed. DB/RLS/Storage/E2E and true
parallel tests were not run because no usable database runtime is available.

### Exact resume point

Implement scoped public listing reads, then migrate the remaining
`@/lib/db` callers by domain until `src/lib/db.ts` can be deleted.

## 2026-07-25 16:17 — Canonical repository migration complete

### Goal

Remove the generic database adapter from every public, portal, auth, admin, API
and integration flow without claiming unexecuted database behavior.

### Changes

Added scoped catalog/account/portal/maintenance/staff/admin/API/integration,
tenant-import and webhook repositories. Added twelve further forward
migrations for canonical reads, atomic commands, provisioning, metrics,
invitations, webhook delivery and external invoice persistence. Deleted
`src/lib/db.ts`, `src/lib/database-schema.json` and `src/lib/counters.ts`.
Added static regression guards and expanded the suite to 40 tests.

The final edge pass scoped the legal data-protection address to the legal
organization, preserved unrelated ExternalReference links during upsert,
generated listing slugs from title plus unit number, and enforced the
organization boundary when resolving an accounting connection.

### Verification performed

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build` and
`npm run test:concurrency`.

### Verification result

All source checks passed: 29 migrations statically inspected, 40/40 tests
passed and the Next.js production build completed. The concurrency command
only verifies source primitives.

### Not run

Fresh/upgrade migration execution, DB integration, RLS, Storage, real parallel
transactions, browser E2E, provider delivery and deployment. No Docker,
PostgreSQL credentials or Git metadata were available.

### Exact resume point

In the canonical Git clone on Node 22.16.0/npm 10.9.2, run `supabase start`,
`npm run db:reset`, `npm run db:verify`, `npm run test:rls` and the real
parallel suite. Fix the first failure with a new forward migration.

## 2026-08-03 — FaddeBo accounts, dashboards and public branding

Implemented owner/superadmin bootstrap, protected staff provisioning,
Fastighetsvärd / förvaltare role naming, role-aware login routing and menus,
applicant/tenant dashboard separation, signup confirmation resend, password
recovery, FaddeBo contact addresses, logo assets, exact homepage hero copy and
public removal/redirect of Till salu and Parkeringar. Added migration
`20260803230000_faddebo_accounts_and_roles.sql`, regression tests and
`docs/ACCOUNT_AND_EMAIL_SETUP.md`.

Executed: `node --check scripts/bootstrap-admin.mjs` and
`node scripts/lint.mjs` (passed, 30 migrations). `npm ci` was blocked by an
internal registry 404 for the locked Zod tarball, so typecheck/tests/build were
not claimed.

## 2026-08-04 — Role, tenant, listing-media and maintenance consistency

### Goal

Make the same person, role, apartment and fault-report facts visible and
behave consistently across tenant, property-manager and superadmin surfaces.

### Changes

Synchronized system roles and permissions; added exact role names to session
context and person/admin views; made custom roles route to admin; required an active same-organization actor with `roles:create`, protected wildcard roles in app and DB, and filtered person-list roles by organization; added organization-bound listing image/floorplan
uploads; completed fault-report attachments, e-mail notifications, portal
visibility and post-commit failure isolation; displayed co-tenants on units.

### Verification performed

- static migration/project lint: PASS, 36 migrations;
- account verifier: PASS, 16 checks;
- login/dashboard verifier: PASS, 10 checks;
- role/tenant/media/maintenance verifier: PASS, 27 checks;
- TypeScript syntax transpilation: PASS, 27 changed files;
- TypeScript/SQL system-role permission comparison: PASS, 13 roles exact.

### Not run

Locked dependency install, complete semantic typecheck, Vitest, Next build,
Supabase migration execution, RLS/Storage and real Resend/browser flows. The
internal registry returned 404 for locked Zod.

### Exact resume point

Use the canonical Git clone and approved staging environment; run the command
sequence and acceptance matrix in `FADDEBO_KONSEKVENSRAPPORT.md`.
