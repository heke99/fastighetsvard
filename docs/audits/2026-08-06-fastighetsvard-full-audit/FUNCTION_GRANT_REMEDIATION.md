# Function grant matrix

Date: 2026-08-06  
Branch: `fix/revoke-anon-function-grants`  
Findings: `FASTIGHET-001`, `FASTIGHET-002`, `FASTIGHET-004`, `FASTIGHET-008`

## Resulting policy

- `anon`: no `EXECUTE` on functions in `public`.
- `authenticated`: only the 28 exact signatures in the authenticated table.
- `service_role`: `EXECUTE` on the complete `public` function surface.
- Function owners retain PostgreSQL owner privileges, preserving trusted calls between database functions after the catalog-wide revoke.
- Every overload is handled through `pg_get_function_identity_arguments()`.
- Runtime application is blocked by `FASTIGHET-003`; the migration has not been applied to production.

`SECURITY DEFINER` below describes the function mode after this migration. The two sensitive write helpers are deliberately changed to `SECURITY INVOKER` and protected by an internal service-role/function-owner guard.

## Authenticated allow-list — 28 exact signatures

| Funktion och signatur | SECURITY DEFINER | Faktisk anropare | Klienttyp | Tillåten roll | Motivering |
|---|---:|---|---|---|---|
| `public.current_app_organization_id()` | Ja | RLS och intern SQL | JWT-kontext | authenticated | Organisationsbunden RLS. |
| `public.current_app_person_id()` | Ja | RLS och domän-RPC | JWT-kontext | authenticated | Person- och aktörskontroll. |
| `public.current_app_user_id()` | Ja | RLS och domän-RPC | JWT-kontext | authenticated | App user och audit-attribution. |
| `public.app_has_permission(text)` | Ja | RLS och privilegierade domän-RPC | JWT-kontext | authenticated | Behörighetskontroll för inloggad användare. |
| `public.current_user_context()` | Ja | `src/lib/repositories/auth-context.ts` | authenticated server client | authenticated | Login/dashboard behöver aktuell app-kontext. |
| `public.record_current_login(text)` | Ja | `src/lib/repositories/auth-context.ts` | authenticated server client | authenticated | Registrerar den inloggade användarens login. |
| `public.current_active_tenancy_summary()` | Ja | `src/lib/repositories/public-catalog.ts` | authenticated server client | authenticated | Portalens boendesammanfattning. |
| `public.current_person_has_active_application(text)` | Ja | `src/lib/repositories/public-catalog.ts` | authenticated server client | authenticated | Personbunden ansökningskontroll. |
| `public.current_person_contract_catalog(text,public."ContractStatus"[],public."ContractPartyRole"[])` | Ja | `src/lib/repositories/portal-records.ts` | authenticated server client | authenticated | Personens avtalskatalog. |
| `public.current_person_application_catalog(public."ApplicationStatus"[],integer)` | Ja | `src/lib/repositories/portal-records.ts` | authenticated server client | authenticated | Personens ansökningskatalog. |
| `public.current_person_upcoming_viewings(integer)` | Ja | `src/lib/repositories/portal-records.ts` | authenticated server client | authenticated | Personens visningar. |
| `public.toggle_favorite(text)` | Ja | `src/lib/repositories/portal-records.ts` | authenticated server client | authenticated | Personbunden portalmUTATION. |
| `public.submit_rental_application(text,text,jsonb,text,text)` | Ja | `src/lib/repositories/rental-operations.ts` | authenticated server client | authenticated | Ansökan verifierar person och organisation. |
| `public.withdraw_rental_application(text,text,text)` | Ja | Portalens SQL-kommandoyta | authenticated JWT | authenticated | Personbunden återkallelse. |
| `public.create_viewing_booking(text,text,text)` | Ja | Portalens SQL-kommandoyta | authenticated JWT | authenticated | Personbunden bokning. |
| `public.cancel_viewing_booking(text,text)` | Ja | Portalens SQL-kommandoyta | authenticated JWT | authenticated | Personbunden avbokning. |
| `public.send_rental_offer(text,timestamp without time zone,integer)` | Ja | `src/lib/repositories/rental-operations.ts` | authenticated server client | authenticated | Staff-flöde med intern permission guard. |
| `public.accept_rental_offer(text,text,timestamp without time zone,text,text)` | Ja | `src/lib/repositories/rental-operations.ts` | authenticated server client | authenticated | Sökande accepterar eget erbjudande. |
| `public.decline_rental_offer(text,text,text,text)` | Ja | `src/lib/repositories/rental-operations.ts` | authenticated server client | authenticated | Sökande avböjer eget erbjudande. |
| `public.request_contract_termination(text,text,timestamp without time zone,text,boolean,text,text,text)` | Ja | `src/lib/repositories/rental-operations.ts` | authenticated server client | authenticated | Avtalspart begär uppsägning. |
| `public.cancel_contract_termination(text,text)` | Ja | Portalens SQL-kommandoyta | authenticated JWT | authenticated | Avtalspart avbryter egen uppsägning. |
| `public.verify_signing_challenge(text,text,text,text,text)` | Ja | `src/lib/repositories/rental-operations.ts` | authenticated server client | authenticated | Personbunden OTP-verifiering. |
| `public.change_application_status(text,public."ApplicationStatus",public."ApplicationStatus",text)` | Ja | `src/lib/repositories/rental-operations.ts` | authenticated server client | authenticated | Staff-JWT med intern permission guard. |
| `public.change_listing_status(text,public."ListingStatus",public."ListingStatus")` | Ja | `src/lib/repositories/rental-operations.ts` | authenticated server client | authenticated | Staff-JWT med intern permission guard. |
| `public.complete_unit_listings(text,text)` | Ja | `src/lib/repositories/rental-operations.ts` | authenticated server client | authenticated | Staff-JWT med intern permission guard. |
| `public.change_contract_status(text,public."ContractStatus",public."ContractStatus",text)` | Ja | `src/lib/repositories/rental-operations.ts` | authenticated server client | authenticated | Staff-JWT med intern permission guard. |
| `public.create_contract_version(text,jsonb,text,integer)` | Ja | `src/lib/repositories/rental-operations.ts` | authenticated server client | authenticated | Staff-JWT och optimistic locking. |
| `public.activate_signed_contract(text,text,text)` | Ja | `src/lib/repositories/rental-operations.ts` | authenticated server client | authenticated | Staff-aktivering; idempotenshelpers förblir privata. |

