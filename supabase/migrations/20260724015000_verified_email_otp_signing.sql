-- Fastighetsvärd
-- Verified e-mail OTP signing. A signature is accepted only after a short-lived,
-- single-use challenge is verified and is bound to the exact contract version hash.

BEGIN;
SET LOCAL search_path = public, extensions;

CREATE TABLE public."SigningChallenge" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "organizationId" TEXT NOT NULL,
  "signingSessionId" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "contractVersionId" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'EMAIL',
  "destinationHash" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SigningChallenge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SigningChallenge_channel_check" CHECK ("channel" IN ('EMAIL','SMS')),
  CONSTRAINT "SigningChallenge_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"("id") ON DELETE RESTRICT,
  CONSTRAINT "SigningChallenge_signingSessionId_fkey" FOREIGN KEY ("signingSessionId") REFERENCES public."SigningSession"("id") ON DELETE RESTRICT,
  CONSTRAINT "SigningChallenge_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES public."Contract"("id") ON DELETE RESTRICT,
  CONSTRAINT "SigningChallenge_contractVersionId_fkey" FOREIGN KEY ("contractVersionId") REFERENCES public."ContractVersion"("id") ON DELETE RESTRICT,
  CONSTRAINT "SigningChallenge_personId_fkey" FOREIGN KEY ("personId") REFERENCES public."Person"("id") ON DELETE RESTRICT
);

CREATE INDEX "SigningChallenge_person_contract_idx"
  ON public."SigningChallenge"("personId", "contractId", "createdAt" DESC);
CREATE UNIQUE INDEX "SigningChallenge_one_open_per_person_session_key"
  ON public."SigningChallenge"("signingSessionId", "personId")
  WHERE "verifiedAt" IS NULL AND "cancelledAt" IS NULL;

