-- FaddeBo login and dashboard runtime repair.
--
-- Repairs two production failures:
--   1. admin_dashboard_metrics() called a missing assert_service_role() helper
--      and failed with PostgreSQL 42883.
--   2. record_current_login() allowed a legacy AuditEvent schema mismatch to
--      abort the audit RPC with PostgreSQL 23502.
--
-- The canonical authentication session must remain usable even if an
-- auxiliary audit insert cannot be written. Dashboard metrics remain protected
-- by a service-role assertion.

BEGIN;
SET LOCAL search_path = public, auth, extensions;

CREATE OR REPLACE FUNCTION public.assert_service_role()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, auth, pg_temp
AS $function$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required'
      USING ERRCODE = '42501';
  END IF;
END
$function$;

REVOKE ALL ON FUNCTION public.assert_service_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_service_role() TO service_role;

CREATE OR REPLACE FUNCTION public.record_current_login(p_ip text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $function$
DECLARE
  v_user public."User"%ROWTYPE;
  v_logged_in_at timestamp without time zone := CURRENT_TIMESTAMP;
BEGIN
  SELECT * INTO v_user
  FROM public."User"
  WHERE "authUserId" = auth.uid()
    AND "isActive" = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'inactive_user' USING ERRCODE = '42501';
  END IF;

  UPDATE public."User"
  SET "lastLoginAt" = v_logged_in_at,
      "updatedAt" = v_logged_in_at
  WHERE "id" = v_user."id";

  -- Audit is important, but it is secondary to a valid authenticated session.
  -- Explicit canonical values make the insert independent of legacy defaults.
  -- A legacy-only extra NOT NULL column must not make login unusable.
  BEGIN
    INSERT INTO public."AuditEvent" (
      "id",
      "organizationId",
      "userId",
      "actorType",
      "actorId",
      "action",
      "entityType",
      "entityId",
      "before",
      "after",
      "ip",
      "correlationId",
      "createdAt"
    ) VALUES (
      gen_random_uuid()::text,
      v_user."organizationId",
      v_user."id",
      'user',
      v_user."id",
      'login',
      'user',
      v_user."id",
      NULL,
      jsonb_build_object('lastLoginAt', v_logged_in_at),
      NULLIF(trim(p_ip), ''),
      NULL,
      v_logged_in_at
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'FaddeBo login audit insert skipped: SQLSTATE %, %', SQLSTATE, SQLERRM;
  END;
END
$function$;

REVOKE ALL ON FUNCTION public.record_current_login(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_current_login(text) TO authenticated;

-- Recreate the metrics functions after the service-role helper exists. This
-- also restores the canonical signatures and grants on databases with drift.
CREATE OR REPLACE FUNCTION public.admin_dashboard_metrics(
  p_organization_id text,
  p_now timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $function$
DECLARE
  v_in_30_days timestamptz := p_now + interval '30 days';
BEGIN
  PERFORM public.assert_service_role();

  RETURN jsonb_build_object(
    'totalUnits', (SELECT count(*) FROM public."Unit" WHERE "organizationId" = p_organization_id),
    'rentedUnits', (SELECT count(*) FROM public."Unit" WHERE "organizationId" = p_organization_id AND status = 'RENTED'),
    'availableUnits', (SELECT count(*) FROM public."Unit" WHERE "organizationId" = p_organization_id AND status IN ('PUBLISHED', 'APPLICATION_OPEN')),
    'upcomingUnits', (SELECT count(*) FROM public."Unit" WHERE "organizationId" = p_organization_id AND status = 'UPCOMING'),
    'forSaleUnits', (SELECT count(*) FROM public."Unit" WHERE "organizationId" = p_organization_id AND status IN ('FOR_SALE', 'BIDDING')),
    'publishedListings', (SELECT count(*) FROM public."Listing" WHERE "organizationId" = p_organization_id AND status = 'PUBLISHED'),
    'activeApplications', (SELECT count(*) FROM public."Application" WHERE "organizationId" = p_organization_id AND status NOT IN ('CLOSED', 'WITHDRAWN', 'DECLINED')),
    'contractsAwaitingSignature', (SELECT count(*) FROM public."Contract" WHERE "organizationId" = p_organization_id AND status IN ('SENT_FOR_SIGNING', 'PARTIALLY_SIGNED')),
    'overdueInvoices', (SELECT count(*) FROM public."Invoice" WHERE "organizationId" = p_organization_id AND status IN ('OVERDUE', 'REMINDED', 'COLLECTION')),
    'activeMaintenanceRequests', (SELECT count(*) FROM public."MaintenanceRequest" WHERE "organizationId" = p_organization_id AND status NOT IN ('CLOSED', 'REJECTED')),
    'urgentWorkOrders', (SELECT count(*) FROM public."WorkOrder" WHERE "organizationId" = p_organization_id AND priority = 'URGENT' AND status NOT IN ('DONE', 'APPROVED', 'INVOICED', 'CANCELLED')),
    'upcomingMoveIns', (SELECT count(*) FROM public."Contract" WHERE "organizationId" = p_organization_id AND status IN ('SIGNED', 'ACTIVE') AND "startDate" >= p_now::date AND "startDate" <= v_in_30_days::date),
    'upcomingMoveOuts', (SELECT count(*) FROM public."Termination" WHERE "organizationId" = p_organization_id AND "effectiveEndDate" >= p_now::date AND "effectiveEndDate" <= v_in_30_days::date AND status <> 'CANCELLED'),
    'failedWebhooks', (SELECT count(*) FROM public."WebhookDelivery" WHERE "organizationId" = p_organization_id AND status IN ('FAILED', 'DEAD_LETTER')),
    'pendingReviewItems', (SELECT count(*) FROM public."SyncReviewItem" WHERE "organizationId" = p_organization_id AND status = 'PENDING'),
    'failedSyncJobs', (SELECT count(*) FROM public."IntegrationSyncJob" WHERE "organizationId" = p_organization_id AND status = 'FAILED'),
    'paidAmount', (SELECT coalesce(sum("paidAmount"), 0) FROM public."Invoice" WHERE "organizationId" = p_organization_id AND "isCreditNote" = false)
  );
END
$function$;

REVOKE ALL ON FUNCTION public.admin_dashboard_metrics(text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_metrics(text, timestamptz) TO service_role;

COMMIT;
