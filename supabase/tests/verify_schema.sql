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
    ('create_signing_challenge'), ('verify_signing_challenge'), ('claim_invitation'), ('consume_rate_limit')
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

SELECT 'schema_verification_ok' AS result;
