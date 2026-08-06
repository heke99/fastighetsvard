# FaddeBo system consistency audit — 2026-08-06

## Executive summary

Repository: `heke99/fastighetsvard`  
Baseline: `main` at `d9c7cfe5c78272f76af5ace23dee0c647c66d489`  
Audit branch: `codex/system-consistency-audit-2026-08-06`

This review followed the repository's `AGENTS.md` source hierarchy: active code
and tests first, then migrations/schema, then documentation and project memory.
The review covered the public rental surface, applicant/tenant portal, staff
administration, contractor portal, external API, authentication, roles,
organization scoping, maintenance, e-mail, branding, Supabase migrations, RLS
verification, Storage gates, CI and deployment evidence.

The audit does **not** claim that no undiscovered defect exists. It records
verified findings, source fixes and the runtime evidence still required before a
production release.

## Confirmed findings and disposition

| ID | Severity | Finding | Disposition |
|---|---:|---|---|
| F-001 | High | API idempotency could mark a request `FAILED` after the domain write had already succeeded but storing the response failed. A retry could then execute the write again. | Fixed with migration `20260806143000_idempotency_outcome_hardening.sql`, an `UNCERTAIN` state, API handling, PostgreSQL verification and OpenAPI documentation. |
| F-002 | Medium | `supabase/seed.sql` overwrote the canonical superadmin display name after migrations and did not remove stale role permissions. A clean reset could therefore differ from the production migration model. | Fixed by making the seed catalogue idempotent and exact for role name, description and permission sets. `verify_schema.sql` now verifies the catalogue after reset. |
| F-003 | Medium | `WAITING_TENANT` used the tenant-facing label “Väntar på dig” in the shared status component, so staff views could address the wrong audience. E-mail maintained a separate duplicate label map. | Fixed by introducing one typed status-label source with explicit `staff` and `tenant` audiences. Portal, admin badge and e-mail now reuse it. |
| F-004 | Low | Branding fallbacks disagreed with `.env.example`, and the example advertised contact e-mail variables that the application intentionally ignored. | Fixed by aligning canonical fallbacks, removing misleading variables and extending branding tests. |
| F-005 | Medium | `src/lib/database-types.ts` still contains broad `Record<string, any>` and `any` payload aliases. Typecheck therefore cannot prove full agreement with the Supabase schema. | Open follow-up. Replace with generated Supabase database types and migrate repositories incrementally. |
| F-006 | Release blocker | Hosted Supabase migrations, negative RLS/Storage checks, real Resend delivery and browser acceptance flows are not proven by repository inspection alone. | Open external gate. CI can prove a fresh local Supabase reset; staging must still prove provider and deployed-environment behavior. |

## Source changes

### Canonical role and seed model

- Replaced repetitive role seed statements with one canonical role catalogue.
- Upserts exact system-role names and descriptions.
- Removes permissions that no longer belong to a role.
- Adds missing permissions idempotently.
- Added database assertions for all 13 system roles and their exact permissions.

### Maintenance status consistency

- Added `src/lib/status-labels.ts` as the only maintenance label source.
- Staff/integration wording: `WAITING_TENANT` → `Väntar på hyresgäst`.
- Tenant portal/e-mail wording: `WAITING_TENANT` → `Väntar på dig`.
- Removed the duplicate maintenance status map from `src/lib/email.ts`.
- Added exhaustive typed tests for every `MaintenanceStatus` value.

### API idempotency hardening

- Added status `UNCERTAIN` to `OperationIdempotency`.
- A confirmed domain exception is still stored as `FAILED` and remains retryable.
- A successful domain write followed by an uncertain completion receipt is
  stored as `UNCERTAIN` and cannot be automatically claimed again.
- A race where completion actually succeeded is tolerated and remains replayable.
- API error responses explicitly tell clients not to use a new key until the
  result has been checked using the request ID.
- OpenAPI was bumped to `1.0.1` and documents 409/503 idempotency outcomes on
  every endpoint that exposes `Idempotency-Key`.

### Branding configuration

- Canonical fallback tagline, phone and address now match `.env.example`.
- Canonical contact addresses remain locked to `faddebo.se`.
- Removed ignored e-mail variables from `.env.example`.
- Added tests for default branding and resistance to stale environment values.

## Verification gates added or extended

- `npm run verify:consistency`
  - verifies role migration order and organization-scoped role context;
  - verifies exact seed role synchronization;
  - verifies audience-specific maintenance labels;
  - verifies branding configuration consistency;
  - verifies API idempotency hardening and its regression tests.
- `npm run test:unit`
  - includes `tests/status-labels.test.ts`;
  - includes `tests/idempotency-hardening.test.ts`;
  - extends `tests/branding.test.ts`.
- `npm run db:verify`
  - runs the existing schema verification;
  - runs `supabase/tests/verify_idempotency.sql`;
  - checks the `UNCERTAIN` constraint, function definitions and grants.
- Existing CI still runs lint, account lifecycle, login/dashboard consistency,
  system consistency, typecheck, unit tests, build, Supabase reset, schema/RLS,
  E2E smoke, dependency audit and secret scanning.

## Security and tenancy review

The reviewed staff, portal and external API paths consistently derive an
organization identifier from the authenticated user or API key and pass it to
scoped repositories or PostgreSQL RPCs. The contractor route derives the
supplier identity from the authenticated context before listing work orders.
The reviewed role-context migration filters global roles or roles belonging to
the current organization.

