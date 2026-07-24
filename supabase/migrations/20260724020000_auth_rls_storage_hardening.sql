-- Fastighetsvärd
-- Verified signup provisioning, atomic invitation claim, append-only audit,
-- row isolation for new domain tables and path-bound private Storage access.

BEGIN;
SET LOCAL search_path = public, extensions;

ALTER TABLE public."Invitation"
  ADD COLUMN "claimAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockedAt" TIMESTAMP(3),
  ADD COLUMN "lastAttemptAt" TIMESTAMP(3);

ALTER TABLE public."Person"
  ADD COLUMN "personalNumberEncrypted" TEXT,
  ADD COLUMN "personalNumberHash" TEXT,
  ADD COLUMN "personalNumberLast4" TEXT,
  ADD COLUMN "personalNumberKeyVersion" INTEGER;

CREATE UNIQUE INDEX "Person_organization_personal_number_hash_key"
  ON public."Person"("organizationId", "personalNumberHash")
  WHERE "personalNumberHash" IS NOT NULL;

CREATE OR REPLACE FUNCTION public.provision_verified_self_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_org_id text;
  v_person_id text := gen_random_uuid()::text;
  v_claim_mode text := COALESCE(NEW.raw_user_meta_data->>'claim_mode', 'self_signup');
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Invitation and staff provisioning are completed by separate, purpose-bound
  -- server operations and must never claim a person by e-mail matching.
  IF v_claim_mode IN ('invitation','staff_invitation','contractor_invitation','bootstrap') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public."User" WHERE "authUserId" = NEW.id) THEN
    UPDATE public."User"
    SET "emailVerifiedAt" = NEW.email_confirmed_at,
        "isActive" = true,
        "email" = lower(NEW.email)
    WHERE "authUserId" = NEW.id;
    RETURN NEW;
  END IF;

  SELECT "id" INTO v_org_id
  FROM public."Organization"
  ORDER BY "createdAt", "id"
  LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'default_organization_missing' USING ERRCODE = 'P0002';
  END IF;

  -- A self-signup always creates a new applicant person. It never auto-links
  -- an imported tenant merely because an e-mail happens to match.
  INSERT INTO public."Person" (
    "id", "organizationId", "firstName", "lastName", "email", "phone"
  ) VALUES (
    v_person_id,
    v_org_id,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'first_name'), ''), 'Okänt'),
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'last_name'), ''), 'namn'),
    lower(NEW.email),
    NULLIF(trim(NEW.raw_user_meta_data->>'phone'), '')
  );

  INSERT INTO public."PersonRole" ("personId", "role")
  VALUES (v_person_id, 'APPLICANT')
  ON CONFLICT DO NOTHING;

  INSERT INTO public."User" (
    "authUserId", "organizationId", "personId", "email", "emailVerifiedAt", "isActive"
  ) VALUES (
    NEW.id, v_org_id, v_person_id, lower(NEW.email), NEW.email_confirmed_at, true
  );

  INSERT INTO public."Notification" (
    "organizationId", "personId", "eventType", "title", "body"
  ) VALUES (
    v_org_id, v_person_id, 'account_verified', 'Kontot är verifierat',
    'Din e-postadress är verifierad och kontot är nu aktivt.'
  );

  INSERT INTO public."AuditEvent" (
    "organizationId", "actorType", "actorId", "action", "entityType", "entityId", "after"
  ) VALUES (
    v_org_id, 'auth_user', NEW.id::text, 'verified_self_signup_provisioned', 'user', NEW.id::text,
    jsonb_build_object('personId', v_person_id, 'emailVerifiedAt', NEW.email_confirmed_at)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "auth_user_verified_provision_profile" ON auth.users;
CREATE TRIGGER "auth_user_verified_provision_profile"
AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.provision_verified_self_signup();

CREATE OR REPLACE FUNCTION public.claim_invitation(
  p_token_hash text,
  p_auth_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_invitation public."Invitation"%ROWTYPE;
  v_auth auth.users%ROWTYPE;
  v_user_id text := gen_random_uuid()::text;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_invitation
  FROM public."Invitation"
  WHERE "tokenHash" = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'invitation_not_found'); END IF;
  IF v_invitation."acceptedAt" IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invitation_already_used');
  END IF;
  IF v_invitation."expiresAt" <= CURRENT_TIMESTAMP THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invitation_expired');
  END IF;
  IF v_invitation."lockedAt" IS NOT NULL OR v_invitation."claimAttempts" >= 8 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invitation_locked');
  END IF;

  UPDATE public."Invitation"
  SET "claimAttempts" = "claimAttempts" + 1,
      "lastAttemptAt" = CURRENT_TIMESTAMP,
      "lockedAt" = CASE WHEN "claimAttempts" + 1 >= 8 THEN CURRENT_TIMESTAMP ELSE "lockedAt" END
  WHERE "id" = v_invitation."id"
  RETURNING * INTO v_invitation;

  SELECT * INTO v_auth FROM auth.users WHERE id = p_auth_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'auth_user_not_found'); END IF;
  IF v_auth.email_confirmed_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'auth_email_not_verified');
  END IF;
  IF lower(v_auth.email) <> lower(v_invitation."email") THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invitation_email_mismatch');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public."User"
    WHERE "authUserId" = p_auth_user_id OR lower("email") = lower(v_invitation."email")
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_already_exists');
  END IF;
  IF v_invitation."claimAttempts" >= 8 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invitation_locked');
  END IF;

  INSERT INTO public."User" (
    "id", "authUserId", "organizationId", "personId", "email", "emailVerifiedAt", "isActive"
  ) VALUES (
    v_user_id, p_auth_user_id, v_invitation."organizationId", v_invitation."personId",
    lower(v_invitation."email"), v_auth.email_confirmed_at, true
  );

  UPDATE public."Invitation"
  SET "acceptedAt" = CURRENT_TIMESTAMP
  WHERE "id" = v_invitation."id" AND "acceptedAt" IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation_claim_race_lost' USING ERRCODE = '40001'; END IF;

  INSERT INTO public."AuditEvent" (
    "organizationId", "userId", "actorType", "actorId", "action", "entityType", "entityId", "after"
  ) VALUES (
    v_invitation."organizationId", v_user_id, 'auth_user', p_auth_user_id::text,
    'invitation_claimed', 'invitation', v_invitation."id",
    jsonb_build_object('personId', v_invitation."personId", 'authUserId', p_auth_user_id)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'userId', v_user_id,
    'personId', v_invitation."personId",
    'organizationId', v_invitation."organizationId",
    'invitationId', v_invitation."id"
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log_is_append_only' USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS "AuditEvent_append_only" ON public."AuditEvent";
CREATE TRIGGER "AuditEvent_append_only"
BEFORE UPDATE OR DELETE ON public."AuditEvent"
FOR EACH ROW EXECUTE FUNCTION public.reject_audit_mutation();

-- New domain table isolation.
CREATE POLICY "application_snapshot_party_or_staff_read" ON public."ApplicationSnapshot" FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."ApplicationMember" am
    WHERE am."applicationId" = "ApplicationSnapshot"."applicationId"
      AND am."personId" = public.current_app_person_id()
  )
  OR ("organizationId" = public.current_app_organization_id() AND public.app_has_permission('applications:read'))
);

