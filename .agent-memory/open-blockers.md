# Open Blockers

## BLOCKER-0001

Severity: P0  
Status: RESOLVED IN SOURCE; RUNTIME REGRESSION PENDING  
Affected flow: scoped reads and administrative/integration writes  
Resolution: active callers use organization-scoped repositories or PostgreSQL
RPC commands; the legacy adapter remains removed.  
Remaining gate: green CI plus PostgreSQL/RLS/runtime regression.

## BLOCKER-0002

Severity: P0  
Status: RESOLVED IN SOURCE; HOSTED DATABASE VERIFICATION PENDING  
Affected flow: brand, legal identity and system roles  
Resolution: FaddeBo branding, legal identity, role catalogue, seed and database
assertions are canonical. The 2026-08-06 audit also removed seed role drift and
misleading branding environment variables.  
Remaining gate: apply and verify all 37 migrations in approved Supabase staging.

## BLOCKER-0003

Severity: P0  
Status: BLOCKED — APPROVED RUNTIME REQUIRED  
Affected flow: DB/RLS/Storage/concurrency production gate  
Problem: repository inspection cannot prove hosted migration state, negative
cross-organization access, private Storage paths or real concurrency behavior.  
Required resolution: run fresh reset, upgrade, `db:verify`, negative RLS/Storage
and true parallel tests in CI and approved staging.  
Acceptance criteria: all database gates pass without policy or ownership drift.

## BLOCKER-0004

Severity: P0  
Status: RESOLVED  
Affected flow: release traceability and deployment  
Resolution: canonical repository is verified as `heke99/fastighetsvard`; the
audit baseline is `main` commit `d9c7cfe5c78272f76af5ace23dee0c647c66d489`
and remediation is isolated on `codex/system-consistency-audit-2026-08-06`.

## BLOCKER-0005

Severity: P0  
Status: BLOCKED — EXTERNAL AUTH/E-MAIL CONFIGURATION REQUIRED  
Affected flow: registration confirmation, staff activation, password reset and
maintenance notifications  
Problem: Supabase Site URL/redirects, custom SMTP, Resend DNS/API credentials
and actual delivery cannot be proven from source.  
Required resolution: configure approved staging and execute account/e-mail
acceptance with valid, expired and reused links.

## BLOCKER-0006

Severity: P0  
Status: SOURCE REMEDIATED; CI AND RUNTIME ACCEPTANCE PENDING  
Affected flow: staff roles, tenant/person views, listing media, maintenance and
external API writes  
Resolution: exact role seed, audience-aware status labels, canonical branding
and uncertain idempotency outcomes are implemented with regression gates.  
Acceptance criteria: draft PR CI is green; hosted migration succeeds; tenant
submission appears in both portals; private attachments and public listing
media work; e-mail/webhooks are delivered; uncertain idempotent writes do not
create duplicate records.

## BLOCKER-0007

Severity: P1  
Status: OPEN — DEDICATED FOLLOW-UP REQUIRED  
Affected flow: compile-time database/schema consistency  
Problem: `src/lib/database-types.ts` contains broad `Record<string, any>` and
`any` payload aliases, so TypeScript cannot detect all Supabase column or
relation drift.  
Required resolution: generate canonical Supabase TypeScript types, type all
clients and migrate repositories incrementally with a CI regeneration-diff
check.  
Dependency: approved schema access and a separate, reviewable PR.
