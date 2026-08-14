-- Lock privileged function execution to verified callers.
-- Resolves FASTIGHET-001, FASTIGHET-002, FASTIGHET-004 and FASTIGHET-008.
-- Source-only migration: do not apply to production until FASTIGHET-003 is resolved.

BEGIN;

CREATE OR REPLACE FUNCTION public.write_audit_event(
  p_organization_id text,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_before jsonb DEFAULT NULL,
  p_after jsonb DEFAULT NULL,
  p_actor_type text DEFAULT 'user',
  p_actor_id text DEFAULT NULL,
  p_correlation_id text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, extensions, pg_temp
AS $function$
DECLARE
  v_id text := extensions.gen_random_uuid()::text;
  v_owner name;
BEGIN
  SELECT pg_catalog.pg_get_userbyid(p.proowner)
  INTO v_owner
  FROM pg_catalog.pg_proc p
  WHERE p.oid = 'public.write_audit_event(text,text,text,text,jsonb,jsonb,text,text,text)'::regprocedure;

  IF COALESCE(auth.role(), '') <> 'service_role'
     AND current_user IS DISTINCT FROM v_owner THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public."AuditEvent" (
    "id", "organizationId", "userId", "actorType", "actorId", "action",
    "entityType", "entityId", "before", "after", "correlationId"
  ) VALUES (
    v_id, p_organization_id, public.current_app_user_id(), p_actor_type,
    COALESCE(p_actor_id, public.current_app_user_id()), p_action,
    p_entity_type, p_entity_id, p_before, p_after, p_correlation_id
  );

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_outbox_event(
  p_organization_id text,
  p_event_type text,
  p_aggregate_type text,
  p_aggregate_id text,
  p_recipient text,
  p_payload jsonb,
  p_idempotency_key text
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth, extensions, pg_temp
AS $function$
DECLARE
  v_id text;
  v_owner name;
BEGIN
  SELECT pg_catalog.pg_get_userbyid(p.proowner)
  INTO v_owner
  FROM pg_catalog.pg_proc p
  WHERE p.oid = 'public.enqueue_outbox_event(text,text,text,text,text,jsonb,text)'::regprocedure;

  IF COALESCE(auth.role(), '') <> 'service_role'
     AND current_user IS DISTINCT FROM v_owner THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public."OutboxEvent" (
    "organizationId", "eventType", "aggregateType", "aggregateId",
    "recipient", "payload", "idempotencyKey"
  ) VALUES (
    p_organization_id, p_event_type, p_aggregate_type, p_aggregate_id,
    p_recipient, p_payload, p_idempotency_key
  )
  ON CONFLICT ("idempotencyKey") DO UPDATE
    SET "idempotencyKey" = EXCLUDED."idempotencyKey"
  RETURNING "id" INTO v_id;

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_idempotent_operation(
  p_organization_id text,
  p_actor_type text,
  p_actor_id text,
  p_operation text,
  p_idempotency_key text,
  p_request_hash text,
  p_lease_seconds integer DEFAULT 60
)
RETURNS TABLE (
  "recordId" text,
  "isReplay" boolean,
  "responseStatus" integer,
  "responseBody" jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, extensions, pg_temp
AS $function$
DECLARE
  v_row public."OperationIdempotency"%ROWTYPE;
  v_inserted_id text;
  v_expected_actor_id text;
BEGIN
  IF NULLIF(trim(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'idempotency_key_required' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    IF p_actor_type = 'person' THEN
      v_expected_actor_id := public.current_app_person_id();
    ELSIF p_actor_type = 'user' THEN
      v_expected_actor_id := public.current_app_user_id();
    ELSE
      RAISE EXCEPTION 'actor_mismatch' USING ERRCODE = '42501';
    END IF;

    IF p_actor_id IS NULL
       OR v_expected_actor_id IS NULL
       OR p_actor_id IS DISTINCT FROM v_expected_actor_id THEN
      RAISE EXCEPTION 'actor_mismatch' USING ERRCODE = '42501';
    END IF;

    IF p_organization_id IS NULL
       OR public.current_app_organization_id() IS NULL
       OR p_organization_id IS DISTINCT FROM public.current_app_organization_id() THEN
      RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public."OperationIdempotency" (
    "organizationId", "actorType", "actorId", "operation", "idempotencyKey",
    "requestHash", "leaseExpiresAt"
  ) VALUES (
    p_organization_id, p_actor_type, p_actor_id, p_operation, p_idempotency_key,
    p_request_hash, CURRENT_TIMESTAMP + make_interval(secs => GREATEST(p_lease_seconds, 1))
  )
  ON CONFLICT DO NOTHING
  RETURNING "id" INTO v_inserted_id;

  SELECT * INTO v_row
  FROM public."OperationIdempotency"
  WHERE "organizationId" = p_organization_id
    AND "actorType" = p_actor_type
    AND "actorId" = p_actor_id
    AND "operation" = p_operation
    AND "idempotencyKey" = p_idempotency_key
  FOR UPDATE;

  IF v_row."requestHash" <> p_request_hash THEN
    RAISE EXCEPTION 'idempotency_key_reused_with_different_request' USING ERRCODE = '23505';
  END IF;

  IF v_inserted_id IS NULL AND v_row."status" = 'COMPLETED' THEN
    RETURN QUERY SELECT v_row."id", true, v_row."responseStatus", v_row."responseBody";
    RETURN;
  END IF;

  IF v_inserted_id IS NULL
     AND v_row."status" = 'PROCESSING'
     AND v_row."leaseExpiresAt" > CURRENT_TIMESTAMP THEN
    RAISE EXCEPTION 'operation_already_processing' USING ERRCODE = '55P03';
  END IF;

  UPDATE public."OperationIdempotency"
  SET "status" = 'PROCESSING',
      "leaseExpiresAt" = CURRENT_TIMESTAMP + make_interval(secs => GREATEST(p_lease_seconds, 1)),
      "error" = NULL
  WHERE "id" = v_row."id";

  RETURN QUERY SELECT v_row."id", false, NULL::integer, NULL::jsonb;
END;
$function$;

DO $acl$
DECLARE
  v_function record;
BEGIN
  FOR v_function IN
    SELECT n.nspname, p.proname,
      pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_arguments
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
    ORDER BY p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid)
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
      v_function.nspname, v_function.proname, v_function.identity_arguments
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role',
      v_function.nspname, v_function.proname, v_function.identity_arguments
    );
  END LOOP;
END;
$acl$;

DO $authenticated_acl$
DECLARE
  v_signature text;
  v_function regprocedure;
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
      RAISE EXCEPTION 'authenticated_rpc_signature_missing: %', v_signature;
    END IF;
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_function);
  END LOOP;
END;
$authenticated_acl$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO service_role;

DO $sensitive_assertions$
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
      RAISE EXCEPTION 'sensitive_rpc_signature_missing: %', v_signature;
    END IF;
    IF has_function_privilege('anon', v_function, 'EXECUTE')
       OR has_function_privilege('authenticated', v_function, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_function, 'EXECUTE') THEN
      RAISE EXCEPTION 'sensitive_rpc_acl_invalid: %', v_signature;
    END IF;
  END LOOP;
END;
$sensitive_assertions$;

COMMIT;
