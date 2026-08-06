\set ON_ERROR_STOP on

DO $idempotency_schema$
DECLARE
  v_constraint text;
  v_claim_definition text;
  v_mark_definition text;
BEGIN
  SELECT pg_get_constraintdef(c.oid)
  INTO v_constraint
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'OperationIdempotency'
    AND c.conname = 'OperationIdempotency_status_check';

  IF v_constraint IS NULL OR position('UNCERTAIN' IN v_constraint) = 0 THEN
    RAISE EXCEPTION 'OperationIdempotency status constraint does not include UNCERTAIN';
  END IF;

  SELECT pg_get_functiondef(p.oid)
  INTO v_claim_definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'claim_idempotent_operation'
    AND pg_get_function_identity_arguments(p.oid) = 'p_organization_id text, p_actor_type text, p_actor_id text, p_operation text, p_idempotency_key text, p_request_hash text, p_lease_seconds integer';

  IF v_claim_definition IS NULL OR position('operation_outcome_uncertain' IN v_claim_definition) = 0 THEN
    RAISE EXCEPTION 'claim_idempotent_operation does not block uncertain outcomes';
  END IF;

  SELECT pg_get_functiondef(p.oid)
  INTO v_mark_definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'mark_idempotent_operation_uncertain'
    AND pg_get_function_identity_arguments(p.oid) = 'p_record_id text, p_response_status integer, p_response_body jsonb, p_error text';

  IF v_mark_definition IS NULL OR position('COMPLETED' IN v_mark_definition) = 0 THEN
    RAISE EXCEPTION 'mark_idempotent_operation_uncertain is missing or cannot tolerate a completed race';
  END IF;

  IF has_function_privilege('anon', 'public.mark_idempotent_operation_uncertain(text,integer,jsonb,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.mark_idempotent_operation_uncertain(text,integer,jsonb,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Uncertain outcome function is executable by a public client role';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.mark_idempotent_operation_uncertain(text,integer,jsonb,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role cannot mark uncertain idempotency outcomes';
  END IF;
END
$idempotency_schema$;

SELECT 'idempotency_verification_ok' AS result;
