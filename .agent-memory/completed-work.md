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
