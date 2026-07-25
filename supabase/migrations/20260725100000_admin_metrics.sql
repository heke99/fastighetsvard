BEGIN;

CREATE OR REPLACE FUNCTION public.admin_dashboard_metrics(
  p_organization_id text,
  p_now timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_report_metrics(
  p_organization_id text,
  p_now timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.assert_service_role();
  RETURN jsonb_build_object(
    'unitsByStatus', coalesce((
      SELECT jsonb_agg(jsonb_build_object('status', grouped.status, '_count', grouped.total) ORDER BY grouped.status)
      FROM (
        SELECT status::text AS status, count(*) AS total
        FROM public."Unit"
        WHERE "organizationId" = p_organization_id
        GROUP BY status
      ) grouped
    ), '[]'::jsonb),
    'applicationsByStatus', coalesce((
      SELECT jsonb_agg(jsonb_build_object('status', grouped.status, '_count', grouped.total) ORDER BY grouped.status)
      FROM (
        SELECT status::text AS status, count(*) AS total
        FROM public."Application"
        WHERE "organizationId" = p_organization_id
        GROUP BY status
      ) grouped
    ), '[]'::jsonb),
    'maintenanceByStatus', coalesce((
      SELECT jsonb_agg(jsonb_build_object('status', grouped.status, '_count', grouped.total) ORDER BY grouped.status)
      FROM (
        SELECT status::text AS status, count(*) AS total
        FROM public."MaintenanceRequest"
        WHERE "organizationId" = p_organization_id
        GROUP BY status
      ) grouped
    ), '[]'::jsonb),
    'invoiceAgg', jsonb_build_object(
      '_count', (SELECT count(*) FROM public."Invoice" WHERE "organizationId" = p_organization_id AND "isCreditNote" = false),
      '_sum', jsonb_build_object(
        'totalAmount', (SELECT coalesce(sum("totalAmount"), 0) FROM public."Invoice" WHERE "organizationId" = p_organization_id AND "isCreditNote" = false),
        'paidAmount', (SELECT coalesce(sum("paidAmount"), 0) FROM public."Invoice" WHERE "organizationId" = p_organization_id AND "isCreditNote" = false)
      )
    ),
    'overdueAgg', jsonb_build_object(
      '_count', (SELECT count(*) FROM public."Invoice" WHERE "organizationId" = p_organization_id AND status IN ('OVERDUE', 'REMINDED', 'COLLECTION')),
      '_sum', jsonb_build_object(
        'totalAmount', (SELECT coalesce(sum("totalAmount"), 0) FROM public."Invoice" WHERE "organizationId" = p_organization_id AND status IN ('OVERDUE', 'REMINDED', 'COLLECTION')),
        'paidAmount', (SELECT coalesce(sum("paidAmount"), 0) FROM public."Invoice" WHERE "organizationId" = p_organization_id AND status IN ('OVERDUE', 'REMINDED', 'COLLECTION'))
      )
    ),
    'workOrderCosts', jsonb_build_object(
      '_count', (SELECT count(*) FROM public."WorkOrder" WHERE "organizationId" = p_organization_id),
      '_sum', jsonb_build_object(
        'cost', (SELECT coalesce(sum(cost), 0) FROM public."WorkOrder" WHERE "organizationId" = p_organization_id)
      )
    ),
    'moveIns', (SELECT count(*) FROM public."Contract" WHERE "organizationId" = p_organization_id AND status IN ('SIGNED', 'ACTIVE') AND "startDate" >= (p_now - interval '90 days')::date),
    'moveOuts', (SELECT count(*) FROM public."Termination" WHERE "organizationId" = p_organization_id AND "requestedAt" >= p_now - interval '90 days'),
    'listingStats', jsonb_build_object('_count', (SELECT count(*) FROM public."Listing" WHERE "organizationId" = p_organization_id))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_dashboard_metrics(text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_report_metrics(text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_metrics(text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_report_metrics(text, timestamptz) TO service_role;

COMMIT;
