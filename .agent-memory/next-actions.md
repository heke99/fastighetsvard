# Next Actions

## TASK-0001

Priority: P0  
Status: COMPLETE IN SOURCE; HOSTED VERIFICATION PENDING  
Goal: keep FaddeBo brand, legal organization and contact identity canonical.  
Completed: model, migrations, seed, copy, configuration, e-mail-domain lock and
automated assertions. The 2026-08-06 audit aligned fallback values and removed
ignored e-mail environment variables.  
Next exact step: execute all 37 migrations and account/e-mail acceptance in
approved Supabase/Vercel staging.

## TASK-0002

Priority: P0  
Status: COMPLETE IN SOURCE; DATABASE VERIFICATION PENDING  
Goal: keep multi-row domain changes atomic and safely idempotent.  
Completed: locking RPC commands plus the `UNCERTAIN` API idempotency outcome for
successful writes whose response receipt cannot be confirmed.  
Next exact step: run database verification and force a completion-response
failure to confirm that the same key is blocked without re-executing the domain
write.

## TASK-0003

Priority: P0  
Status: COMPLETE IN SOURCE; REGRESSION PENDING  
Goal: use scoped repositories instead of legacy full-table adapters.  
Completed: active public, portal, auth, admin, API and integration callers use
scoped repositories or RPCs.  
Next exact step: obtain green CI and execute negative cross-organization tests.

## TASK-0004

Priority: P0  
Status: PENDING CI / APPROVED DATABASE  
Goal: prove the current 37-migration chain and authorization boundaries.  
Exact commands: `supabase db reset`, `npm run db:verify`, `npm run test:rls`,
`npm run test:concurrency`.  
Acceptance: clean install and upgrade, canonical roles, uncertain idempotency,
function grants, negative tenant access, private Storage paths and concurrency
invariants all pass.

## TASK-0005

Priority: P0  
Status: BLOCKED BY TASK-0004 AND EXTERNAL PROVIDERS  
Goal: run browser and provider release gates.  
Scope: registration, staff invitation, password reset, application,
offer/reservation, signing/activation, tenant maintenance, listing media,
notice/move-out, webhook/outbox, accounting provider and deployment smoke.

## TASK-0006

Priority: P0  
Status: COMPLETE IN SOURCE; RUNTIME VERIFICATION PENDING  
Goal: maintain owner, staff, applicant, tenant and contractor account routing.  
Completed: centralized role routing, exact role display, owner bootstrap,
staff password setup, confirmation/reset flows and role-aware navigation.  
Next exact step: execute role-specific browser acceptance in staging.

## TASK-0007

Priority: P0  
Status: COMPLETE IN SOURCE; CI/RUNTIME VERIFICATION PENDING  
Goal: keep roles, tenant/person views, listing media and maintenance consistent.  
Completed: canonical seed roles, protected custom roles, co-tenant unit views,
listing media, maintenance attachments/e-mail, one audience-aware status label
source and expanded consistency checks.  
Next exact step: review the draft PR, require green CI and execute the acceptance
matrix in `docs/SYSTEM_CONSISTENCY_AUDIT_2026-08-06.md`.

## TASK-0008

Priority: P1  
Status: OPEN — SEPARATE PR  
Goal: replace permissive database compatibility types with generated Supabase
TypeScript types.  
Exact steps: generate types from the canonical schema, type all Supabase clients,
migrate repositories by domain, remove `Record<string, any>` aliases and add a
CI regeneration-diff check.  
Acceptance: column/relation drift fails typecheck before deployment.
