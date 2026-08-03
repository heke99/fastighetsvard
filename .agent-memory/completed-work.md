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
