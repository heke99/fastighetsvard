-- Strict function ACL regressions for FASTIGHET-001/002/004/008.
-- Run after verify_rls.sql. All test-local settings and data are rolled back.

BEGIN;

DO $sensitive_acl$
DECLARE
  v_signature text;
  v_function regprocedure;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.write_audit_event(text,text,text,text,jsonb,jsonb,text,text,text)',
    'public.enqueue_outbox_event(text,text,text,text,text,jsonb,text)',
    'public.claim_outbox_jobs(text,integer,integer)',
    'public.claim_idempotent_operation(text,text,text,text,text,text,integer)'
  ]
  LOOP
    v_function := pg_catalog.to_regprocedure(v_signature);
    IF v_function IS NULL THEN
      RAISE EXCEPTION 'sensitive_function_missing: %', v_signature;
    END IF;
    IF has_function_privilege('anon', v_function, 'EXECUTE') THEN
      RAISE EXCEPTION 'anon_can_execute_sensitive_function: %', v_signature;
    END IF;
    IF has_function_privilege('authenticated', v_function, 'EXECUTE') THEN
      RAISE EXCEPTION 'authenticated_can_execute_sensitive_function: %', v_signature;
    END IF;
    IF NOT has_function_privilege('service_role', v_function, 'EXECUTE') THEN
      RAISE EXCEPTION 'service_role_cannot_execute_sensitive_function: %', v_signature;
    END IF;
  END LOOP;
END;
$sensitive_acl$;

DO $all_sensitive_overloads$
DECLARE
  v_function record;
BEGIN
  FOR v_function IN
    SELECT p.oid, p.oid::regprocedure AS signature
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'write_audit_event',
        'enqueue_outbox_event',
        'claim_outbox_jobs',
        'claim_idempotent_operation',
        'complete_idempotent_operation',
        'fail_idempotent_operation'
      )
  LOOP
    IF has_function_privilege('anon', v_function.oid, 'EXECUTE')
       OR has_function_privilege('authenticated', v_function.oid, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_function.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'sensitive_overload_acl_invalid: %', v_function.signature;
    END IF;
  END LOOP;
END;
$all_sensitive_overloads$;

DO $anon_surface$
DECLARE
  v_unexpected text[];
BEGIN
  SELECT array_agg(p.oid::regprocedure::text ORDER BY p.oid::regprocedure::text)
  INTO v_unexpected
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prokind = 'f'
    AND has_function_privilege('anon', p.oid, 'EXECUTE');

  IF v_unexpected IS NOT NULL THEN
    RAISE EXCEPTION 'anon_public_function_surface_not_empty: %', v_unexpected;
  END IF;
END;
$anon_surface$;

DO $authenticated_allow_list$
DECLARE
  v_signature text;
  v_function regprocedure;
  v_expected oid[] := ARRAY[]::oid[];
  v_unexpected text[];
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.current_app_organization_id()',
    'public.current_app_person_id()',
    'public.current_app_user_id()',
    'public.app_has_permission(text)',
    'public.current_user_context()',
    'public.record_current_login(text)',
    'public.current_active_tenancy_summary()',
    'public.current_person_has_active_application(text)',
    'public.current_person_contract_catalog(text,public."ContractStatus"[],public."ContractPartyRole"[])',
    'public.current_person_application_catalog(public."ApplicationStatus"[],integer)',
    'public.current_person_upcoming_viewings(integer)',
    'public.toggle_favorite(text)',
    'public.submit_rental_application(text,text,jsonb,text,text)',
    'public.withdraw_rental_application(text,text,text)',
    'public.create_viewing_booking(text,text,text)',
    'public.cancel_viewing_booking(text,text)',
    'public.send_rental_offer(text,timestamp without time zone,integer)',
    'public.accept_rental_offer(text,text,timestamp without time zone,text,text)',
    'public.decline_rental_offer(text,text,text,text)',
    'public.request_contract_termination(text,text,timestamp without time zone,text,boolean,text,text,text)',
    'public.cancel_contract_termination(text,text)',
    'public.verify_signing_challenge(text,text,text,text,text)',
    'public.change_application_status(text,public."ApplicationStatus",public."ApplicationStatus",text)',
    'public.change_listing_status(text,public."ListingStatus",public."ListingStatus")',
    'public.complete_unit_listings(text,text)',
    'public.change_contract_status(text,public."ContractStatus",public."ContractStatus",text)',
    'public.create_contract_version(text,jsonb,text,integer)',
    'public.activate_signed_contract(text,text,text)'
  ]
  LOOP
    v_function := pg_catalog.to_regprocedure(v_signature);
    IF v_function IS NULL THEN
      RAISE EXCEPTION 'authenticated_rpc_missing: %', v_signature;
    END IF;
    IF NOT has_function_privilege('authenticated', v_function, 'EXECUTE') THEN
      RAISE EXCEPTION 'authenticated_rpc_not_executable: %', v_signature;
    END IF;
    v_expected := array_append(v_expected, v_function::oid);
  END LOOP;

  SELECT array_agg(p.oid::regprocedure::text ORDER BY p.oid::regprocedure::text)
  INTO v_unexpected
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prokind = 'f'
    AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
    AND NOT (p.oid = ANY(v_expected));

  IF v_unexpected IS NOT NULL THEN
    RAISE EXCEPTION 'unexpected_authenticated_function_acl: %', v_unexpected;
  END IF;
