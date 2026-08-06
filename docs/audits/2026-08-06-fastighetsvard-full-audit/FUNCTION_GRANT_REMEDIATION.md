# Function grant remediation — FASTIGHET-001/002/004/008

Date: 2026-08-06  
Branch: `fix/revoke-anon-function-grants`  
Start commit: `806890e4732d1fd03cf088f2b977a14058d75b9f`

## Scope

This change only remediates:

- `FASTIGHET-001` — unauthenticated writes to `AuditEvent`
- `FASTIGHET-002` — unauthenticated writes to `OutboxEvent`
- `FASTIGHET-004` — role-specific function grants survive `REVOKE ... FROM PUBLIC`
- `FASTIGHET-008` — a NULL actor can pass the idempotency identity guard

No UI, storage, outbox consumer, role routing, migration-ledger repair, or unrelated
audit finding is changed.

## Root cause

PostgreSQL grants function execution to `PUBLIC` by default. Supabase also uses the
explicit database roles `anon`, `authenticated`, and `service_role`. Several
historical migrations only revoked `PUBLIC`, so explicit grants held by `anon`
and `authenticated` remained effective.

`write_audit_event(...)` and `enqueue_outbox_event(...)` were `SECURITY DEFINER`
without an internal caller guard. `claim_idempotent_operation(...)` compared a
nullable supplied actor with two nullable current-actor helpers; three NULL
values could therefore avoid the mismatch branch.

## Privileged function matrix

| Function | Exact PostgreSQL signature | Before | After | Internal caller model |
| --- | --- | --- | --- | --- |
| `write_audit_event` | `(text,text,text,text,jsonb,jsonb,text,text,text)` | `SECURITY DEFINER`; effective `anon`/`authenticated` execution possible | `SECURITY INVOKER`; direct `EXECUTE` only for `service_role` | Trusted domain `SECURITY DEFINER` functions execute it with the parent function owner's privileges |
| `enqueue_outbox_event` | `(text,text,text,text,text,jsonb,text)` | `SECURITY DEFINER`; effective `anon`/`authenticated` execution possible | `SECURITY INVOKER`; direct `EXECUTE` only for `service_role` | Trusted domain `SECURITY DEFINER` functions execute it with the parent function owner's privileges |
| `claim_outbox_jobs` | `(text,integer,integer)` | Body guard existed, but ACL drift could expose the entry point | `SECURITY DEFINER`; direct `EXECUTE` only for `service_role` | Outbox worker/service client |
| `claim_idempotent_operation` | `(text,text,text,text,text,text,integer)` | Service-only intent; NULL actor bypass in body | Direct `EXECUTE` only for `service_role`; non-service contexts require a typed non-NULL actor and matching organization | Trusted domain RPCs call it internally; service operations may call it directly |
| `complete_idempotent_operation` | `(text,integer,jsonb)` | Service-only intent | Direct `EXECUTE` only for `service_role` | Trusted domain RPCs and service operations |
| `fail_idempotent_operation` | `(text,text)` | Service-only intent | Direct `EXECUTE` only for `service_role` | Trusted domain RPCs and service operations |

All overloads of public `SECURITY DEFINER` functions are enumerated through
`pg_proc` as `regprocedure` and lose `PUBLIC`, `anon`, and `authenticated`
execution. The migration then restores exactly 35 authenticated signatures from
the verified RLS-helper and portal-command allow-list. The six service-only
function families are re-granted only to `service_role`.

The anonymous `SECURITY DEFINER` allow-list is intentionally empty. No
authenticated `SECURITY DEFINER` function may exist outside the explicit
35-signature allow-list.

## Authenticated RPC inventory retained

The migration deliberately revokes `authenticated` from every public
`SECURITY DEFINER` overload, then re-grants only the verified 35-signature
allow-list. The following actual user-scoped calls are included and asserted in
`supabase/tests/verify_rls.sql`.

