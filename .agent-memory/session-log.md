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