END;
$authenticated_allow_list$;

DO $service_surface$
DECLARE
  v_missing text[];
BEGIN
  SELECT array_agg(p.oid::regprocedure::text ORDER BY p.oid::regprocedure::text)
  INTO v_missing
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prokind = 'f'
    AND NOT has_function_privilege('service_role', p.oid, 'EXECUTE');

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'service_role_function_acl_incomplete: %', v_missing;
  END IF;
END;
$service_surface$;

DO $function_modes$
DECLARE
  v_security_definer boolean;
  v_config text[];
BEGIN
  SELECT p.prosecdef, p.proconfig INTO v_security_definer, v_config
  FROM pg_catalog.pg_proc p
  WHERE p.oid = 'public.write_audit_event(text,text,text,text,jsonb,jsonb,text,text,text)'::regprocedure;
  IF v_security_definer THEN
    RAISE EXCEPTION 'write_audit_event_must_be_security_invoker';
  END IF;
  IF array_to_string(v_config, ',') NOT LIKE '%search_path=pg_catalog, public, auth, extensions, pg_temp%' THEN
    RAISE EXCEPTION 'write_audit_event_search_path_not_locked';
  END IF;

  SELECT p.prosecdef, p.proconfig INTO v_security_definer, v_config
  FROM pg_catalog.pg_proc p
  WHERE p.oid = 'public.enqueue_outbox_event(text,text,text,text,text,jsonb,text)'::regprocedure;
  IF v_security_definer THEN
    RAISE EXCEPTION 'enqueue_outbox_event_must_be_security_invoker';
  END IF;
  IF array_to_string(v_config, ',') NOT LIKE '%search_path=pg_catalog, public, auth, extensions, pg_temp%' THEN
    RAISE EXCEPTION 'enqueue_outbox_event_search_path_not_locked';
  END IF;

  SELECT p.prosecdef, p.proconfig INTO v_security_definer, v_config
  FROM pg_catalog.pg_proc p
  WHERE p.oid = 'public.claim_idempotent_operation(text,text,text,text,text,text,integer)'::regprocedure;
  IF NOT v_security_definer THEN
    RAISE EXCEPTION 'claim_idempotent_operation_must_remain_security_definer';
  END IF;
  IF array_to_string(v_config, ',') NOT LIKE '%search_path=pg_catalog, public, auth, extensions, pg_temp%' THEN
    RAISE EXCEPTION 'claim_idempotent_operation_search_path_not_locked';
  END IF;
END;
$function_modes$;

DO $null_actor_guard$
DECLARE
  v_message text;
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000000"}',
    true
  );

  BEGIN
    PERFORM *
    FROM public.claim_idempotent_operation(
      'regression-organization',
      'person',
      NULL,
      'regression-null-actor',
      'regression-null-actor-key',
      'regression-null-actor-hash',
      60
    );
    RAISE EXCEPTION 'null_actor_was_accepted';
  EXCEPTION
    WHEN insufficient_privilege THEN
      GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
      IF v_message <> 'actor_mismatch' THEN
        RAISE EXCEPTION 'null_actor_wrong_error: %', v_message;
      END IF;
  END;
END;
$null_actor_guard$;

DO $default_privileges$
DECLARE
  v_unsafe integer;
  v_service integer;
BEGIN
  SELECT count(*) INTO v_unsafe
  FROM pg_catalog.pg_default_acl d
  JOIN pg_catalog.pg_namespace n ON n.oid = d.defaclnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) acl
  LEFT JOIN pg_catalog.pg_roles r ON r.oid = acl.grantee
  WHERE n.nspname = 'public'
    AND d.defaclobjtype = 'f'
    AND acl.privilege_type = 'EXECUTE'
    AND (acl.grantee = 0 OR r.rolname IN ('anon', 'authenticated'));

  IF v_unsafe <> 0 THEN
    RAISE EXCEPTION 'unsafe_default_function_execute_privileges: %', v_unsafe;
  END IF;

  SELECT count(*) INTO v_service
  FROM pg_catalog.pg_default_acl d
  JOIN pg_catalog.pg_namespace n ON n.oid = d.defaclnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) acl
  JOIN pg_catalog.pg_roles r ON r.oid = acl.grantee
  WHERE n.nspname = 'public'
    AND d.defaclobjtype = 'f'
    AND acl.privilege_type = 'EXECUTE'
    AND r.rolname = 'service_role';

  IF v_service = 0 THEN
    RAISE EXCEPTION 'service_role_default_function_execute_missing';
  END IF;
END;
$default_privileges$;

SELECT 'strict_function_grant_verification_ok' AS result;

ROLLBACK;
