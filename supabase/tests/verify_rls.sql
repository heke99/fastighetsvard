\set ON_ERROR_STOP on

DO $$
DECLARE
  broad_policy text[];
BEGIN
  SELECT array_agg(format('%I.%I', schemaname, tablename) || ':' || policyname)
  INTO broad_policy
  FROM pg_policies
  WHERE schemaname IN ('public', 'storage')
    AND roles @> ARRAY['authenticated']::name[]
    AND lower(COALESCE(qual, '')) IN ('true', '(true)')
    AND tablename <> 'objects';
  IF broad_policy IS NOT NULL THEN
    RAISE EXCEPTION 'Broad authenticated policies found: %', broad_policy;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname IN ('authenticated_private_storage_read', 'authenticated_private_storage_insert')
  ) THEN
    RAISE EXCEPTION 'Legacy permissive private Storage policy still exists';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'private_storage_owner_or_staff_read'
  ) THEN
    RAISE EXCEPTION 'Path-bound private Storage read policy is missing';
  END IF;
END $$;

SELECT 'rls_verification_ok' AS result;

DO $$
DECLARE
  overgranted text[];
BEGIN
  SELECT array_agg(required.table_name ORDER BY required.table_name)
  INTO overgranted
  FROM (VALUES
    ('Organization'), ('MasterDataConfig'), ('Invitation'), ('Role'), ('RolePermission'), ('UserRole'),
    ('Property'), ('Building'), ('Entrance'), ('Floor'), ('Unit'), ('UnitMedia'), ('Listing'),
    ('ListingPublication'), ('Application'), ('ApplicationMember'), ('ApplicationStatusEvent'),
    ('Viewing'), ('ViewingAttendee'), ('Offer'), ('Contract'), ('ContractParty'),
    ('ContractVersion'), ('ContractStatusEvent'), ('Termination'), ('Inspection'), ('Invoice'),
    ('InvoiceLine'), ('InvoiceStatusEvent'), ('Payment'), ('PaymentAllocation'),
    ('ExternalReference'), ('IntegrationConnection'), ('IntegrationSyncJob'), ('SyncReviewItem'),
    ('MaintenanceRequest'), ('MaintenanceComment'), ('MaintenanceStatusEvent'), ('WorkOrder'),
    ('Supplier'), ('Document'), ('ApiKey'), ('IdempotencyRecord'), ('WebhookSubscription'),
    ('WebhookDelivery'), ('InboundWebhookEvent'), ('ImportJob'), ('AuditEvent'), ('Counter')
  ) AS required(table_name)
  WHERE has_table_privilege('authenticated', format('public.%I', required.table_name), 'INSERT')
     OR has_table_privilege('authenticated', format('public.%I', required.table_name), 'DELETE');
  IF overgranted IS NOT NULL THEN
    RAISE EXCEPTION 'Authenticated role has forbidden direct write grants: %', overgranted;
  END IF;
END $$;

DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public."AuditEvent"', 'UPDATE')
     OR has_table_privilege('authenticated', 'public."AuditEvent"', 'DELETE') THEN
    RAISE EXCEPTION 'AuditEvent is mutable through authenticated grants';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'AuditEvent'
      AND t.tgname = 'AuditEvent_append_only' AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'Append-only AuditEvent trigger is missing';
  END IF;
END $$;

SELECT 'grant_and_audit_verification_ok' AS result;

DO $function_grants$
DECLARE
  v_missing text[];
  v_overgranted text[];
  v_undergranted text[];
  v_anon_security_definer text[];
BEGIN
  SELECT array_agg(required.name ORDER BY required.name)
  INTO v_missing
  FROM (VALUES
    ('write_audit_event'),
    ('enqueue_outbox_event'),
    ('claim_outbox_jobs'),
    ('claim_idempotent_operation'),
    ('complete_idempotent_operation'),
    ('fail_idempotent_operation')
  ) AS required(name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = required.name
  );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Required privileged functions are missing: %', v_missing;
  END IF;

  SELECT array_agg(p.oid::regprocedure::text ORDER BY p.oid::regprocedure::text)
  INTO v_overgranted
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'write_audit_event',
      'enqueue_outbox_event',
      'claim_outbox_jobs',
      'claim_idempotent_operation',
      'complete_idempotent_operation',
      'fail_idempotent_operation'
    )
    AND (
      has_function_privilege('anon', p.oid, 'EXECUTE')
      OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
    );
  IF v_overgranted IS NOT NULL THEN
    RAISE EXCEPTION 'Privileged overloads are exposed to anon/authenticated: %', v_overgranted;
  END IF;

  SELECT array_agg(p.oid::regprocedure::text ORDER BY p.oid::regprocedure::text)
  INTO v_undergranted
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'write_audit_event',
      'enqueue_outbox_event',
      'claim_outbox_jobs',
      'claim_idempotent_operation',
      'complete_idempotent_operation',
      'fail_idempotent_operation'
    )
    AND NOT has_function_privilege('service_role', p.oid, 'EXECUTE');
  IF v_undergranted IS NOT NULL THEN
    RAISE EXCEPTION 'Privileged overloads are unavailable to service_role: %', v_undergranted;
  END IF;

  SELECT array_agg(p.oid::regprocedure::text ORDER BY p.oid::regprocedure::text)
  INTO v_anon_security_definer
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF v_anon_security_definer IS NOT NULL THEN
    RAISE EXCEPTION 'SECURITY DEFINER functions remain executable by anon: %',
      v_anon_security_definer;
  END IF;
