\set ON_ERROR_STOP on

DO $$
DECLARE
  missing text[];
BEGIN
  SELECT array_agg(required.name ORDER BY required.name)
  INTO missing
  FROM (VALUES ('pgcrypto'), ('btree_gist')) AS required(name)
  WHERE NOT EXISTS (SELECT 1 FROM pg_extension e WHERE e.extname = required.name);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing required extensions: %', missing;
  END IF;
END $$;

DO $$
DECLARE
  missing text[];
BEGIN
  SELECT array_agg(required.name ORDER BY required.name)
  INTO missing
  FROM (VALUES
    ('Organization'), ('User'), ('Person'), ('Property'), ('Building'), ('Unit'),
    ('Listing'), ('Application'), ('ApplicationSnapshot'), ('Viewing'), ('ViewingAttendee'),
    ('Offer'), ('Reservation'), ('Contract'), ('ContractVersion'), ('ContractParty'),
    ('SigningSession'), ('SigningChallenge'), ('ContractSignature'), ('EvidenceReport'),
    ('MoveInCase'), ('Termination'), ('MoveOutCase'), ('Document'), ('Invoice'),
    ('MaintenanceRequest'), ('WorkOrder'), ('OutboxEvent'), ('OperationIdempotency'), ('RateLimitBucket'), ('AuditEvent')
  ) AS required(name)
  WHERE to_regclass(format('public.%I', required.name)) IS NULL;
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing required tables: %', missing;
  END IF;
END $$;

DO $$
DECLARE
  missing text[];
BEGIN
  SELECT array_agg(required.name ORDER BY required.name)
  INTO missing
  FROM (VALUES
    ('submit_rental_application'), ('withdraw_rental_application'),
    ('create_viewing_booking'), ('cancel_viewing_booking'), ('send_rental_offer'),
    ('accept_rental_offer'), ('decline_rental_offer'), ('create_contract_version'),
    ('create_signing_session'), ('record_contract_signature'), ('countersign_contract'),
    ('activate_signed_contract'), ('request_contract_termination'),
    ('confirm_contract_termination'), ('cancel_contract_termination'),
    ('complete_internal_transfer'), ('complete_move_in'), ('complete_move_out'),
    ('claim_outbox_jobs'), ('claim_idempotent_operation'), ('complete_idempotent_operation'), ('fail_idempotent_operation'),
    ('create_signing_challenge'), ('verify_signing_challenge'), ('claim_invitation'), ('consume_rate_limit'),
    ('assert_service_role'), ('current_user_context'), ('record_current_login'),
    ('admin_dashboard_metrics'), ('provision_verified_self_signup'), ('reconcile_verified_auth_user')
  ) AS required(name)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = required.name
  );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing required functions: %', missing;
  END IF;
END $$;

DO $$
DECLARE
  unsecured text[];
BEGIN
  SELECT array_agg(c.relname ORDER BY c.relname)
  INTO unsecured
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname NOT LIKE 'pg_%'
    AND NOT c.relrowsecurity;
  IF unsecured IS NOT NULL THEN
    RAISE EXCEPTION 'Tables without RLS: %', unsecured;
  END IF;
END $$;

DO $$
DECLARE
  missing text[];
BEGIN
  SELECT array_agg(required.name ORDER BY required.name)
  INTO missing
  FROM (VALUES
    ('listing-media'), ('application-documents'), ('contract-drafts'),
    ('signed-contracts'), ('tenant-documents'), ('maintenance-files'),
    ('inspection-files'), ('invoice-files'), ('exports')
  ) AS required(name)
  WHERE NOT EXISTS (SELECT 1 FROM storage.buckets b WHERE b.id = required.name);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing Storage buckets: %', missing;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Contract_non_overlapping_binding_periods'
      AND contype = 'x'
  ) THEN
    RAISE EXCEPTION 'Missing contract overlap exclusion constraint';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'Application_one_active_main_per_listing_key'
  ) THEN
    RAISE EXCEPTION 'Missing active application uniqueness index';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'Reservation_one_active_per_unit_key'
  ) THEN
    RAISE EXCEPTION 'Missing active reservation uniqueness index';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'ContractVersion'
      AND t.tgname = 'ContractVersion_locked_immutable' AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'Missing locked ContractVersion immutability trigger';
  END IF;
