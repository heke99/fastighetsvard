-- Lock privileged database functions and prevent Supabase role defaults from
-- re-exposing SECURITY DEFINER entry points.
--
-- Scope: FASTIGHET-001, FASTIGHET-002, FASTIGHET-004, FASTIGHET-008.
-- This migration is forward-only and must not be applied to production until
-- FASTIGHET-003 (the unverifiable migration ledger) has been resolved.

BEGIN;
SET LOCAL search_path = public, auth, extensions, pg_temp;

-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Supabase can
-- also carry explicit grants for anon/authenticated. Remove both sources of
-- implicit access for future functions owned by postgres.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- Establish a deterministic deny-by-default baseline. Every existing public
-- SECURITY DEFINER overload loses PUBLIC/anon/authenticated execution by exact
-- regprocedure identity. Legitimate authenticated entry points are restored
-- explicitly below from the verified source caller and RLS-helper inventory.
DO $lock_security_definer_grants$
DECLARE
  v_function regprocedure;
BEGIN
  FOR v_function IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
    ORDER BY p.oid::regprocedure::text
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      v_function
    );
  END LOOP;
END
$lock_security_definer_grants$;

-- Verified authenticated entry points. These functions are called through the
-- request-scoped server client, are needed by RLS policies, or are canonical
-- authenticated portal commands. No service-only function appears here.
GRANT EXECUTE ON FUNCTION public.current_app_organization_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_app_person_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_has_permission(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_context() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_current_login(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.toggle_favorite(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_active_tenancy_summary() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_person_has_active_application(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_person_contract_catalog(text, public."ContractStatus"[], public."ContractPartyRole"[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_person_application_catalog(public."ApplicationStatus"[], integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_person_upcoming_viewings(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_rental_application(text, text, jsonb, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.withdraw_rental_application(text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_viewing_booking(text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_viewing_booking(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.send_rental_offer(text, timestamp, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_rental_offer(text, text, timestamp, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.decline_rental_offer(text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_contract_signature(text, text, text, text, text, text, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.request_contract_termination(text, text, timestamp, text, boolean, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_contract_termination(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_internal_transfer(text, text, text, timestamp) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_contract_version(text, jsonb, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_signing_session(text, text, timestamp) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.countersign_contract(text, text, text, text, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.activate_signed_contract(text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_contract_termination(text, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_move_in(text, jsonb, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_move_out(text, jsonb, public."UnitStatus") TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_signing_challenge(text, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.change_application_status(text, public."ApplicationStatus", public."ApplicationStatus", text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.change_listing_status(text, public."ListingStatus", public."ListingStatus") TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_unit_listings(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.change_contract_status(text, public."ContractStatus", public."ContractStatus", text) TO authenticated, service_role;

-- These helpers are implementation details. Direct callers must use the
-- service role; trusted SECURITY DEFINER commands continue to call them as the
-- function owner.
REVOKE ALL ON FUNCTION public.write_audit_event(
  text, text, text, text, jsonb, jsonb, text, text, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_outbox_event(
  text, text, text, text, text, jsonb, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_outbox_jobs(
  text, integer, integer
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_idempotent_operation(
  text, text, text, text, text, text, integer
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_idempotent_operation(
  text, integer, jsonb
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_idempotent_operation(
  text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.write_audit_event(
  text, text, text, text, jsonb, jsonb, text, text, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_outbox_event(
  text, text, text, text, text, jsonb, text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_outbox_jobs(
  text, integer, integer
) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_idempotent_operation(
  text, text, text, text, text, text, integer
) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_idempotent_operation(
  text, integer, jsonb
) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_idempotent_operation(
  text, text
) TO service_role;

-- A direct PostgREST invocation of either writer must never inherit the
-- function owner's table privileges. Trusted parent SECURITY DEFINER commands
-- still execute these helpers with the parent's effective owner.
ALTER FUNCTION public.write_audit_event(
  text, text, text, text, jsonb, jsonb, text, text, text
) SECURITY INVOKER;
ALTER FUNCTION public.write_audit_event(
  text, text, text, text, jsonb, jsonb, text, text, text
) SET search_path = public, extensions;

ALTER FUNCTION public.enqueue_outbox_event(
  text, text, text, text, text, jsonb, text
) SECURITY INVOKER;
ALTER FUNCTION public.enqueue_outbox_event(
  text, text, text, text, text, jsonb, text
) SET search_path = public, extensions;

-- Keep the existing contract and SQLSTATEs, but make actor and organization
-- checks fail closed for every non-service-role execution context. COALESCE is
-- intentional: a missing JWT role must never be treated as privileged.
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
SET search_path = public, auth, extensions, pg_temp
AS $function$
DECLARE
  v_row public."OperationIdempotency"%ROWTYPE;
  v_inserted_id text;
  v_current_actor_id text;
  v_current_organization_id text;
BEGIN
  IF NULLIF(trim(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'idempotency_key_required' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    IF NULLIF(trim(p_actor_id), '') IS NULL THEN
      RAISE EXCEPTION 'actor_mismatch' USING ERRCODE = '42501';
    END IF;

    v_current_actor_id := CASE p_actor_type
      WHEN 'person' THEN public.current_app_person_id()
      WHEN 'user' THEN public.current_app_user_id()
      ELSE NULL
    END;

    IF v_current_actor_id IS NULL
       OR p_actor_id IS DISTINCT FROM v_current_actor_id THEN
      RAISE EXCEPTION 'actor_mismatch' USING ERRCODE = '42501';
    END IF;

    v_current_organization_id := public.current_app_organization_id();
    IF NULLIF(trim(p_organization_id), '') IS NULL
       OR v_current_organization_id IS NULL
       OR p_organization_id IS DISTINCT FROM v_current_organization_id THEN
      RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public."OperationIdempotency" (
    "organizationId", "actorType", "actorId", "operation", "idempotencyKey",
    "requestHash", "leaseExpiresAt"
  ) VALUES (
    p_organization_id, p_actor_type, p_actor_id, p_operation, p_idempotency_key,
    p_request_hash,
    CURRENT_TIMESTAMP + make_interval(secs => GREATEST(p_lease_seconds, 1))
  )
  ON CONFLICT DO NOTHING
  RETURNING "id" INTO v_inserted_id;

  SELECT *
  INTO v_row
  FROM public."OperationIdempotency"
  WHERE "organizationId" = p_organization_id
    AND "actorType" = p_actor_type
    AND "actorId" = p_actor_id
    AND "operation" = p_operation
    AND "idempotencyKey" = p_idempotency_key
  FOR UPDATE;

  IF v_row."requestHash" <> p_request_hash THEN
    RAISE EXCEPTION 'idempotency_key_reused_with_different_request'
      USING ERRCODE = '23505';
  END IF;

  IF v_inserted_id IS NULL AND v_row."status" = 'COMPLETED' THEN
    RETURN QUERY
    SELECT v_row."id", true, v_row."responseStatus", v_row."responseBody";
    RETURN;
  END IF;

  IF v_inserted_id IS NULL
     AND v_row."status" = 'PROCESSING'
     AND v_row."leaseExpiresAt" > CURRENT_TIMESTAMP THEN
    RAISE EXCEPTION 'operation_already_processing' USING ERRCODE = '55P03';
  END IF;

  UPDATE public."OperationIdempotency"
  SET "status" = 'PROCESSING',
      "leaseExpiresAt" =
        CURRENT_TIMESTAMP + make_interval(secs => GREATEST(p_lease_seconds, 1)),
      "error" = NULL
  WHERE "id" = v_row."id";

  RETURN QUERY
  SELECT v_row."id", false, NULL::integer, NULL::jsonb;
END
$function$;

REVOKE ALL ON FUNCTION public.claim_idempotent_operation(
  text, text, text, text, text, text, integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_idempotent_operation(
  text, text, text, text, text, text, integer
) TO service_role;

COMMENT ON FUNCTION public.write_audit_event(
  text, text, text, text, jsonb, jsonb, text, text, text
) IS 'Internal audit writer. Direct EXECUTE is service_role-only; trusted SECURITY DEFINER commands may invoke it as owner.';
COMMENT ON FUNCTION public.enqueue_outbox_event(
  text, text, text, text, text, jsonb, text
) IS 'Internal outbox writer. Direct EXECUTE is service_role-only; trusted SECURITY DEFINER commands may invoke it as owner.';
COMMENT ON FUNCTION public.claim_idempotent_operation(
  text, text, text, text, text, text, integer
) IS 'Internal idempotency guard. Direct EXECUTE is service_role-only and non-service contexts fail closed on actor and organization identity.';

COMMIT;
