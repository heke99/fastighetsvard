# Completed Work

## 2026-07-25 — Baseline and FaddeBo identity

STATICALLY VERIFIED: FaddeBo brand/legal-entity separation, migration backfill,
configuration, seed/bootstrap, customer copy and automated brand assertions.

## 2026-07-25 — Canonical data access

SOURCE VERIFIED:

- replaced the generic full-table adapter with 17 scoped repository modules;
- moved multi-row administrative, portal, staff, tenant and integration writes
  to locking/idempotent PostgreSQL RPC commands;
- added forward migrations for catalog reads, maintenance, portal operations,
  provisioning, payment/customer/tenant imports, metrics, invitations,
  webhook delivery and external invoices;
- deleted `src/lib/db.ts`, `src/lib/database-schema.json` and
  `src/lib/counters.ts`;
- added regression guards against adapter imports, fake transactions and
  wildcard projections.

## 2026-07-25 — Final source verification

VERIFIED on Node 24.14.0/npm 11.9.0:

- lint passed for 29 canonical migrations;
- TypeScript typecheck passed;
- 40 of 40 Vitest tests passed;
- Next.js 15.5.20 production build passed;
- concurrency primitives passed static inspection.

NOT RUN: database migrations, DB integration, RLS, Storage, real parallel
transactions, E2E, providers or deployment.

## 2026-08-03 — Account and FaddeBo presentation hardening (source/static)

- centralized owner, staff and applicant dashboard routing;
- added owner bootstrap and owner-only privileged role assignment;
- changed staff creation to self-selected password via activation e-mail;
- added signup confirmation resend and confirmed-password recovery form;
- separated applicant and tenant portal navigation/dashboard content;
- aligned support/privacy/leasing to `info@faddebo.se` and fault reporting to
  `felanmalan@faddebo.se`;
- installed supplied FaddeBo logo assets and updated shared identity/icons;
- removed public Till salu/Parkeringar navigation and added redirects;
- added exact requested homepage copy, migration, tests and setup guide;
- static lint passed for 30 migrations and bootstrap script parsed successfully.

Runtime Auth/e-mail/database verification remains open and is not counted as
completed.

## 2026-08-04 — Roles, tenants, listing media and fault reports (source/static)

- synchronized 13 system-role names, descriptions and exact permissions between
  TypeScript and PostgreSQL;
- exposed exact personal/staff roles in the admin header, user catalog and
  person/tenant catalog, including inactive portal-account status;
- made organization-specific custom roles first-class staff roles, required an active same-organization actor with `roles:create`, and blocked non-superadmins from creating wildcard roles in both app and database;
- organization-scoped role/person data returned by `current_user_context()` and filtered in person-list role hydration;
- permission-gated tenant import, registration and invitation controls;
- displayed primary and co-tenants on units from active contracts;
- added canonical apartment/listing image and floorplan upload through
  `listing-media` Storage and `UnitMedia`;
- completed tenant-to-staff fault-report flow with private attachments, portal
  visibility, shared fault-report e-mail, tenant receipt/status e-mail and
  post-commit failure isolation;
- added a 27-check consistency verifier and extended CI wiring/tests.

Executed static gates passed. Dependency-backed typecheck, Vitest, build,
database, RLS, Storage and provider checks remain pending and are not claimed.