## Service-role och trusted-internal — 33 klassificerade funktioner

| Funktion och signatur | SECURITY DEFINER | Faktisk anropare | Klienttyp | Tillåten roll | Motivering |
|---|---:|---|---|---|---|
| `public.write_audit_event(text,text,text,text,jsonb,jsonb,text,text,text)` | Nej | Domänkommandon och triggers | function owner/service-role | service_role/internal | Direkt PostgREST-anrop spärras; intern guard krävs. |
| `public.enqueue_outbox_event(text,text,text,text,text,jsonb,text)` | Nej | Domänkommandon | function owner/service-role | service_role/internal | Direkt PostgREST-anrop spärras; intern guard krävs. |
| `public.claim_outbox_jobs(text,integer,integer)` | Ja | Outbox worker | service-role client | service_role | Köclaim får inte vara användarstyrd. |
| `public.claim_idempotent_operation(text,text,text,text,text,text,integer)` | Ja | Interna domänkommandon | internal SQL/service-role | service_role/internal | Direkt RPC nekas; NULL-aktör och org mismatch nekas. |
| `public.complete_idempotent_operation(text,integer,jsonb)` | Ja | Interna domänkommandon | internal SQL/service-role | service_role/internal | Privat idempotensslutsteg. |
| `public.fail_idempotent_operation(text,text)` | Ja | Interna domänkommandon | internal SQL/service-role | service_role/internal | Privat idempotensfelsteg. |
| `public.create_signing_challenge(text,text,text,text,timestamp without time zone)` | Ja | `rental-operations.ts` | admin client | service_role | Secret-key serverflöde. |
| `public.claim_invitation(text,uuid)` | Ja | `rental-operations.ts` | admin client | service_role | Verifierad Auth-aktivering. |
| `public.provision_supplier(text,text,text,text,text,text,text,uuid,text)` | Ja | `admin-operations.ts` | admin client | service_role | Provisionerar identitet och roller. |
| `public.create_custom_role(text,text,text,text,text[])` | Ja | `admin-operations.ts` | admin client | service_role | Privilegierad rollprovisionering. |
| `public.create_maintenance_request(text,text,text,text,text,text,text,text,text,public."MaintenancePriority",timestamp without time zone,text,text,boolean,boolean,boolean,text)` | Ja | `maintenance-operations.ts` | admin client | service_role | Kanoniskt serverkommando. |
| `public.change_maintenance_status(text,text,public."MaintenanceStatus",public."MaintenanceStatus",text,text)` | Ja | `maintenance-operations.ts` | admin client | service_role | Serverstyrd statusövergång. |
| `public.create_work_order(text,text,text,text,text,text,public."MaintenancePriority",text,timestamp without time zone,text)` | Ja | `maintenance-operations.ts` | admin client | service_role | Serverstyrd arbetsorder. |
| `public.change_work_order_status(text,text,public."WorkOrderStatus",public."WorkOrderStatus",text,text,numeric,text,numeric,text,timestamp without time zone)` | Ja | `maintenance-operations.ts` | admin client | service_role | Serverstyrd arbetsorderövergång. |
| `public.provision_staff_user(uuid,text,text,text,text,text,text)` | Ja | `staff-operations.ts` | admin client | service_role | Hanterad Auth- och rollprovisionering. |
| `public.register_existing_tenant(text,text,text,text,text,text,text,text,text,text,text,timestamp without time zone,timestamp without time zone,numeric,numeric,integer,text,text,text,text,text)` | Ja | `tenant-operations.ts` | admin client | service_role | Atomisk import av befintlig hyresgäst. |
| `public.apply_external_payment(text,text,text,text,numeric,text,timestamp without time zone,text,text)` | Ja | `integration-operations.ts` | admin client | service_role | Extern betalningsintegration. |
| `public.reconcile_verified_auth_user(uuid)` | Ja | `auth-reconciliation.ts` | admin client | service_role | Server-only Auth-reparation. |
| `public.create_person_invitation(text,text,text,timestamp without time zone,text)` | Ja | `tenant-import-records.ts` | admin client | service_role | Serverstyrd inbjudan. |
| `public.record_webhook_delivery_attempt(text,integer,boolean,integer,text,timestamp without time zone)` | Ja | `webhook-records.ts` | admin client | service_role | Workeruppdatering. |
| `public.claim_webhook_deliveries(integer)` | Ja | `webhook-records.ts` | admin client | service_role | Workerclaim. |
| `public.consume_rate_limit(text,text,integer,integer)` | Ja | `src/lib/api/auth.ts` | admin client | service_role | Distribuerad server-rate-limit. |
| `public.upsert_external_customer(text,text,text,text,text,boolean,text,text,text,text,text,text)` | Ja | `external-api-records.ts` | admin client | service_role | Extern kundimport. |
| `public.queue_sync_review(text,text,text,text,text,jsonb,text)` | Ja | `integration-records.ts` | admin client | service_role | Intern granskningskö. |
| `public.persist_external_invoice(text,text,text,text,text,text,text,text,public."InvoiceStatus",jsonb,text,timestamp without time zone)` | Ja | `integration-records.ts` | admin client | service_role | Extern fakturapersistens. |
| `public.admin_dashboard_metrics(text,timestamp with time zone)` | Ja | `admin-records.ts` | admin client | service_role | Service-role-guardad statistik. |
| `public.admin_report_metrics(text,timestamp with time zone)` | Ja | `admin-records.ts` | admin client | service_role | Service-role-guardad rapportering. |
| `public.bootstrap_faddebo_owner(text,text,text)` | Ja | `scripts/bootstrap-admin.mjs` | service-role client | service_role | Engångsbootstrap. |
| `public.confirm_contract_termination(text,integer,text)` | Ja | Ingen aktuell portal-anropare | internal SQL/service-role | service_role/internal | Privat tills verifierad caller införs. |
| `public.complete_move_in(text,jsonb,integer)` | Ja | Ingen aktuell portal-anropare | internal SQL/service-role | service_role/internal | Privat tills verifierad caller införs. |
| `public.complete_move_out(text,jsonb,public."UnitStatus")` | Ja | Ingen aktuell portal-anropare | internal SQL/service-role | service_role/internal | Privat tills verifierad caller införs. |
| `public.record_contract_signature(text,text,text,text,text,text,text,jsonb)` | Ja | `verify_signing_challenge(...)` | internal SQL | service_role/internal | Ingen direkt browser/API-caller. |
| `public.assert_service_role()` | Nej | Privilegierade SQL-funktioner | internal SQL | service_role/internal | Gemensam invoker-guard. |

## Call graph and enforcement

- `write_audit_event(...)` and `enqueue_outbox_event(...)` become `SECURITY INVOKER`. A direct call must use `service_role`; trusted nested calls continue under the common function owner.
- `claim_idempotent_operation(...)` remains `SECURITY DEFINER` but rejects missing/mismatched actor and organization for every non-service-role context.
- `verify_signing_challenge(...)` calls private `record_contract_signature(...)` internally.
- Trigger execution is unaffected; trigger functions are not granted to `anon`.
- `scripts/verify-function-grants.mjs` scans migrations and literal RPC names under `src/`, `tests/` and `scripts/`, and rejects unsafe grants, incomplete revokes, mutable `search_path` on new definers, or unclassified RPC names.

## Runtime status

The source migration and regression tests are prepared. Runtime execution is blocked because the connected Supabase account cannot access project `dmigdfbvudzexvdnbvrj`, and production lacks a trustworthy migration ledger under `FASTIGHET-003`. No SQL was executed against the live database.
