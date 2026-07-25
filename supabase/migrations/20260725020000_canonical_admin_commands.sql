-- Canonical administrative commands. Every multi-row transition is locked,
-- authorized, audited and committed in PostgreSQL.

BEGIN;
SET LOCAL search_path = public, extensions;

CREATE FUNCTION public.change_application_status(
  p_application_id text,
  p_expected_status public."ApplicationStatus",
  p_to_status public."ApplicationStatus",
  p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  v_application public."Application"%ROWTYPE;
  v_allowed boolean := false;
  v_user_id text := public.current_app_user_id();
BEGIN
  SELECT * INTO v_application
  FROM public."Application"
  WHERE "id" = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'application_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF auth.role() <> 'service_role'
     AND public.current_app_organization_id() IS DISTINCT FROM v_application."organizationId" THEN
    RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501';
  END IF;
  IF auth.role() <> 'service_role' AND NOT public.app_has_permission('applications:update') THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;
  IF v_application."status" IS DISTINCT FROM p_expected_status THEN
    RAISE EXCEPTION 'optimistic_lock_conflict' USING ERRCODE = '40001';
  END IF;

  -- Submission, applicant withdrawal, offers and contract states have
  -- dedicated commands and may not be forged by the review command.
  IF p_to_status IN (
    'SUBMITTED', 'OFFER_SENT', 'ACCEPTED', 'DECLINED',
    'CONTRACT_SENT', 'CONTRACT_SIGNED', 'WITHDRAWN'
  ) THEN
    RAISE EXCEPTION 'dedicated_application_command_required' USING ERRCODE = '55000';
  END IF;

  v_allowed := CASE v_application."status"
    WHEN 'SUBMITTED' THEN p_to_status = 'RECEIVED'
    WHEN 'RECEIVED' THEN p_to_status = 'UNDER_REVIEW'
    WHEN 'UNDER_REVIEW' THEN p_to_status IN ('NEEDS_SUPPLEMENT', 'QUALIFIED', 'NOT_QUALIFIED')
    WHEN 'NEEDS_SUPPLEMENT' THEN p_to_status = 'UNDER_REVIEW'
    WHEN 'QUALIFIED' THEN p_to_status IN ('VIEWING_OFFERED', 'CLOSED')
    WHEN 'NOT_QUALIFIED' THEN p_to_status IN ('CLOSED', 'UNDER_REVIEW')
    WHEN 'VIEWING_OFFERED' THEN p_to_status IN ('VIEWING_BOOKED', 'CLOSED')
    WHEN 'VIEWING_BOOKED' THEN p_to_status IN ('QUALIFIED', 'CLOSED')
    WHEN 'ACCEPTED' THEN p_to_status = 'CLOSED'
    WHEN 'DECLINED' THEN p_to_status = 'CLOSED'
    WHEN 'CONTRACT_SIGNED' THEN p_to_status = 'CLOSED'
    ELSE false
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'invalid_application_transition' USING ERRCODE = '22023';
  END IF;

  UPDATE public."Application"
  SET
    "status" = p_to_status,
    "closedAt" = CASE WHEN p_to_status = 'CLOSED' THEN CURRENT_TIMESTAMP ELSE "closedAt" END,
    "version" = "version" + 1
  WHERE "id" = p_application_id;

  INSERT INTO public."ApplicationStatusEvent" (
    "applicationId", "fromStatus", "toStatus", "comment", "changedByUserId"
  ) VALUES (
    p_application_id, v_application."status", p_to_status, p_comment, v_user_id
  );

  PERFORM public.write_audit_event(
    v_application."organizationId",
    'application_status_changed',
    'application',
    p_application_id,
    jsonb_build_object('status', v_application."status", 'version', v_application."version"),
    jsonb_build_object('status', p_to_status, 'version', v_application."version" + 1)
  );
  PERFORM public.enqueue_outbox_event(
    v_application."organizationId",
    'application.status_changed',
    'application',
    p_application_id,
    NULL,
    jsonb_build_object(
      'applicationId', p_application_id,
      'fromStatus', v_application."status",
      'toStatus', p_to_status
    ),
    'application.status:' || p_application_id || ':' || (v_application."version" + 1)::text
  );

  RETURN jsonb_build_object(
    'applicationId', p_application_id,
    'fromStatus', v_application."status",
    'status', p_to_status,
    'version', v_application."version" + 1
  );
END
$function$;

CREATE FUNCTION public.change_listing_status(
  p_listing_id text,
  p_expected_status public."ListingStatus",
  p_to_status public."ListingStatus"
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  v_listing public."Listing"%ROWTYPE;
  v_allowed boolean := false;
  v_user_id text := public.current_app_user_id();
BEGIN
  SELECT * INTO v_listing
  FROM public."Listing"
  WHERE "id" = p_listing_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'listing_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF auth.role() <> 'service_role'
     AND public.current_app_organization_id() IS DISTINCT FROM v_listing."organizationId" THEN
    RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501';
  END IF;
  IF auth.role() <> 'service_role' AND NOT public.app_has_permission('listings:update') THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;
  IF v_listing."status" IS DISTINCT FROM p_expected_status THEN
    RAISE EXCEPTION 'optimistic_lock_conflict' USING ERRCODE = '40001';
  END IF;

  v_allowed := CASE v_listing."status"
    WHEN 'DRAFT' THEN p_to_status IN ('SCHEDULED', 'PUBLISHED', 'UNPUBLISHED')
    WHEN 'SCHEDULED' THEN p_to_status IN ('PUBLISHED', 'DRAFT', 'UNPUBLISHED')
    WHEN 'PUBLISHED' THEN p_to_status IN ('PAUSED', 'UNPUBLISHED', 'COMPLETED')
    WHEN 'PAUSED' THEN p_to_status IN ('PUBLISHED', 'UNPUBLISHED')
    WHEN 'UNPUBLISHED' THEN p_to_status IN ('PUBLISHED', 'COMPLETED', 'DRAFT')
    ELSE false
  END;
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'invalid_listing_transition' USING ERRCODE = '22023';
  END IF;

  IF p_to_status = 'PUBLISHED' THEN
    IF NULLIF(trim(v_listing."title"), '') IS NULL
       OR NULLIF(trim(v_listing."description"), '') IS NULL THEN
      RAISE EXCEPTION 'listing_not_publishable' USING ERRCODE = '23514';
    END IF;
    IF v_listing."applicationDeadline" IS NOT NULL
       AND v_listing."applicationDeadline" <= CURRENT_TIMESTAMP THEN
      RAISE EXCEPTION 'application_deadline_passed' USING ERRCODE = '22007';
    END IF;
  END IF;

  UPDATE public."Listing"
  SET
    "status" = p_to_status,
    "publishedAt" = CASE
      WHEN p_to_status = 'PUBLISHED' THEN COALESCE("publishedAt", CURRENT_TIMESTAMP)
      ELSE "publishedAt"
    END,
    "unpublishedAt" = CASE
      WHEN p_to_status = 'UNPUBLISHED' THEN CURRENT_TIMESTAMP
      WHEN p_to_status = 'PUBLISHED' THEN NULL
      ELSE "unpublishedAt"
    END,
    "completedAt" = CASE WHEN p_to_status = 'COMPLETED' THEN CURRENT_TIMESTAMP ELSE "completedAt" END
  WHERE "id" = p_listing_id;

  IF p_to_status = 'PUBLISHED' THEN
    UPDATE public."Unit"
    SET "status" = 'PUBLISHED'
    WHERE "id" = v_listing."unitId"
      AND "organizationId" = v_listing."organizationId"
      AND "status" IN ('DRAFT', 'NOT_PUBLISHED', 'UPCOMING', 'PUBLISHED');

    UPDATE public."ListingPublication"
    SET "publishedAt" = CURRENT_TIMESTAMP, "unpublishedAt" = NULL
    WHERE "listingId" = p_listing_id AND "channel" = 'web';
    IF NOT FOUND THEN
      INSERT INTO public."ListingPublication" (
        "listingId", "channel", "publishedAt", "unpublishedAt"
      ) VALUES (
        p_listing_id, 'web', CURRENT_TIMESTAMP, NULL
      );
    END IF;
  ELSIF p_to_status IN ('UNPUBLISHED', 'COMPLETED') THEN
    UPDATE public."ListingPublication"
    SET "unpublishedAt" = CURRENT_TIMESTAMP
    WHERE "listingId" = p_listing_id AND "unpublishedAt" IS NULL;
  END IF;

  PERFORM public.write_audit_event(
    v_listing."organizationId",
    'listing_status_changed',
    'listing',
    p_listing_id,
    jsonb_build_object('status', v_listing."status"),
    jsonb_build_object('status', p_to_status)
  );
  PERFORM public.enqueue_outbox_event(
    v_listing."organizationId",
    'listing.status_changed',
    'listing',
    p_listing_id,
    NULL,
    jsonb_build_object(
      'listingId', p_listing_id,
      'fromStatus', v_listing."status",
      'toStatus', p_to_status
    ),
    'listing.status:' || p_listing_id || ':' || p_to_status::text || ':' || gen_random_uuid()::text
  );

  RETURN jsonb_build_object(
    'listingId', p_listing_id,
    'unitId', v_listing."unitId",
    'slug', v_listing."slug",
    'title', v_listing."title",
    'fromStatus', v_listing."status",
    'status', p_to_status
  );
END
$function$;

CREATE FUNCTION public.complete_unit_listings(
  p_unit_id text,
  p_reason text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  v_unit public."Unit"%ROWTYPE;
  v_listing record;
  v_count integer := 0;
BEGIN
  SELECT * INTO v_unit
  FROM public."Unit"
  WHERE "id" = p_unit_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unit_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF auth.role() <> 'service_role'
     AND public.current_app_organization_id() IS DISTINCT FROM v_unit."organizationId" THEN
    RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501';
  END IF;
  IF auth.role() <> 'service_role' AND NOT public.app_has_permission('listings:update') THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;

  FOR v_listing IN
    SELECT *
    FROM public."Listing"
    WHERE "unitId" = p_unit_id
      AND "organizationId" = v_unit."organizationId"
      AND "status" IN ('PUBLISHED', 'PAUSED', 'SCHEDULED')
    FOR UPDATE
  LOOP
    UPDATE public."Listing"
    SET "status" = 'COMPLETED', "completedAt" = CURRENT_TIMESTAMP
    WHERE "id" = v_listing."id";
    UPDATE public."ListingPublication"
    SET "unpublishedAt" = CURRENT_TIMESTAMP
    WHERE "listingId" = v_listing."id" AND "unpublishedAt" IS NULL;
    PERFORM public.write_audit_event(
      v_unit."organizationId",
      'listing_auto_unpublished',
      'listing',
      v_listing."id",
      jsonb_build_object('status', v_listing."status"),
      jsonb_build_object('status', 'COMPLETED', 'reason', p_reason),
      'system'
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END
$function$;

CREATE FUNCTION public.change_contract_status(
  p_contract_id text,
  p_expected_status public."ContractStatus",
  p_to_status public."ContractStatus",
  p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  v_contract public."Contract"%ROWTYPE;
  v_allowed boolean := false;
  v_user_id text := public.current_app_user_id();
BEGIN
  SELECT * INTO v_contract
  FROM public."Contract"
  WHERE "id" = p_contract_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'contract_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF auth.role() <> 'service_role'
     AND public.current_app_organization_id() IS DISTINCT FROM v_contract."organizationId" THEN
    RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501';
  END IF;
  IF auth.role() <> 'service_role' AND NOT public.app_has_permission('contracts:update') THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;
  IF v_contract."status" IS DISTINCT FROM p_expected_status THEN
    RAISE EXCEPTION 'optimistic_lock_conflict' USING ERRCODE = '40001';
  END IF;

  -- Signing, activation, termination and move-out are protected by their
  -- specialized evidence/idempotency commands.
  IF p_to_status IN ('SENT_FOR_SIGNING', 'PARTIALLY_SIGNED', 'SIGNED', 'ACTIVE', 'TERMINATED', 'ENDED') THEN
    RAISE EXCEPTION 'dedicated_contract_command_required' USING ERRCODE = '55000';
  END IF;

  v_allowed := CASE v_contract."status"
    WHEN 'DRAFT' THEN p_to_status IN ('INTERNAL_REVIEW', 'APPROVED', 'ARCHIVED')
    WHEN 'INTERNAL_REVIEW' THEN p_to_status IN ('APPROVED', 'DRAFT')
    WHEN 'APPROVED' THEN p_to_status = 'DRAFT'
    WHEN 'SENT_FOR_SIGNING' THEN p_to_status = 'DRAFT'
    WHEN 'PARTIALLY_SIGNED' THEN p_to_status = 'DRAFT'
    WHEN 'ACTIVE' THEN p_to_status = 'RESCINDED'
    WHEN 'RESCINDED' THEN p_to_status = 'ARCHIVED'
    ELSE false
  END;
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'invalid_contract_transition' USING ERRCODE = '22023';
  END IF;

  UPDATE public."Contract"
  SET
    "status" = p_to_status,
    "version" = "version" + 1
  WHERE "id" = p_contract_id;

  INSERT INTO public."ContractStatusEvent" (
    "contractId", "fromStatus", "toStatus", "comment", "changedByUserId"
  ) VALUES (
    p_contract_id, v_contract."status", p_to_status, p_comment, v_user_id
  );

  PERFORM public.write_audit_event(
    v_contract."organizationId",
    'contract_status_changed',
    'contract',
    p_contract_id,
    jsonb_build_object('status', v_contract."status", 'version', v_contract."version"),
    jsonb_build_object('status', p_to_status, 'version', v_contract."version" + 1)
  );

  RETURN jsonb_build_object(
    'contractId', p_contract_id,
    'contractNumber', v_contract."contractNumber",
    'unitId', v_contract."unitId",
    'fromStatus', v_contract."status",
    'status', p_to_status,
    'version', v_contract."version" + 1
  );
END
$function$;

REVOKE ALL ON FUNCTION public.change_application_status(text,public."ApplicationStatus",public."ApplicationStatus",text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.change_listing_status(text,public."ListingStatus",public."ListingStatus") FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_unit_listings(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.change_contract_status(text,public."ContractStatus",public."ContractStatus",text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.change_application_status(text,public."ApplicationStatus",public."ApplicationStatus",text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.change_listing_status(text,public."ListingStatus",public."ListingStatus") TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_unit_listings(text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.change_contract_status(text,public."ContractStatus",public."ContractStatus",text) TO authenticated, service_role;

COMMIT;