CREATE POLICY "reservation_staff_read" ON public."Reservation" FOR SELECT TO authenticated
USING ("organizationId" = public.current_app_organization_id() AND public.app_has_permission('offers:read'));

CREATE POLICY "signing_session_party_or_staff_read" ON public."SigningSession" FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."ContractParty" cp
    WHERE cp."contractId" = "SigningSession"."contractId" AND cp."personId" = public.current_app_person_id()
  )
  OR ("organizationId" = public.current_app_organization_id() AND public.app_has_permission('contracts:read'))
);

CREATE POLICY "signature_owner_or_staff_read" ON public."ContractSignature" FOR SELECT TO authenticated
USING (
  "personId" = public.current_app_person_id()
  OR ("organizationId" = public.current_app_organization_id() AND public.app_has_permission('contracts:read'))
);

CREATE POLICY "evidence_contract_party_or_staff_read" ON public."EvidenceReport" FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."ContractParty" cp
    WHERE cp."contractId" = "EvidenceReport"."contractId" AND cp."personId" = public.current_app_person_id()
  )
  OR ("organizationId" = public.current_app_organization_id() AND public.app_has_permission('contracts:read'))
);

CREATE POLICY "move_in_contract_party_or_staff_read" ON public."MoveInCase" FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public."ContractParty" cp WHERE cp."contractId" = "MoveInCase"."contractId" AND cp."personId" = public.current_app_person_id())
  OR ("organizationId" = public.current_app_organization_id() AND public.app_has_permission('contracts:read'))
);

