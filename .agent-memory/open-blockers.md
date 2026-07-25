# Open Blockers

## BLOCKER-0001

Severity: P0  
Status: RESOLVED AND VERIFIED IN SOURCE  
Affected flow: legacy reads and administrative/integration writes  
Resolution: all callers use scoped repositories or atomic PostgreSQL RPC
commands; `src/lib/db.ts`, its generated schema metadata and counter shim were
deleted.  
Evidence: lint guard, 40 passing tests, typecheck and production build.  
Remaining gate: exercise the replacement queries/functions against PostgreSQL.

## BLOCKER-0002

Severity: P0  
Status: RESOLVED IN SOURCE; DATABASE VERIFICATION PENDING  
Affected flow: all customer-facing and legal surfaces  
Resolution: Brand model, FaddeBo configuration/copy, preserved legal identity,
seed/bootstrap and automated assertions were added.  
Remaining gate: execute and verify the forward migration against Supabase.

## BLOCKER-0003

Severity: P0  
Status: BLOCKED  
Affected flow: DB/RLS/Storage/concurrency production gate  
Problem: no Docker/PostgreSQL or approved remote DB credentials.  
Evidence: Docker is unavailable and no test/staging connection was provided.  
Required resolution: execute migrations and SQL suites in test/staging.  
Acceptance criteria: fresh install and upgrade pass; negative RLS/Storage and
true parallel tests pass.  
Dependencies: external test database.

## BLOCKER-0004

Severity: P0  
Status: BLOCKED  
Affected flow: release traceability and deployment  
Problem: the supplied archive has no `.git`, remote, branch or commit.  
Required resolution: apply this source to the canonical clone, inspect its Git
identity, review the diff, commit and deploy through the approved pipeline.
