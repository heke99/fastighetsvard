# Next Actions

## TASK-0001

Priority: P0  
Status: COMPLETE (source/static)  
Goal: separate FaddeBo brand from the legal organization.  
Completed: model, forward migration, RLS/grants, seed/bootstrap, copy,
configuration and automated assertions.  
Next exact step: execute migration `20260725010000_faddebo_brand.sql` as part
of the full chain in a real Supabase test database.

## TASK-0002

Priority: P0  
Status: COMPLETE (source/static)  
Goal: replace multi-row fake transactions with locking RPC commands.  
Completed: application, listing, contract, maintenance, portal, staff,
payment, tenant, customer, supplier, invitation, webhook and invoice commands.  
Next exact step: run rollback/idempotency and real parallel PostgreSQL tests.

## TASK-0003

Priority: P0  
Status: COMPLETE (source/static)  
Goal: remove the full-table legacy query adapter.  
Completed: all public, portal, auth, admin, API and integration callers now use
scoped repositories; adapter, generated schema and counter shim were deleted.  
Acceptance evidence: no source `@/lib/db`, `db.$transaction` or `select("*")`;
lint/typecheck/40 tests/build pass.

## TASK-0004

Priority: P0  
Status: BLOCKED — DATABASE REQUIRED  
Goal: prove the 29-migration chain and authorization boundaries at runtime.  
Exact commands: `supabase start`, `npm run db:reset`, `npm run db:verify`,
`npm run test:rls`, then real parallel transaction tests.  
Acceptance: clean install and upgrade, function signatures, negative
cross-organization access, private Storage paths and concurrency invariants
all pass.

## TASK-0005

Priority: P0  
Status: BLOCKED BY TASK-0004  
Goal: run browser and provider release gates.  
Scope: registration, application, offer/reservation, signing/activation,
portal, notice/move-out, inbound/outbound webhook, outbox worker, accounting
provider and deployment smoke tests.