CREATE POLICY "move_out_contract_party_or_staff_read" ON public."MoveOutCase" FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public."ContractParty" cp WHERE cp."contractId" = "MoveOutCase"."contractId" AND cp."personId" = public.current_app_person_id())
  OR ("organizationId" = public.current_app_organization_id() AND public.app_has_permission('contracts:read'))
);

CREATE POLICY "outbox_staff_read" ON public."OutboxEvent" FOR SELECT TO authenticated
USING ("organizationId" = public.current_app_organization_id() AND public.app_has_permission('system_jobs:read'));

-- Operation idempotency contains request/response data and is intentionally not
-- readable through browser clients. Only SECURITY DEFINER RPCs and service role use it.

-- Replace any permissive private Storage policies with path-bound reads.
DROP POLICY IF EXISTS "authenticated_private_storage_read" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_private_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "private_storage_owner_or_staff_read" ON storage.objects;
CREATE POLICY "private_storage_owner_or_staff_read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id IN (
    'application-documents','contract-drafts','signed-contracts','tenant-documents',
    'maintenance-files','inspection-files','invoice-files','exports'
  )
  AND (storage.foldername(name))[1] = public.current_app_organization_id()
  AND (
    (storage.foldername(name))[2] = public.current_app_person_id()
    OR public.app_has_permission('documents:read')
  )
);

DROP POLICY IF EXISTS "listing_media_staff_insert" ON storage.objects;
CREATE POLICY "listing_media_staff_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'listing-media'
  AND (storage.foldername(name))[1] = public.current_app_organization_id()
  AND public.app_has_permission('listings:update')
);

DROP POLICY IF EXISTS "listing_media_staff_update" ON storage.objects;
CREATE POLICY "listing_media_staff_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'listing-media'
  AND (storage.foldername(name))[1] = public.current_app_organization_id()
  AND public.app_has_permission('listings:update')
)
WITH CHECK (
  bucket_id = 'listing-media'
  AND (storage.foldername(name))[1] = public.current_app_organization_id()
  AND public.app_has_permission('listings:update')
);

DROP POLICY IF EXISTS "listing_media_staff_delete" ON storage.objects;
CREATE POLICY "listing_media_staff_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'listing-media'
  AND (storage.foldername(name))[1] = public.current_app_organization_id()
  AND public.app_has_permission('listings:update')
);

REVOKE UPDATE, DELETE ON public."AuditEvent" FROM authenticated, anon;
REVOKE ALL ON public."OperationIdempotency", public."OutboxEvent" FROM anon, authenticated;
GRANT SELECT ON public."ApplicationSnapshot", public."Reservation", public."SigningSession",
  public."ContractSignature", public."EvidenceReport", public."MoveInCase", public."MoveOutCase"
TO authenticated;

REVOKE ALL ON FUNCTION public.claim_invitation(text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_invitation(text,uuid) TO service_role;

COMMIT;