No confirmed cross-organization disclosure was found in the reviewed paths.
That is not equivalent to runtime RLS proof. The negative SQL suite and private
Storage-path tests must pass after a fresh reset and in an approved staging
project.

## Remaining technical debt

### Generated database types

`src/lib/database-types.ts` is a compatibility layer rather than an exact schema
contract. The next hardening phase should:

1. generate Supabase TypeScript types from the canonical schema;
2. type the browser, server and service-role clients;
3. replace `Record<string, any>` repository return values incrementally;
4. add a CI drift check that regenerates types and fails on a diff.

This should be a dedicated PR because it touches most repositories and requires
runtime schema access. Mixing it into this consistency fix would increase risk.

### Runtime release evidence

Before release, execute against a fresh local Supabase stack and an approved
staging project:

```bash
npm ci
npm run lint
npm run verify:accounts
npm run verify:login-dashboard
npm run verify:consistency
npm run typecheck
npm run test:unit
npm run build
supabase db reset
npm run db:verify
npm run test:rls
npm run test:concurrency
npm run test:e2e
```

Then verify real registration, staff invitation, password reset, tenant
maintenance with private attachments, listing media, Resend delivery, webhook
retry, accounting sync and role-specific navigation.

## Skill routing matrix

All 36 skills in `skills-lock.json` were routed. “Applied” means the skill had a
concrete check or change in this review. “Reviewed/no change” means its domain
was checked but no justified code change was introduced. “Conditional” means
it remains relevant to the external runtime gate.

| Skill | Routing | Concrete use |
|---|---|---|
| acquire-codebase-knowledge | Applied | Mapped routes, portals, repositories, migrations, tests and project memory before edits. |
| api-and-interface-design | Applied | Kept API errors, headers and idempotency semantics consistent across endpoints. |
| api-design-principles | Applied | Preserved stable envelope/error shapes and documented conflict/unavailable states. |
| auth-implementation-patterns | Applied | Reviewed authenticated organization, person, role and supplier context. |
| ci-cd-and-automation | Applied | Extended existing consistency and database gates instead of creating a parallel pipeline. |
| code-review | Applied | Evidence-based inspection of active code and migrations from the verified baseline. |
| code-review-and-quality | Applied | Classified findings by severity and separated fixes from open debt. |
| code-simplifier | Applied | Replaced repetitive role seed statements and duplicate label maps with canonical sources. |
| debugging-and-error-recovery | Applied | Traced the successful-write/failed-receipt path through API and PostgreSQL state transitions. |
| deployment-pipeline-design | Reviewed/no change | Existing branch/PR/CI path retained; production deployment remains gated. |
| documentation-and-adrs | Applied | Added this audit, OpenAPI changes and updated project memory. |
| doubt-driven-development | Applied | Corrected an early stale stack assumption and verified active files before findings. |
| e2e-testing-patterns | Conditional | Existing smoke suite retained; full role/provider flows require staging. |
| error-handling-patterns | Applied | Split retryable execution errors from uncertain completion outcomes. |
| find-bugs | Applied | Found seed drift, audience drift, branding drift and idempotency double-write risk. |
| incremental-implementation | Applied | Changes are isolated, typed and protected by focused tests. |
| nextjs-app-router-patterns | Applied | Preserved server route handlers, portal components and Next response handling. |
| nodejs-backend-patterns | Applied | Reviewed request wrappers, timeout/error handling and server-only Supabase usage. |
| observability-and-instrumentation | Applied | Preserved request/correlation IDs and added structured reconciliation error logs. |
| openapi-spec-generation | Applied | Bumped OpenAPI contract and documented idempotency 409/503 behavior. |
| performance-optimization | Reviewed/no change | No justified query/render performance regression was introduced by the fixes. |
| quality-playbook | Applied | Used layered static, unit, DB, RLS, build and external acceptance gates. |
| refactor | Applied | Centralized status labels and simplified seed logic without changing unrelated domains. |
| sast-configuration | Reviewed/no change | Existing CodeQL/dependency/secret controls retained; no workflow weakening. |
| secrets-management | Applied | Removed misleading non-secret e-mail variables; no secrets added to source. |
| security-and-hardening | Applied | Hardened service-role-only idempotency functions and retry behavior. |
| security-threat-model | Applied | Considered tenant crossing, API-key abuse, replay/double write and provider-failure boundaries. |
| skill-scanner | Reviewed/no change | Verified the locked project skill inventory before routing. |
| source-driven-development | Applied | Active source/tests/migrations were treated as evidence; old archive assumptions were rejected. |
| sql-optimization-patterns | Applied | Used set-based seed upserts, exact permission cleanup and catalog checks. |
| supabase | Applied | Reviewed migration order, seed order, RPC grants, RLS/Storage gates and reset behavior. |
| supabase-postgres-best-practices | Applied | Added explicit search paths, least-privilege grants, idempotent DDL and catalog verification. |
| test-driven-development | Applied | Added regression tests alongside each confirmed consistency fix. |
| threat-model-analyst | Applied | Classified uncertain write outcomes as a duplicate-operation threat. |
| vercel-react-best-practices | Reviewed/no change | Shared status rendering remains server-compatible and avoids unnecessary client state. |
| web-design-guidelines | Applied | Audience wording is now correct and consistent in staff and tenant interfaces. |

## Release decision

Source remediation is suitable for review through a draft pull request. Merge
and production release should remain blocked until CI is green and the external
Supabase, Storage, Resend and browser acceptance gates are completed.
