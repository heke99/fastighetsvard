-- Prevent automatic re-execution when a domain write succeeded but storing the
-- idempotent response had an uncertain outcome.

BEGIN;
SET LOCAL search_path = public, auth, extensions, pg_temp;

ALTER TABLE public."OperationIdempotency"
  DROP CONSTRAINT IF EXISTS "OperationIdempotency_status_check";

ALTER TABLE public."OperationIdempotency"
  ADD CONSTRAINT "OperationIdempotency_status_check"
  CHECK ("status" IN ('PROCESSING','COMPLETED','FAILED','EXPIRED','UNCERTAIN'));

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
BEGIN
  IF NULLIF(trim(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'idempotency_key_required' USING ERRCODE = '22023';
  END IF;

  IF auth.role() <> 'service_role'
     AND p_actor_id IS DISTINCT FROM public.current_app_person_id()
     AND p_actor_id IS DISTINCT FROM public.current_app_user_id() THEN
    RAISE EXCEPTION 'actor_mismatch' USING ERRCODE = '42501';
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

  IF v_inserted_id IS NULL AND v_row."status" = 'UNCERTAIN' THEN
    RAISE EXCEPTION 'operation_outcome_uncertain' USING ERRCODE = '55000';
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
END
$function$;

CREATE OR REPLACE FUNCTION public.mark_idempotent_operation_uncertain(
  p_record_id text,
  p_response_status integer,
  p_response_body jsonb,
  p_error text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $function$
DECLARE
  v_status text;
BEGIN
  UPDATE public."OperationIdempotency"
  SET "status" = 'UNCERTAIN',
      "responseStatus" = p_response_status,
      "responseBody" = p_response_body,
      "error" = left(COALESCE(p_error, 'idempotency_completion_uncertain'), 2000),
      "leaseExpiresAt" = NULL
  WHERE "id" = p_record_id
    AND "status" = 'PROCESSING';

  IF FOUND THEN
    RETURN;
  END IF;

  SELECT "status" INTO v_status
  FROM public."OperationIdempotency"
  WHERE "id" = p_record_id;

  -- The completion call may have succeeded even if its network response was
  -- lost. In that case the completed record is already safe and replayable.
  IF v_status = 'COMPLETED' THEN
    RETURN;
  END IF;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'idempotency_record_not_found' USING ERRCODE = 'P0002';
  END IF;

  RAISE EXCEPTION 'idempotency_record_not_processing' USING ERRCODE = 'P0001';
END
$function$;

REVOKE ALL ON FUNCTION public.claim_idempotent_operation(text,text,text,text,text,text,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_idempotent_operation(text,text,text,text,text,text,integer)
  TO service_role;

REVOKE ALL ON FUNCTION public.mark_idempotent_operation_uncertain(text,integer,jsonb,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_idempotent_operation_uncertain(text,integer,jsonb,text)
  TO service_role;

COMMIT;
