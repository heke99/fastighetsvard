-- Database-backed distributed rate limiting for serverless/API entry points.
BEGIN;
SET LOCAL search_path = public;

CREATE TABLE public."RateLimitBucket" (
  "scope" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "bucketStartedAt" TIMESTAMP(3) NOT NULL,
  "requestCount" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("scope", "subject"),
  CONSTRAINT "RateLimitBucket_requestCount_check" CHECK ("requestCount" >= 0)
);
ALTER TABLE public."RateLimitBucket" ENABLE ROW LEVEL SECURITY;

CREATE INDEX "RateLimitBucket_updatedAt_idx" ON public."RateLimitBucket"("updatedAt");

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_scope text,
  p_subject text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_now timestamp := CURRENT_TIMESTAMP;
  v_bucket public."RateLimitBucket"%ROWTYPE;
  v_window integer := GREATEST(1, LEAST(p_window_seconds, 86400));
  v_limit integer := GREATEST(1, LEAST(p_limit, 100000));
  v_allowed boolean;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;
  IF p_scope IS NULL OR btrim(p_scope) = '' OR p_subject IS NULL OR btrim(p_subject) = '' THEN
    RAISE EXCEPTION 'rate_limit_scope_and_subject_required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public."RateLimitBucket" (
    "scope", "subject", "bucketStartedAt", "requestCount", "updatedAt"
  ) VALUES (p_scope, p_subject, v_now, 1, v_now)
  ON CONFLICT ("scope", "subject") DO UPDATE
  SET "bucketStartedAt" = CASE
        WHEN public."RateLimitBucket"."bucketStartedAt" + make_interval(secs => v_window) <= v_now
        THEN v_now ELSE public."RateLimitBucket"."bucketStartedAt" END,
      "requestCount" = CASE
        WHEN public."RateLimitBucket"."bucketStartedAt" + make_interval(secs => v_window) <= v_now
        THEN 1 ELSE public."RateLimitBucket"."requestCount" + 1 END,
      "updatedAt" = v_now
  RETURNING * INTO v_bucket;

  v_allowed := v_bucket."requestCount" <= v_limit;
  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'limit', v_limit,
    'remaining', GREATEST(0, v_limit - v_bucket."requestCount"),
    'resetAt', v_bucket."bucketStartedAt" + make_interval(secs => v_window)
  );
END;
$$;

REVOKE ALL ON public."RateLimitBucket" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_rate_limit(text,text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text,text,integer,integer) TO service_role;

COMMIT;