ALTER TABLE public."SigningChallenge" ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.create_signing_challenge(
  p_contract_id text,
  p_person_id text,
  p_code_hash text,
  p_destination_hash text,
  p_expires_at timestamp
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_contract public."Contract"%ROWTYPE;
  v_session public."SigningSession"%ROWTYPE;
  v_version public."ContractVersion"%ROWTYPE;
  v_user public."User"%ROWTYPE;
  v_party public."ContractParty"%ROWTYPE;
  v_id text := gen_random_uuid()::text;
BEGIN
  IF p_expires_at <= CURRENT_TIMESTAMP
     OR p_expires_at > CURRENT_TIMESTAMP + INTERVAL '15 minutes' THEN
    RAISE EXCEPTION 'signing_challenge_expiry_invalid' USING ERRCODE = '22007';
  END IF;
  IF NULLIF(trim(p_code_hash), '') IS NULL OR NULLIF(trim(p_destination_hash), '') IS NULL THEN
    RAISE EXCEPTION 'signing_challenge_hashes_required' USING ERRCODE = '22023';
  END IF;
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_contract FROM public."Contract" WHERE "id" = p_contract_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'contract_not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_contract."status" NOT IN ('SENT_FOR_SIGNING','PARTIALLY_SIGNED') THEN
    RAISE EXCEPTION 'contract_not_open_for_signing' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_party FROM public."ContractParty"
  WHERE "contractId" = p_contract_id AND "personId" = p_person_id AND "requiredSignature" = true
  FOR UPDATE;
  IF NOT FOUND OR v_party."signedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'contract_party_not_signable' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_user FROM public."User"
  WHERE "personId" = p_person_id AND "organizationId" = v_contract."organizationId" AND "isActive" = true
  FOR UPDATE;
  IF NOT FOUND OR v_user."emailVerifiedAt" IS NULL THEN
    RAISE EXCEPTION 'verified_email_required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_session FROM public."SigningSession"
  WHERE "contractId" = p_contract_id AND "status" = 'OPEN' AND "expiresAt" > CURRENT_TIMESTAMP
  ORDER BY "createdAt" DESC
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'open_signing_session_missing' USING ERRCODE = 'P0002'; END IF;

  SELECT * INTO v_version FROM public."ContractVersion" WHERE "id" = v_session."contractVersionId";
  IF NOT FOUND OR v_version."documentHash" IS NULL THEN
    RAISE EXCEPTION 'signable_document_hash_missing' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public."SigningChallenge"
  SET "cancelledAt" = CURRENT_TIMESTAMP
  WHERE "signingSessionId" = v_session."id"
    AND "personId" = p_person_id
    AND "verifiedAt" IS NULL
    AND "cancelledAt" IS NULL;

  INSERT INTO public."SigningChallenge" (
    "id", "organizationId", "signingSessionId", "contractId", "contractVersionId",
    "personId", "destinationHash", "codeHash", "expiresAt"
  ) VALUES (
    v_id, v_contract."organizationId", v_session."id", p_contract_id,
    v_session."contractVersionId", p_person_id, p_destination_hash, p_code_hash, p_expires_at
  );

  INSERT INTO public."AuditEvent" (
    "organizationId", "userId", "actorType", "actorId", "action", "entityType", "entityId", "after"
  ) VALUES (
    v_contract."organizationId", v_user."id", 'system', 'signing_challenge',
    'signing_challenge_created', 'signing_challenge', v_id,
    jsonb_build_object('contractId', p_contract_id, 'personId', p_person_id,
      'contractVersionId', v_session."contractVersionId", 'expiresAt', p_expires_at)
  );

  RETURN jsonb_build_object(
    'challengeId', v_id,
    'signingSessionId', v_session."id",
    'contractVersionId', v_session."contractVersionId",
    'documentHash', v_version."documentHash",
    'email', v_user."email",
    'expiresAt', p_expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_signing_challenge(
  p_challenge_id text,
  p_person_id text,
  p_code_hash text,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_challenge public."SigningChallenge"%ROWTYPE;
  v_version public."ContractVersion"%ROWTYPE;
  v_result jsonb;
BEGIN
  IF auth.role() <> 'service_role' AND public.current_app_person_id() IS DISTINCT FROM p_person_id THEN
    RAISE EXCEPTION 'person_mismatch' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_challenge
  FROM public."SigningChallenge"
  WHERE "id" = p_challenge_id AND "personId" = p_person_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'signing_challenge_not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_challenge."verifiedAt" IS NOT NULL THEN
    SELECT jsonb_build_object(
      'signatureId', cs."id", 'contractId', cs."contractId", 'status', c."status",
      'ok', true, 'challengeId', p_challenge_id, 'authenticationMethod', 'email_otp', 'isReplay', true
    ) INTO v_result
    FROM public."ContractSignature" cs
    JOIN public."Contract" c ON c."id" = cs."contractId"
    WHERE cs."providerReference" = p_challenge_id AND cs."personId" = p_person_id
    ORDER BY cs."createdAt" DESC LIMIT 1;
    IF v_result IS NOT NULL THEN RETURN v_result; END IF;
    RAISE EXCEPTION 'signing_challenge_already_used' USING ERRCODE = '23505';
  END IF;
  IF v_challenge."cancelledAt" IS NOT NULL THEN RAISE EXCEPTION 'signing_challenge_cancelled' USING ERRCODE = 'P0001'; END IF;
  IF v_challenge."expiresAt" <= CURRENT_TIMESTAMP THEN RAISE EXCEPTION 'signing_challenge_expired' USING ERRCODE = 'P0001'; END IF;
  IF v_challenge."attemptCount" >= v_challenge."maxAttempts" THEN RAISE EXCEPTION 'signing_challenge_locked' USING ERRCODE = '42501'; END IF;

  UPDATE public."SigningChallenge"
  SET "attemptCount" = "attemptCount" + 1
  WHERE "id" = p_challenge_id
  RETURNING * INTO v_challenge;

  -- Expected verification failures are returned rather than raised. Raising
  -- would roll back attemptCount and make the lockout ineffective.
  IF v_challenge."codeHash" <> p_code_hash THEN
    IF v_challenge."attemptCount" >= v_challenge."maxAttempts" THEN
      RETURN jsonb_build_object('ok', false, 'error', 'signing_challenge_locked', 'attemptsRemaining', 0);
    END IF;
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'invalid_signing_code',
      'attemptsRemaining', v_challenge."maxAttempts" - v_challenge."attemptCount"
    );
  END IF;

  SELECT * INTO v_version FROM public."ContractVersion" WHERE "id" = v_challenge."contractVersionId";
  IF NOT FOUND OR v_version."documentHash" IS NULL THEN RAISE EXCEPTION 'contract_version_not_signable' USING ERRCODE = 'P0001'; END IF;

  UPDATE public."SigningChallenge" SET "verifiedAt" = CURRENT_TIMESTAMP WHERE "id" = p_challenge_id;

  v_result := public.record_contract_signature(
    v_challenge."signingSessionId",
    p_person_id,
    v_version."documentHash",
    'email_otp',
    p_challenge_id,
    p_ip,
    p_user_agent,
    jsonb_build_object(
      'challengeId', p_challenge_id,
      'channel', v_challenge."channel",
      'destinationHash', v_challenge."destinationHash",
      'verifiedAt', CURRENT_TIMESTAMP
    )
  );
  RETURN v_result || jsonb_build_object('ok', true, 'challengeId', p_challenge_id, 'authenticationMethod', 'email_otp');
END;
$$;

REVOKE ALL ON public."SigningChallenge" FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.create_signing_challenge(text,text,text,text,timestamp) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_signing_challenge(text,text,text,text,timestamp) TO service_role;
REVOKE ALL ON FUNCTION public.verify_signing_challenge(text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_signing_challenge(text,text,text,text,text) TO authenticated, service_role;

COMMIT;
