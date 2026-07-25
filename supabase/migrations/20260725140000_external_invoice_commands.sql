BEGIN;

CREATE OR REPLACE FUNCTION public.queue_sync_review(
  p_organization_id text,
  p_sync_job_id text,
  p_entity_type text,
  p_external_system text,
  p_external_id text,
  p_payload jsonb,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item public."SyncReviewItem"%ROWTYPE;
BEGIN
  PERFORM public.assert_service_role();
  PERFORM pg_advisory_xact_lock(hashtextextended(
    concat_ws(':', p_organization_id, p_external_system, p_entity_type, p_external_id),
    0
  ));
  SELECT * INTO v_item
  FROM public."SyncReviewItem"
  WHERE "organizationId" = p_organization_id
    AND "externalSystem" = p_external_system
    AND "entityType" = p_entity_type
    AND "externalId" = p_external_id
    AND status = 'PENDING'
  ORDER BY "createdAt", id
  LIMIT 1
  FOR UPDATE;
  IF FOUND THEN RETURN to_jsonb(v_item); END IF;

  INSERT INTO public."SyncReviewItem" (
    id, "organizationId", "syncJobId", "entityType", "externalSystem",
    "externalId", payload, reason, status
  ) VALUES (
    gen_random_uuid()::text, p_organization_id, p_sync_job_id, p_entity_type,
    p_external_system, p_external_id, p_payload, p_reason, 'PENDING'
  )
  RETURNING * INTO v_item;
  RETURN to_jsonb(v_item);
END;
$$;

CREATE OR REPLACE FUNCTION public.persist_external_invoice(
  p_organization_id text,
  p_external_system text,
  p_entity_type text,
  p_external_id text,
  p_person_id text,
  p_contract_id text,
  p_unit_id text,
  p_credits_invoice_id text,
  p_status public."InvoiceStatus",
  p_invoice jsonb,
  p_source_version text DEFAULT NULL,
  p_source_updated_at timestamp without time zone DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reference public."ExternalReference"%ROWTYPE;
  v_invoice public."Invoice"%ROWTYPE;
  v_invoice_id text;
  v_status_allowed boolean;
  v_line jsonb;
  v_index integer := 0;
BEGIN
  PERFORM public.assert_service_role();
  SELECT * INTO v_reference
  FROM public."ExternalReference"
  WHERE "organizationId" = p_organization_id
    AND "externalSystem" = p_external_system
    AND "entityType" = p_entity_type
    AND "externalId" = p_external_id
  FOR UPDATE;

  IF FOUND AND v_reference."invoiceId" IS NOT NULL THEN
    SELECT * INTO v_invoice
    FROM public."Invoice"
    WHERE id = v_reference."invoiceId" AND "organizationId" = p_organization_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'referenced_invoice_not_found'; END IF;
    v_status_allowed := v_invoice.status = p_status OR CASE v_invoice.status
      WHEN 'DRAFT' THEN p_status IN ('SENT', 'CANCELLED')
      WHEN 'SENT' THEN p_status IN ('PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CREDITED', 'CANCELLED', 'DISPUTED')
      WHEN 'PARTIALLY_PAID' THEN p_status IN ('PAID', 'OVERDUE', 'CREDITED', 'DISPUTED')
      WHEN 'PAID' THEN p_status IN ('CREDITED')
      WHEN 'OVERDUE' THEN p_status IN ('REMINDED', 'PARTIALLY_PAID', 'PAID', 'COLLECTION', 'CREDITED', 'DISPUTED')
      WHEN 'REMINDED' THEN p_status IN ('PARTIALLY_PAID', 'PAID', 'COLLECTION', 'CREDITED', 'DISPUTED')
      WHEN 'COLLECTION' THEN p_status IN ('PAID', 'PARTIALLY_PAID', 'CREDITED')
      WHEN 'DISPUTED' THEN p_status IN ('SENT', 'PAID', 'CREDITED', 'CANCELLED')
      ELSE false
    END;
    UPDATE public."Invoice"
    SET status = CASE WHEN v_status_allowed THEN p_status ELSE status END,
        "paidAmount" = coalesce((p_invoice->>'paidAmount')::numeric, "paidAmount"),
        "dueDate" = coalesce((p_invoice->>'dueDate')::timestamp, "dueDate"),
        ocr = coalesce(nullif(p_invoice->>'ocr', ''), ocr),
        reference = coalesce(nullif(p_invoice->>'reference', ''), reference),
        "updatedAt" = now()
    WHERE id = v_invoice.id;
    IF v_invoice.status <> p_status AND v_status_allowed THEN
      INSERT INTO public."InvoiceStatusEvent" (
        id, "invoiceId", "fromStatus", "toStatus", source
      ) VALUES (
        gen_random_uuid()::text, v_invoice.id, v_invoice.status, p_status, 'sync'
      );
    END IF;
    UPDATE public."ExternalReference"
    SET "lastSyncedAt" = now(),
        "syncStatus" = 'synced',
        "sourceVersion" = p_source_version,
        "sourceUpdatedAt" = p_source_updated_at,
        "updatedAt" = now()
    WHERE id = v_reference.id;
    RETURN jsonb_build_object(
      'status', 'updated',
      'invoiceId', v_invoice.id,
      'statusConflict', NOT v_status_allowed,
      'internalStatus', v_invoice.status,
      'externalStatus', p_status
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM public."Invoice"
    WHERE "organizationId" = p_organization_id
      AND "invoiceNumber" = p_invoice->>'invoiceNumber'
  ) THEN
    RETURN jsonb_build_object('status', 'review', 'reason', 'duplicate_invoice_number');
  END IF;

  v_invoice_id := gen_random_uuid()::text;
  INSERT INTO public."Invoice" (
    id, "organizationId", "personId", "contractId", "unitId", "invoiceNumber",
    status, "invoiceDate", "dueDate", "periodStart", "periodEnd", "totalAmount",
    "vatAmount", "paidAmount", currency, ocr, bankgiro, reference,
    "isCreditNote", "creditsInvoiceId"
  ) VALUES (
    v_invoice_id, p_organization_id, p_person_id, p_contract_id, p_unit_id,
    p_invoice->>'invoiceNumber', p_status,
    (p_invoice->>'invoiceDate')::timestamp,
    (p_invoice->>'dueDate')::timestamp,
    nullif(p_invoice->>'periodStart', '')::timestamp,
    nullif(p_invoice->>'periodEnd', '')::timestamp,
    (p_invoice->>'totalAmount')::numeric,
    coalesce((p_invoice->>'vatAmount')::numeric, 0),
    coalesce((p_invoice->>'paidAmount')::numeric, 0),
    coalesce(nullif(p_invoice->>'currency', ''), 'SEK'),
    nullif(p_invoice->>'ocr', ''),
    nullif(p_invoice->>'bankgiro', ''),
    nullif(p_invoice->>'reference', ''),
    coalesce((p_invoice->>'isCreditNote')::boolean, false),
    p_credits_invoice_id
  );
  FOR v_line IN SELECT value FROM jsonb_array_elements(coalesce(p_invoice->'lines', '[]'::jsonb))
  LOOP
    INSERT INTO public."InvoiceLine" (
      id, "invoiceId", description, quantity, "unitPrice", "vatRate", amount, "sortOrder"
    ) VALUES (
      gen_random_uuid()::text, v_invoice_id, v_line->>'description',
      (v_line->>'quantity')::numeric, (v_line->>'unitPrice')::numeric,
      (v_line->>'vatRate')::numeric, (v_line->>'amount')::numeric, v_index
    );
    v_index := v_index + 1;
  END LOOP;
  INSERT INTO public."InvoiceStatusEvent" (id, "invoiceId", "toStatus", source)
  VALUES (gen_random_uuid()::text, v_invoice_id, p_status, 'sync');
  INSERT INTO public."ExternalReference" (
    id, "organizationId", "externalSystem", "entityType", "externalId",
    "invoiceId", "syncStatus", "lastSyncedAt", "sourceVersion", "sourceUpdatedAt"
  ) VALUES (
    gen_random_uuid()::text, p_organization_id, p_external_system, p_entity_type,
    p_external_id, v_invoice_id, 'synced', now(), p_source_version, p_source_updated_at
  );
  RETURN jsonb_build_object('status', 'created', 'invoiceId', v_invoice_id);
END;
$$;

REVOKE ALL ON FUNCTION public.queue_sync_review(text,text,text,text,text,jsonb,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.persist_external_invoice(text,text,text,text,text,text,text,text,public."InvoiceStatus",jsonb,text,timestamp without time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_sync_review(text,text,text,text,text,jsonb,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.persist_external_invoice(text,text,text,text,text,text,text,text,public."InvoiceStatus",jsonb,text,timestamp without time zone) TO service_role;

COMMIT;
