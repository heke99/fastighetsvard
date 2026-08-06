# Current State

Last updated: 2026-08-06 Europe/Stockholm  
Last verified source commit: `806890e4732d1fd03cf088f2b977a14058d75b9f`  
Current branch: `fix/revoke-anon-function-grants`  
Current phase: acute function-ACL remediation  
Current task: review and stage the function grant migration; do not apply it to production

## Production status

Production was not changed. The source remediation for `FASTIGHET-001`,
`FASTIGHET-002`, `FASTIGHET-004` and `FASTIGHET-008` is prepared as one
forward-only migration. Runtime verification is blocked by `FASTIGHET-003`
because the live migration ledger is not trustworthy, and the connected
Supabase account does not have access to project `dmigdfbvudzexvdnbvrj`.

## Current source status

The remediation:

- revokes function execution from `PUBLIC`, `anon` and `authenticated` by exact
  catalog identity, covering every overload;
- restores exactly 28 authenticated portal/JWT RPC signatures;
- grants the remaining public function surface to `service_role`;
- changes `write_audit_event(...)` and `enqueue_outbox_event(...)` to
  `SECURITY INVOKER` with an internal service-role/function-owner guard;
- rejects NULL or mismatched actors and organizations in
  `claim_idempotent_operation(...)`;
- locks future default function privileges;
- adds structural lint and SQL regression tests;
- documents the verified RPC grant matrix.

## Database status

The ordered source chain contains 37 forward migrations after this remediation.
The latest source migration is:

```text
supabase/migrations/20260806190000_lock_function_grants.sql
```

It has not been applied to staging or production.

## Verification status

Source-only checks completed:

- migration transaction, function signatures and dollar-quote structure reviewed;
- `node --check scripts/verify-function-grants.mjs` passed;
- package scripts remain dependency-neutral;
- the GitHub diff is restricted to one migration, grant tests, lint wiring and
  remediation documentation.

Blocked until an approved local or staging database is available:

- `npm ci` and the full npm verification gate;
- `npm run db:verify`;
- `npm run test:rls`;
- runtime portal acceptance tests;
- Supabase security/performance advisors after migration application.

## Exact resume point

After resolving `FASTIGHET-003`, use an isolated staging environment and run:

```bash
npm ci
npm run lint
npm run verify:accounts
npm run verify:login-dashboard
npm run verify:consistency
npm run typecheck
npm run test:unit
npm run build
npm run db:verify
npm run test:rls
```

Then verify tenant application, offer acceptance/decline, viewing
booking/cancellation, current-user context, service-role administration, and
rejection of forged audit/outbox events and NULL-actor idempotency calls.
Production migration remains a separate, explicitly approved operation.
