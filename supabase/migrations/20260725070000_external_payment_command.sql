-- Atomic idempotent accounting payment import and invoice allocation.

BEGIN;
SET LOCAL search_path = public, extensions;

CREATE FUNCTION public.apply_external_payment(
  p_organization_id text,
  p_external_system text,
  p_external_payment_id text,
  p_external_invoice_id text,
  p_amount numeric,
  p_currency text,
  p_paid_at timestamp without time zone,
  p_method text,
  p_reference text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_claim_id text := gen_random_uuid()::text;
  v_invoice_id text;
  v_invoice public."Invoice"%ROWTYPE;
  v_payment_id text := gen_random_uuid()::text;
  v_paid numeric;
  v_new_status public."InvoiceStatus";
  v_transition_allowed boolean := false;
BEGIN
  INSERT INTO public."ExternalReference" (
    "id", "organizationId", "externalSystem", "entityType", "externalId",
    "syncStatus", "lastSyncedAt"
  ) VALUES (
    v_claim_id, p_organization_id, p_external_system, 'payment',
    p_external_payment_id, 'processing', CURRENT_TIMESTAMP
  )
  ON CONFLICT ("organizationId", "externalSystem", "entityType", "externalId")
  DO NOTHING;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'skipped'); END IF;

  SELECT er."invoiceId" INTO v_invoice_id
  FROM public."ExternalReference" er
  WHERE er."organizationId" = p_organization_id
    AND er."externalSystem" = p_external_system
    AND er."entityType" = 'invoice'
    AND er."externalId" = p_external_invoice_id;
  IF v_invoice_id IS NULL THEN
    DELETE FROM public."ExternalReference" WHERE "id" = v_claim_id;
    RETURN jsonb_build_object('status', 'review');
  END IF;

  SELECT * INTO v_invoice
  FROM public."Invoice"
  WHERE "id" = v_invoice_id AND "organizationId" = p_organization_id
  FOR UPDATE;
  IF NOT FOUND THEN
    DELETE FROM public."ExternalReference" WHERE "id" = v_claim_id;
    RETURN jsonb_build_object('status', 'review');
  END IF;

  INSERT INTO public."Payment" (
    "id", "organizationId", "amount", "currency", "paidAt", "method", "reference"
  ) VALUES (
    v_payment_id, p_organization_id, p_amount, p_currency, p_paid_at, p_method, p_reference
  );
  INSERT INTO public."PaymentAllocation" ("paymentId", "invoiceId", "amount")
  VALUES (v_payment_id, v_invoice_id, p_amount);
  UPDATE public."ExternalReference"
  SET "paymentId" = v_payment_id,
      "syncStatus" = 'synced',
      "lastSyncedAt" = CURRENT_TIMESTAMP
  WHERE "id" = v_claim_id;

  SELECT COALESCE(sum(pa."amount"), 0) INTO v_paid
  FROM public."PaymentAllocation" pa
  WHERE pa."invoiceId" = v_invoice_id;
  v_new_status := CASE
    WHEN v_paid >= v_invoice."totalAmount" THEN 'PAID'
    ELSE 'PARTIALLY_PAID'
  END;
  v_transition_allowed := CASE v_invoice."status"
    WHEN 'SENT' THEN v_new_status IN ('PARTIALLY_PAID', 'PAID')
    WHEN 'PARTIALLY_PAID' THEN v_new_status = 'PAID'
    WHEN 'OVERDUE' THEN v_new_status IN ('PARTIALLY_PAID', 'PAID')
    WHEN 'REMINDED' THEN v_new_status IN ('PARTIALLY_PAID', 'PAID')
    WHEN 'COLLECTION' THEN v_new_status IN ('PARTIALLY_PAID', 'PAID')
    ELSE false
  END;

  UPDATE public."Invoice"
  SET "paidAmount" = v_paid,
      "status" = CASE WHEN v_transition_allowed THEN v_new_status ELSE "status" END
  WHERE "id" = v_invoice_id;
  IF v_transition_allowed AND v_invoice."status" <> v_new_status THEN
    INSERT INTO public."InvoiceStatusEvent" (
      "invoiceId", "fromStatus", "toStatus", "source"
    ) VALUES (
      v_invoice_id, v_invoice."status", v_new_status, 'sync'
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'created',
    'paymentId', v_payment_id,
    'invoiceId', v_invoice_id
  );
END
$function$;

REVOKE ALL ON FUNCTION public.apply_external_payment(
  text,text,text,text,numeric,text,timestamp without time zone,text,text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_external_payment(
  text,text,text,text,numeric,text,timestamp without time zone,text,text
) TO service_role;

COMMIT;
