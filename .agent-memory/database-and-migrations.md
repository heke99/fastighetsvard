# Database and Migrations

Current source state:

- 40 ordered forward SQL migrations, `20260720000100`–`20260814095000`, samtliga
  applicerade i `dmigdfbvudzexvdnbvrj` och registrerade i
  `supabase_migrations.schema_migrations`;
- least-privilege-grants: `anon` har enbart SELECT på de fyra katalogvyerna,
  `authenticated` har EXECUTE på 27 namngivna funktioner och de skrivningar som
  har RLS-policy. `ALTER DEFAULT PRIVILEGES` hindrar att nya objekt ärver
  Supabases standardrättigheter – nya migrationer måste därför ge grants
  explicit;
- BEFORE DELETE-triggers hindrar radering av avtal som lämnat `DRAFT`, även via
  kaskad från fastighet eller objekt;
- `Note` är canonical för interna anteckningar, `UnitMedia."storageKey"` är
  canonical för filens plats i `listing-media`;
- core schema, Auth/RBAC, RLS/Storage, rate limiting and canonical command RPCs;
- direct, organization-scoped repositories with explicit projections;
- RPCs for application/offer/signing/contract, maintenance, portal, staff,
  tenant/customer/payment imports, provisioning, invitation, webhook delivery
  and external-invoice persistence;
- private Storage paths use organization/person segments.

Never edit an installed migration. Add a timestamped forward migration.
Function return-type changes may require an explicit `DROP FUNCTION` with the
full old signature before recreation.

Known risks:

- the supplied archive cannot prove which migrations are applied remotely;
- no local Docker/PostgreSQL is available in this environment;
- recent SQL has passed static checks but has not been parsed or executed by
  PostgreSQL;
- parent-derived RLS must be tested whenever a child lacks `organizationId`;
- atomicity and SKIP LOCKED behavior require true parallel runtime tests.

Preflight/verification:

- `supabase/manual/20260724_preflight_backfill_report.sql`
- `supabase/tests/verify_schema.sql`
- `supabase/tests/verify_rls.sql`