END $$;

DO $role_catalogue$
DECLARE
  role_mismatches text[];
  permission_mismatches text[];
BEGIN
  WITH expected_roles(slug, name, description, permissions) AS (
    VALUES
      ('superadmin', 'Ägare / superadmin', 'Full ägarbehörighet i hela FaddeBo.', ARRAY['*']::text[]),
      ('org-admin', 'Bolagsadmin', 'Administrerar bolagets användare och samtliga verksamhetsflöden.', ARRAY[
        'persons:*','users:*','roles:*','properties:*','buildings:*','units:*','listings:*','applications:*','viewings:*','offers:*','contracts:*','terminations:*','inspections:*','invoices:*','payments:*','maintenance:*','workorders:*','suppliers:*','documents:*','messages:*','notifications:*','integrations:*','webhooks:*','apikeys:*','imports:*','reports:*','audit:read','settings:*'
      ]::text[]),
      ('property-owner', 'Fastighetsägare', 'Läs- och rapportbehörighet för fastighetsägare.', ARRAY[
        'properties:read','buildings:read','units:read','listings:read','contracts:read','invoices:read','payments:read','reports:*','maintenance:read','workorders:read','audit:read'
      ]::text[]),
      ('property-manager', 'Fastighetsvärd / förvaltare', 'Operativ helhetsbehörighet för uthyrning och förvaltning.', ARRAY[
        'persons:*','properties:*','buildings:*','units:*','listings:*','applications:*','viewings:*','offers:*','contracts:*','terminations:*','inspections:*','maintenance:*','workorders:*','suppliers:*','documents:*','messages:*','invoices:read','payments:read','imports:*','reports:read'
      ]::text[]),
      ('caretaker', 'Kvartersvärd', 'Boendeservice, felanmälningar och arbetsorder.', ARRAY[
        'properties:read','buildings:read','units:read','maintenance:*','workorders:*','messages:*','persons:read','documents:read'
      ]::text[]),
      ('leasing-agent', 'Uthyrare', 'Annonser, ansökningar, visningar, erbjudanden och avtal.', ARRAY[
        'persons:*','units:read','units:update','listings:*','applications:*','viewings:*','offers:*','contracts:*','documents:*','messages:*','reports:read'
      ]::text[]),
      ('sales-manager', 'Försäljningsansvarig', 'Försäljning och kommersiella objekt.', ARRAY[
        'persons:read','units:read','units:update','listings:*','viewings:*','offers:*','contracts:*','documents:*','messages:*','reports:read'
      ]::text[]),
      ('finance', 'Ekonom', 'Fakturor, betalningar, integrationer och ekonomirapporter.', ARRAY[
        'persons:read','contracts:read','invoices:*','payments:*','integrations:*','reports:*','audit:read'
      ]::text[]),
      ('customer-service', 'Kundtjänst', 'Kundservice, ärenden, meddelanden och läsbehörighet.', ARRAY[
        'persons:read','persons:update','units:read','listings:read','applications:read','applications:update','contracts:read','invoices:read','maintenance:*','messages:*','documents:read'
      ]::text[]),
      ('facility-worker', 'Fastighetsskötare', 'Utför och uppdaterar felanmälningar och arbetsorder.', ARRAY[
        'maintenance:read','maintenance:update','workorders:read','workorders:update','units:read'
      ]::text[]),
      ('inspector', 'Besiktningsman', 'Besiktningar och tillhörande dokument.', ARRAY[
        'inspections:*','units:read','contracts:read','documents:create','documents:read'
      ]::text[]),
      ('contractor', 'Entreprenör', 'Ser och uppdaterar endast leverantörens egna arbetsorder.', ARRAY[
        'workorders:read','workorders:update'
      ]::text[]),
      ('report-viewer', 'Rapportläsare', 'Läsbehörighet till rapporter.', ARRAY['reports:read']::text[])
  )
  SELECT array_agg(e.slug ORDER BY e.slug)
  INTO role_mismatches
  FROM expected_roles e
  LEFT JOIN public."Role" r
    ON r."organizationId" IS NULL
   AND r."slug" = e.slug
  WHERE r."id" IS NULL
     OR r."name" IS DISTINCT FROM e.name
     OR r."description" IS DISTINCT FROM e.description
     OR r."isSystem" IS DISTINCT FROM true;

  WITH expected_roles(slug, permissions) AS (
    VALUES
      ('superadmin', ARRAY['*']::text[]),
      ('org-admin', ARRAY['persons:*','users:*','roles:*','properties:*','buildings:*','units:*','listings:*','applications:*','viewings:*','offers:*','contracts:*','terminations:*','inspections:*','invoices:*','payments:*','maintenance:*','workorders:*','suppliers:*','documents:*','messages:*','notifications:*','integrations:*','webhooks:*','apikeys:*','imports:*','reports:*','audit:read','settings:*']::text[]),
      ('property-owner', ARRAY['properties:read','buildings:read','units:read','listings:read','contracts:read','invoices:read','payments:read','reports:*','maintenance:read','workorders:read','audit:read']::text[]),
      ('property-manager', ARRAY['persons:*','properties:*','buildings:*','units:*','listings:*','applications:*','viewings:*','offers:*','contracts:*','terminations:*','inspections:*','maintenance:*','workorders:*','suppliers:*','documents:*','messages:*','invoices:read','payments:read','imports:*','reports:read']::text[]),
      ('caretaker', ARRAY['properties:read','buildings:read','units:read','maintenance:*','workorders:*','messages:*','persons:read','documents:read']::text[]),
      ('leasing-agent', ARRAY['persons:*','units:read','units:update','listings:*','applications:*','viewings:*','offers:*','contracts:*','documents:*','messages:*','reports:read']::text[]),
      ('sales-manager', ARRAY['persons:read','units:read','units:update','listings:*','viewings:*','offers:*','contracts:*','documents:*','messages:*','reports:read']::text[]),
      ('finance', ARRAY['persons:read','contracts:read','invoices:*','payments:*','integrations:*','reports:*','audit:read']::text[]),
      ('customer-service', ARRAY['persons:read','persons:update','units:read','listings:read','applications:read','applications:update','contracts:read','invoices:read','maintenance:*','messages:*','documents:read']::text[]),
      ('facility-worker', ARRAY['maintenance:read','maintenance:update','workorders:read','workorders:update','units:read']::text[]),
      ('inspector', ARRAY['inspections:*','units:read','contracts:read','documents:create','documents:read']::text[]),
      ('contractor', ARRAY['workorders:read','workorders:update']::text[]),
      ('report-viewer', ARRAY['reports:read']::text[])
  ),
  expected_permissions AS (
    SELECT e.slug, unnest(e.permissions) AS permission
    FROM expected_roles e
  ),
  actual_permissions AS (
    SELECT r."slug" AS slug, rp."permission" AS permission
    FROM public."Role" r
    JOIN public."RolePermission" rp ON rp."roleId" = r."id"
    JOIN expected_roles e ON e.slug = r."slug"
    WHERE r."organizationId" IS NULL
  ),
  mismatches AS (
    SELECT 'missing'::text AS kind, e.slug, e.permission
    FROM expected_permissions e
    LEFT JOIN actual_permissions a USING (slug, permission)
    WHERE a.permission IS NULL
    UNION ALL
    SELECT 'extra'::text AS kind, a.slug, a.permission
    FROM actual_permissions a
    LEFT JOIN expected_permissions e USING (slug, permission)
    WHERE e.permission IS NULL
  )
  SELECT array_agg(format('%s:%s:%s', kind, slug, permission) ORDER BY kind, slug, permission)
  INTO permission_mismatches
  FROM mismatches;

  IF role_mismatches IS NOT NULL THEN
    RAISE EXCEPTION 'Canonical system role metadata mismatch: %', role_mismatches;
  END IF;
  IF permission_mismatches IS NOT NULL THEN
    RAISE EXCEPTION 'Canonical system role permissions mismatch: %', permission_mismatches;
  END IF;
END
$role_catalogue$;

SELECT 'schema_verification_ok' AS result;