END
$function_grants$;

DO $writer_mode$
DECLARE
  v_function regprocedure;
BEGIN
  FOREACH v_function IN ARRAY ARRAY[
    'public.write_audit_event(text,text,text,text,jsonb,jsonb,text,text,text)'::regprocedure,
    'public.enqueue_outbox_event(text,text,text,text,text,jsonb,text)'::regprocedure
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_proc p WHERE p.oid = v_function::oid AND p.prosecdef
    ) THEN
      RAISE EXCEPTION '% must be SECURITY INVOKER', v_function;
    END IF;
  END LOOP;
END
$writer_mode$;

DO $portal_allowlist$
DECLARE
  v_signature text;
  v_function regprocedure;
  v_allowed_oids oid[] := ARRAY[]::oid[];
  v_missing_or_denied text[] := ARRAY[]::text[];
  v_unlisted text[];
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.current_app_organization_id()',
    'public.current_app_person_id()',
    'public.current_app_user_id()',
    'public.app_has_permission(text)',
    'public.current_user_context()',
    'public.record_current_login(text)',
    'public.toggle_favorite(text)',
    'public.current_active_tenancy_summary()',
    'public.current_person_has_active_application(text)',
    'public.current_person_contract_catalog(text,public."ContractStatus"[],public."ContractPartyRole"[])',
    'public.current_person_application_catalog(public."ApplicationStatus"[],integer)',
    'public.current_person_upcoming_viewings(integer)',
    'public.submit_rental_application(text,text,jsonb,text,text)',
    'public.withdraw_rental_application(text,text,text)',
    'public.create_viewing_booking(text,text,text)',
    'public.cancel_viewing_booking(text,text)',
    'public.send_rental_offer(text,timestamp,integer)',
    'public.accept_rental_offer(text,text,timestamp,text,text)',
    'public.decline_rental_offer(text,text,text,text)',
    'public.record_contract_signature(text,text,text,text,text,text,text,jsonb)',
    'public.request_contract_termination(text,text,timestamp,text,boolean,text,text,text)',
    'public.cancel_contract_termination(text,text)',
    'public.complete_internal_transfer(text,text,text,timestamp)',
    'public.create_contract_version(text,jsonb,text,integer)',
    'public.create_signing_session(text,text,timestamp)',
    'public.countersign_contract(text,text,text,text,text,jsonb)',
    'public.activate_signed_contract(text,text,text)',
    'public.confirm_contract_termination(text,integer,text)',
    'public.complete_move_in(text,jsonb,integer)',
    'public.complete_move_out(text,jsonb,public."UnitStatus")',
    'public.verify_signing_challenge(text,text,text,text,text)',
    'public.change_application_status(text,public."ApplicationStatus",public."ApplicationStatus",text)',
    'public.change_listing_status(text,public."ListingStatus",public."ListingStatus")',
    'public.complete_unit_listings(text,text)',
    'public.change_contract_status(text,public."ContractStatus",public."ContractStatus",text)'
  ]
  LOOP
    v_function := to_regprocedure(v_signature);
    IF v_function IS NULL
       OR NOT has_function_privilege('authenticated', v_function::oid, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_function::oid, 'EXECUTE') THEN
      v_missing_or_denied := array_append(v_missing_or_denied, v_signature);
    ELSE
      v_allowed_oids := array_append(v_allowed_oids, v_function::oid);
    END IF;
  END LOOP;

  IF cardinality(v_missing_or_denied) > 0 THEN
    RAISE EXCEPTION 'Authenticated RPC allow-list is incomplete: %',
      v_missing_or_denied;
  END IF;

  SELECT array_agg(p.oid::regprocedure::text ORDER BY p.oid::regprocedure::text)
  INTO v_unlisted
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
    AND NOT (p.oid = ANY(v_allowed_oids));

  IF v_unlisted IS NOT NULL THEN
    RAISE EXCEPTION 'Authenticated can execute SECURITY DEFINER functions outside the allow-list: %',
      v_unlisted;
  END IF;
END
$portal_allowlist$;

DO $null_actor_guard$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.claim_idempotent_operation(text,text,text,text,text,text,integer)'::regprocedure
  )
  INTO v_definition;

  IF v_definition !~* 'NULLIF\s*\(\s*trim\s*\(\s*p_actor_id\s*\)\s*,\s*''''\s*\)\s+IS\s+NULL'
     OR v_definition !~* 'p_organization_id\s+IS\s+DISTINCT\s+FROM\s+v_current_organization_id'
     OR v_definition !~* 'COALESCE\s*\(\s*auth\.role\(\)\s*,\s*''''\s*\)\s*<>\s*''service_role''' THEN
    RAISE EXCEPTION 'claim_idempotent_operation does not contain the required fail-closed guards';
  END IF;

  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  BEGIN
    PERFORM *
    FROM public.claim_idempotent_operation(
      'test-organization',
      'person',
      NULL,
      'grant-regression-test',
      'grant-regression-key',
      'grant-regression-hash',
      1
    );
    RAISE EXCEPTION 'NULL actor was accepted';
  EXCEPTION
    WHEN SQLSTATE '42501' THEN
      IF SQLERRM <> 'actor_mismatch' THEN
        RAISE EXCEPTION 'NULL actor returned unexpected error: %', SQLERRM;
      END IF;
  END;
END
$null_actor_guard$;

SELECT 'function_grant_verification_ok' AS result;
