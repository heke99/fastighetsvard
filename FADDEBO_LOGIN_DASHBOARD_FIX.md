# FaddeBo – login- och dashboardreparation

Den här leveransen utgår enbart från projektets egen migrationskedja i `supabase/migrations`.

## Produktionsfel som repareras

- PostgreSQL `42883` i `admin_dashboard_metrics` berodde på att flera canonical RPC-funktioner anropade `public.assert_service_role()` utan att migrationskedjan definierade funktionen.
- PostgreSQL `23502` i `record_current_login` kom från audit-insertens beroende av ett driftat/äldre `AuditEvent`-schema. En giltig Supabase-session ska inte göras obrukbar av en sekundär auditlogg.

## Canonical migration

Kör endast:

`supabase/migrations/20260804113000_login_dashboard_repair.sql`

Migrationen:

1. skapar `public.assert_service_role()`;
2. återskapar `record_current_login()` med explicit canonical auditdata och feltålig audit-insert;
3. återskapar `admin_dashboard_metrics()` efter att service-role-hjälparen finns;
4. återställer korrekta grants.

## Dashboardrouting

- `superadmin`, `org-admin`, `property-manager` och övrig personal går till `/admin`.
- sökande och hyresgäster går till `/mina-sidor`;
- hyresgästens vy avgörs av `PersonRole` = `TENANT` eller `CO_TENANT`;
- sökande utan hyresgästrelation ser ansökningar, favoriter och bevakningar;
- entreprenörer går till `/entreprenor`.

## Lokal verifiering

```bash
npm run verify:accounts
npm run verify:login-dashboard
npm run typecheck
npm test
npm run build
```

Databasverifiering när `SUPABASE_DB_URL` finns:

```bash
npm run db:verify
```
