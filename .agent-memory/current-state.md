# Current State

Last updated: 2026-08-06 Europe/Stockholm  
Verified baseline: `main` at `d9c7cfe5c78272f76af5ace23dee0c647c66d489`  
Current branch: `codex/system-consistency-audit-2026-08-06`  
Current phase: full-system consistency and API idempotency hardening  
Current task: review the draft PR, obtain green CI and execute staging acceptance

## Production status

Not production-verified. The repository source has been reviewed from the
verified GitHub baseline and confirmed consistency defects have been remediated,
but the branch still requires CI and approved Supabase/Vercel staging evidence.

## Current source changes

Implemented on the audit branch:

- canonical, idempotent role seed catalogue with exact role metadata and
  permission cleanup;
- database verification of all 13 canonical system roles;
- one typed maintenance-status label source with explicit staff and tenant
  audiences, reused by portal badges and status e-mail;
- canonical branding fallbacks aligned with `.env.example`, with misleading
  ignored e-mail variables removed;
- API idempotency outcome hardening: successful domain writes with an uncertain
  response receipt are marked `UNCERTAIN` and blocked from automatic replay;
- OpenAPI `1.0.1` documentation for idempotency 409/503 outcomes;
- new unit and PostgreSQL verification for status labels, branding and
  idempotency behavior;
- full audit and 36-skill routing matrix in
  `docs/SYSTEM_CONSISTENCY_AUDIT_2026-08-06.md`.

## Verification state

SOURCE REVIEWED:

- role, organization and supplier context paths;
- applicant/tenant, staff and contractor portal routing;
- maintenance persistence, attachment and notification flow;
- API authentication, rate limiting, idempotency and OpenAPI contract;
- seed/migration ordering, function grants and database verification scripts;
- CI, dependency, secret and deployment gates.

PENDING ON THE BRANCH:

- GitHub Actions lint, consistency checks, typecheck, unit tests and build;
- local Supabase reset, schema/idempotency verification and negative RLS tests;
- E2E smoke workflow.

EXTERNAL RUNTIME EVIDENCE STILL REQUIRED:

- hosted Supabase migration application and upgrade path;
- private Storage upload/download policies;
- real Resend/Auth SMTP delivery and callback URLs;
- browser acceptance for staff roles, tenant maintenance, listing media,
  invitations, password reset, webhook/accounting flows and deployment smoke.

## Database status

The ordered source chain now contains 37 forward migrations. The latest is:

```text
supabase/migrations/20260806143000_idempotency_outcome_hardening.sql
```

It adds the `UNCERTAIN` idempotency state, blocks automatic replay of an
uncertain successful write and installs a service-role-only reconciliation
function. It has not yet been proven against the target hosted database.

## Known open technical debt

`src/lib/database-types.ts` remains a permissive compatibility layer containing
`Record<string, any>` and `any` payload aliases. A dedicated follow-up should
generate Supabase TypeScript types and migrate repositories incrementally.

## Exact resume point

After the draft PR is open, inspect GitHub Actions. In an approved clone/staging
environment run:

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

Then complete the provider and browser acceptance matrix described in the audit
report before merge or production release.