| Function | Exact signature | Source caller | Client |
| --- | --- | --- | --- |
| `current_user_context` | `()` | `src/lib/repositories/auth-context.ts` | request-scoped server client |
| `record_current_login` | `(text)` | `src/lib/repositories/auth-context.ts` | request-scoped server client |
| `toggle_favorite` | `(text)` | `src/lib/repositories/portal-records.ts` | request-scoped server client |
| `current_person_contract_catalog` | `(text,public."ContractStatus"[],public."ContractPartyRole"[])` | `src/lib/repositories/portal-records.ts` | request-scoped server client |
| `current_person_application_catalog` | `(public."ApplicationStatus"[],integer)` | `src/lib/repositories/portal-records.ts` | request-scoped server client |
| `current_person_upcoming_viewings` | `(integer)` | `src/lib/repositories/portal-records.ts` | request-scoped server client |
| `submit_rental_application` | `(text,text,jsonb,text,text)` | `src/lib/repositories/rental-operations.ts` | request-scoped server client |
| `send_rental_offer` | `(text,timestamp,integer)` | `src/lib/repositories/rental-operations.ts` | request-scoped server client |
| `accept_rental_offer` | `(text,text,timestamp,text,text)` | `src/lib/repositories/rental-operations.ts` | request-scoped server client |
| `decline_rental_offer` | `(text,text,text,text)` | `src/lib/repositories/rental-operations.ts` | request-scoped server client |
| `request_contract_termination` | `(text,text,timestamp,text,boolean,text,text,text)` | `src/lib/repositories/rental-operations.ts` | request-scoped server client |
| `verify_signing_challenge` | `(text,text,text,text,text)` | `src/lib/repositories/rental-operations.ts` | request-scoped server client |
| `change_application_status` | `(text,public."ApplicationStatus",public."ApplicationStatus",text)` | `src/lib/repositories/rental-operations.ts` | request-scoped server client with SQL permission guard |
| `change_listing_status` | `(text,public."ListingStatus",public."ListingStatus")` | `src/lib/repositories/rental-operations.ts` | request-scoped server client with SQL permission guard |
| `complete_unit_listings` | `(text,text)` | `src/lib/repositories/rental-operations.ts` | request-scoped server client with SQL permission guard |
| `change_contract_status` | `(text,public."ContractStatus",public."ContractStatus",text)` | `src/lib/repositories/rental-operations.ts` | request-scoped server client with SQL permission guard |
| `create_contract_version` | `(text,jsonb,text,integer)` | `src/lib/repositories/rental-operations.ts` | request-scoped server client with SQL permission guard |
| `activate_signed_contract` | `(text,text,text)` | `src/lib/repositories/rental-operations.ts` | request-scoped server client with SQL permission guard |

The complete authenticated allow-list also preserves the RLS identity helpers
`current_app_organization_id()`, `current_app_person_id()`,
`current_app_user_id()`, and `app_has_permission(text)`, plus the canonical
portal commands needed for application withdrawal, viewing booking/cancellation,
contract signing, termination cancellation/confirmation, internal transfer,
move-in, and move-out. These signatures are restored explicitly:

- `withdraw_rental_application(text,text,text)`
- `create_viewing_booking(text,text,text)`
- `cancel_viewing_booking(text,text)`
- `record_contract_signature(text,text,text,text,text,text,text,jsonb)`
- `cancel_contract_termination(text,text)`
- `complete_internal_transfer(text,text,text,timestamp)`
- `create_signing_session(text,text,timestamp)`
- `countersign_contract(text,text,text,text,text,jsonb)`
- `confirm_contract_termination(text,integer,text)`
- `complete_move_in(text,jsonb,integer)`
- `complete_move_out(text,jsonb,public."UnitStatus")`
- `current_active_tenancy_summary()`
- `current_person_has_active_application(text)`

Every restored signature is also granted to `service_role` so trusted server
flows keep the same execution capability.

## Service-role RPC callers inventoried

Static wrappers using `createAdminClient()` include:

- `create_signing_challenge`
- `claim_invitation`
- `provision_supplier`
- `create_custom_role`
- `provision_staff_user`
- `create_maintenance_request`
- `change_maintenance_status`
- `create_work_order`
- `change_work_order_status`
- `apply_external_payment`
- `register_existing_tenant`

These calls do not justify an `authenticated` grant. The security migration does
not add one.

No Supabase Edge Functions exist in the repository. SQL-to-SQL calls to
`write_audit_event`, `enqueue_outbox_event`, and the idempotency helpers remain
valid through trusted owner execution.

## Static and database regression controls

`scripts/verify-function-grants.mjs` is part of `npm run lint` and rejects, from
this migration forward:

- a `PUBLIC` revoke that omits both Supabase application roles
- any function `EXECUTE` grant to `anon`
- an `authenticated` grant outside the complete 35-function allow-list
- an `authenticated` grant to the service-only function set
- a new `SECURITY DEFINER` function without a locked `search_path`
- a new `SECURITY DEFINER` function without a verifiable anonymous revoke
- removal of the default-privilege hardening or NULL-actor guard

`supabase/tests/verify_rls.sql` verifies role ACLs, every overload in the
service-only families, the empty anonymous `SECURITY DEFINER` set, retained
portal grants, writer security mode, and the NULL-actor failure contract.

## Runtime verification blocker

The audit was performed against Supabase project ref
`dmigdfbvudzexvdnbvrj`. That project is not exposed by the currently connected
Supabase integration. The accessible project named Bovaro has a different
schema and is not a valid substitute.

In addition, `FASTIGHET-003` states that the target live database lacks a
verifiable migration ledger. Therefore:

- the migration has not been applied to production
- no write or attack simulation has been run against production
- `db:push`, migration repair, and linked reset were not run
- database/runtime assertions remain blocked until a disposable local/staging
  database is built from the canonical migration chain and the production
  ledger is repaired separately

## Rollback

Before production application, rollback is simply to close the PR.

After a controlled application, rollback requires a new forward migration. It
must restore only grants proven necessary by the source caller matrix. Reverting
the two writer functions to `SECURITY DEFINER` or restoring `anon` execution is
not an acceptable rollback.
