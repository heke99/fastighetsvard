BEGIN;

CREATE OR REPLACE FUNCTION public.claim_webhook_deliveries(p_limit integer DEFAULT 50)
RETURNS TABLE(id text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.assert_service_role();
  RETURN QUERY
  WITH due AS (
    SELECT wd.id
    FROM public."WebhookDelivery" wd
    WHERE wd.status IN ('PENDING', 'FAILED')
      AND wd."nextAttemptAt" <= now()
    ORDER BY wd."nextAttemptAt", wd.id
    FOR UPDATE SKIP LOCKED
    LIMIT greatest(1, least(coalesce(p_limit, 50), 200))
  )
  UPDATE public."WebhookDelivery" wd
  SET "nextAttemptAt" = now() + interval '2 minutes',
      "updatedAt" = now()
  FROM due
  WHERE wd.id = due.id
  RETURNING wd.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_webhook_delivery_attempt(
  p_delivery_id text,
  p_expected_attempts integer,
  p_success boolean,
  p_status_code integer DEFAULT NULL,
  p_error text DEFAULT NULL,
  p_next_attempt_at timestamp without time zone DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_delivery public."WebhookDelivery"%ROWTYPE;
  v_subscription public."WebhookSubscription"%ROWTYPE;
  v_attempt integer;
  v_failures integer;
  v_dead_letter boolean;
BEGIN
  PERFORM public.assert_service_role();
  SELECT * INTO v_delivery
  FROM public."WebhookDelivery"
  WHERE id = p_delivery_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'delivery_not_found'; END IF;
  IF v_delivery.attempts <> p_expected_attempts
     OR v_delivery.status IN ('DELIVERED', 'DEAD_LETTER') THEN
    RETURN jsonb_build_object('status', 'stale');
  END IF;
  SELECT * INTO v_subscription
  FROM public."WebhookSubscription"
  WHERE id = v_delivery."subscriptionId"
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'subscription_not_found'; END IF;

  v_attempt := v_delivery.attempts + 1;
  IF p_success THEN
    UPDATE public."WebhookDelivery"
    SET status = 'DELIVERED',
        attempts = v_attempt,
        "lastAttemptAt" = now(),
        "lastStatusCode" = p_status_code,
        "deliveredAt" = now(),
        "nextAttemptAt" = NULL,
        "lastError" = NULL,
        "updatedAt" = now()
    WHERE id = p_delivery_id;
    UPDATE public."WebhookSubscription"
    SET "consecutiveFailures" = 0, "updatedAt" = now()
    WHERE id = v_subscription.id;
    RETURN jsonb_build_object('status', 'delivered', 'attempts', v_attempt);
  END IF;

  v_dead_letter := v_attempt >= 6;
  UPDATE public."WebhookDelivery"
  SET status = CASE WHEN v_dead_letter THEN 'DEAD_LETTER' ELSE 'FAILED' END,
      attempts = v_attempt,
      "lastAttemptAt" = now(),
      "lastStatusCode" = p_status_code,
      "lastError" = left(p_error, 2000),
      "nextAttemptAt" = CASE WHEN v_dead_letter THEN NULL ELSE p_next_attempt_at END,
      "updatedAt" = now()
  WHERE id = p_delivery_id;

  UPDATE public."WebhookSubscription"
  SET "consecutiveFailures" = "consecutiveFailures" + 1,
      "updatedAt" = now()
  WHERE id = v_subscription.id
  RETURNING "consecutiveFailures" INTO v_failures;

  IF v_failures >= 20 AND v_subscription."isActive" THEN
    UPDATE public."WebhookSubscription"
    SET "isActive" = false,
        "disabledAt" = now(),
        "disabledReason" = format(
          'Avstängd automatiskt efter %s misslyckade leveranser i rad.',
          v_failures
        ),
        "updatedAt" = now()
    WHERE id = v_subscription.id;
    INSERT INTO public."AuditEvent" (
      id, "organizationId", "actorType", action, "entityType", "entityId"
    ) VALUES (
      gen_random_uuid()::text, v_delivery."organizationId", 'system',
      'webhook_subscription_disabled', 'webhook_subscription', v_subscription.id
    );
  END IF;
  RETURN jsonb_build_object(
    'status', CASE WHEN v_dead_letter THEN 'dead_letter' ELSE 'failed' END,
    'attempts', v_attempt,
    'consecutiveFailures', v_failures
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_webhook_deliveries(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_webhook_delivery_attempt(text,integer,boolean,integer,text,timestamp without time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_webhook_deliveries(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_webhook_delivery_attempt(text,integer,boolean,integer,text,timestamp without time zone) TO service_role;

COMMIT;
