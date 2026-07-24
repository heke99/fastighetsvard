-- Fastighetsvärd
-- Canonical production hardening: concurrency, immutable evidence, idempotency,
-- transactional outbox and atomic rental-domain operations.

BEGIN;
SET LOCAL search_path = public, extensions;

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public."Application"
  ADD COLUMN "mainApplicantPersonId" TEXT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "consentVersion" TEXT,
  ADD COLUMN "consentTextHash" TEXT;

ALTER TABLE public."Offer"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public."Contract"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "landlordCountersignedAt" TIMESTAMP(3),
  ADD COLUMN "landlordCountersignedByUserId" TEXT,
  ADD COLUMN "finalDocumentHash" TEXT,
  ADD COLUMN "finalPdfStorageKey" TEXT;

ALTER TABLE public."Termination"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public."ContractParty"
  ADD COLUMN "requiredSignature" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public."ContractVersion"
  ADD COLUMN "finalPdfHash" TEXT,
  ADD COLUMN "finalPdfStorageKey" TEXT,
  ADD COLUMN "lockedAt" TIMESTAMP(3);

UPDATE public."Application" a
SET "mainApplicantPersonId" = (
  SELECT am."personId"
  FROM public."ApplicationMember" am
  WHERE am."applicationId" = a."id"
    AND am."role" = 'MAIN_APPLICANT'
  ORDER BY am."createdAt"
  LIMIT 1
)
WHERE a."mainApplicantPersonId" IS NULL
  AND EXISTS (
    SELECT 1
    FROM public."ApplicationMember" am
    WHERE am."applicationId" = a."id"
      AND am."role" = 'MAIN_APPLICANT'
  );

CREATE TABLE public."ApplicationSnapshot" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "organizationId" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "snapshotHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApplicationSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ApplicationSnapshot_applicationId_key" UNIQUE ("applicationId"),
  CONSTRAINT "ApplicationSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"("id") ON DELETE RESTRICT,
  CONSTRAINT "ApplicationSnapshot_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES public."Application"("id") ON DELETE RESTRICT
);

CREATE TABLE public."Reservation" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "organizationId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "listingId" TEXT,
  "offerId" TEXT,
  "contractId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Reservation_status_check" CHECK ("status" IN ('ACTIVE','CONVERTED','RELEASED','EXPIRED')),
  CONSTRAINT "Reservation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"("id") ON DELETE RESTRICT,
  CONSTRAINT "Reservation_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES public."Unit"("id") ON DELETE RESTRICT,
  CONSTRAINT "Reservation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES public."Listing"("id") ON DELETE RESTRICT,
  CONSTRAINT "Reservation_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES public."Offer"("id") ON DELETE RESTRICT,
  CONSTRAINT "Reservation_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES public."Contract"("id") ON DELETE RESTRICT
);

CREATE TABLE public."SigningSession" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "organizationId" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "contractVersionId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "SigningSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SigningSession_status_check" CHECK ("status" IN ('OPEN','COMPLETED','EXPIRED','CANCELLED')),
  CONSTRAINT "SigningSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"("id") ON DELETE RESTRICT,
  CONSTRAINT "SigningSession_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES public."Contract"("id") ON DELETE RESTRICT,
  CONSTRAINT "SigningSession_contractVersionId_fkey" FOREIGN KEY ("contractVersionId") REFERENCES public."ContractVersion"("id") ON DELETE RESTRICT
);

CREATE TABLE public."ContractSignature" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "organizationId" TEXT NOT NULL,
  "signingSessionId" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "contractVersionId" TEXT NOT NULL,
  "contractPartyId" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "authUserId" UUID,
  "documentHash" TEXT NOT NULL,
  "authenticationMethod" TEXT NOT NULL,
  "providerReference" TEXT,
  "ip" TEXT,
  "userAgent" TEXT,
  "evidence" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContractSignature_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ContractSignature_session_party_key" UNIQUE ("signingSessionId", "contractPartyId"),
  CONSTRAINT "ContractSignature_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"("id") ON DELETE RESTRICT,
  CONSTRAINT "ContractSignature_signingSessionId_fkey" FOREIGN KEY ("signingSessionId") REFERENCES public."SigningSession"("id") ON DELETE RESTRICT,
  CONSTRAINT "ContractSignature_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES public."Contract"("id") ON DELETE RESTRICT,
  CONSTRAINT "ContractSignature_contractVersionId_fkey" FOREIGN KEY ("contractVersionId") REFERENCES public."ContractVersion"("id") ON DELETE RESTRICT,
  CONSTRAINT "ContractSignature_contractPartyId_fkey" FOREIGN KEY ("contractPartyId") REFERENCES public."ContractParty"("id") ON DELETE RESTRICT,
  CONSTRAINT "ContractSignature_personId_fkey" FOREIGN KEY ("personId") REFERENCES public."Person"("id") ON DELETE RESTRICT,
  CONSTRAINT "ContractSignature_authUserId_fkey" FOREIGN KEY ("authUserId") REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE public."EvidenceReport" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "organizationId" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "contractVersionId" TEXT NOT NULL,
  "documentHash" TEXT NOT NULL,
  "finalPdfHash" TEXT NOT NULL,
  "report" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvidenceReport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EvidenceReport_contractVersionId_key" UNIQUE ("contractVersionId"),
  CONSTRAINT "EvidenceReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"("id") ON DELETE RESTRICT,
  CONSTRAINT "EvidenceReport_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES public."Contract"("id") ON DELETE RESTRICT,
  CONSTRAINT "EvidenceReport_contractVersionId_fkey" FOREIGN KEY ("contractVersionId") REFERENCES public."ContractVersion"("id") ON DELETE RESTRICT
);

CREATE TABLE public."MoveInCase" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "organizationId" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "checklist" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "completedAt" TIMESTAMP(3),
  "completedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MoveInCase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MoveInCase_contractId_key" UNIQUE ("contractId"),
  CONSTRAINT "MoveInCase_status_check" CHECK ("status" IN ('PENDING','IN_PROGRESS','COMPLETED','CANCELLED')),
  CONSTRAINT "MoveInCase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"("id") ON DELETE RESTRICT,
  CONSTRAINT "MoveInCase_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES public."Contract"("id") ON DELETE RESTRICT,
  CONSTRAINT "MoveInCase_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES public."Unit"("id") ON DELETE RESTRICT,
  CONSTRAINT "MoveInCase_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES public."User"("id") ON DELETE SET NULL
);

CREATE TABLE public."MoveOutCase" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "organizationId" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "terminationId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "checklist" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "completedAt" TIMESTAMP(3),
  "completedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MoveOutCase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MoveOutCase_terminationId_key" UNIQUE ("terminationId"),
  CONSTRAINT "MoveOutCase_status_check" CHECK ("status" IN ('PENDING','IN_PROGRESS','COMPLETED','CANCELLED')),
  CONSTRAINT "MoveOutCase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"("id") ON DELETE RESTRICT,
  CONSTRAINT "MoveOutCase_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES public."Contract"("id") ON DELETE RESTRICT,
  CONSTRAINT "MoveOutCase_terminationId_fkey" FOREIGN KEY ("terminationId") REFERENCES public."Termination"("id") ON DELETE RESTRICT,
  CONSTRAINT "MoveOutCase_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES public."Unit"("id") ON DELETE RESTRICT,
  CONSTRAINT "MoveOutCase_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES public."User"("id") ON DELETE SET NULL
);

CREATE TABLE public."OutboxEvent" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "organizationId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "recipient" TEXT,
  "payload" JSONB NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedAt" TIMESTAMP(3),
  "claimedBy" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "providerId" TEXT,
  "lastError" TEXT,
  "completedAt" TIMESTAMP(3),
  "deadLetterAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OutboxEvent_status_check" CHECK ("status" IN ('PENDING','PROCESSING','COMPLETED','FAILED','DEAD_LETTER')),
  CONSTRAINT "OutboxEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"("id") ON DELETE RESTRICT,
  CONSTRAINT "OutboxEvent_idempotencyKey_key" UNIQUE ("idempotencyKey")
);

CREATE TABLE public."OperationIdempotency" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "organizationId" TEXT NOT NULL,
  "actorType" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROCESSING',
  "leaseExpiresAt" TIMESTAMP(3),
  "responseStatus" INTEGER,
  "responseBody" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
  CONSTRAINT "OperationIdempotency_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OperationIdempotency_status_check" CHECK ("status" IN ('PROCESSING','COMPLETED','FAILED','EXPIRED')),
  CONSTRAINT "OperationIdempotency_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"("id") ON DELETE RESTRICT,
  CONSTRAINT "OperationIdempotency_scope_key" UNIQUE ("organizationId", "actorType", "actorId", "operation", "idempotencyKey")
);

CREATE INDEX "ApplicationSnapshot_organizationId_idx" ON public."ApplicationSnapshot"("organizationId");
CREATE INDEX "Reservation_unitId_status_idx" ON public."Reservation"("unitId", "status");
CREATE UNIQUE INDEX "Reservation_one_active_per_unit_key" ON public."Reservation"("unitId") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "Application_one_active_main_per_listing_key"
  ON public."Application"("listingId", "mainApplicantPersonId")
  WHERE "mainApplicantPersonId" IS NOT NULL
    AND "status" NOT IN ('CLOSED','WITHDRAWN','DECLINED');
CREATE UNIQUE INDEX "Offer_one_accepted_per_listing_key" ON public."Offer"("listingId") WHERE "status" = 'ACCEPTED';
CREATE INDEX "SigningSession_contractId_status_idx" ON public."SigningSession"("contractId", "status");
CREATE INDEX "ContractSignature_contractId_idx" ON public."ContractSignature"("contractId");
CREATE INDEX "OutboxEvent_claim_idx" ON public."OutboxEvent"("status", "nextAttemptAt", "leaseExpiresAt");
CREATE INDEX "OperationIdempotency_expiry_idx" ON public."OperationIdempotency"("expiresAt");

ALTER TABLE public."Contract"
  ADD CONSTRAINT "Contract_non_overlapping_binding_periods"
  EXCLUDE USING gist (
    "unitId" WITH =,
    tsrange("startDate", COALESCE("endDate", 'infinity'::timestamp), '[)') WITH &&
  )
  WHERE ("status" IN ('SENT_FOR_SIGNING','PARTIALLY_SIGNED','SIGNED','ACTIVE'));

CREATE OR REPLACE FUNCTION public.sync_main_applicant_person_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW."role" = 'MAIN_APPLICANT' THEN
    UPDATE public."Application"
    SET "mainApplicantPersonId" = NEW."personId",
        "version" = "version" + 1
    WHERE "id" = NEW."applicationId"
      AND ("mainApplicantPersonId" IS NULL OR "mainApplicantPersonId" = NEW."personId");
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ApplicationMember_sync_main_applicant"
AFTER INSERT OR UPDATE OF "personId", "role" ON public."ApplicationMember"
FOR EACH ROW EXECUTE FUNCTION public.sync_main_applicant_person_id();

CREATE OR REPLACE FUNCTION public.reject_immutable_row_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  RAISE EXCEPTION 'immutable_record' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "ApplicationSnapshot_immutable"
BEFORE UPDATE OR DELETE ON public."ApplicationSnapshot"
FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_row_mutation();

CREATE TRIGGER "ContractSignature_immutable"
BEFORE UPDATE OR DELETE ON public."ContractSignature"
FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_row_mutation();

CREATE TRIGGER "EvidenceReport_immutable"
BEFORE UPDATE OR DELETE ON public."EvidenceReport"
FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_row_mutation();

CREATE OR REPLACE FUNCTION public.reject_locked_contract_version_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF OLD."lockedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'locked_contract_version_is_immutable' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ContractVersion_locked_immutable"
BEFORE UPDATE OR DELETE ON public."ContractVersion"
FOR EACH ROW EXECUTE FUNCTION public.reject_locked_contract_version_mutation();

CREATE TRIGGER "Reservation_set_updated_at"
BEFORE UPDATE ON public."Reservation"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER "MoveInCase_set_updated_at"
BEFORE UPDATE ON public."MoveInCase"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER "MoveOutCase_set_updated_at"
BEFORE UPDATE ON public."MoveOutCase"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT "id"
  FROM public."User"
  WHERE "authUserId" = auth.uid()
    AND "isActive" = true
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.app_has_permission(p_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."User" u
    JOIN public."UserRole" ur ON ur."userId" = u."id"
    JOIN public."RolePermission" rp ON rp."roleId" = ur."roleId"
    WHERE u."authUserId" = auth.uid()
      AND u."isActive" = true
      AND (
        rp."permission" = '*'
        OR rp."permission" = p_permission
        OR rp."permission" = split_part(p_permission, ':', 1) || ':*'
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.write_audit_event(
  p_organization_id text,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_before jsonb DEFAULT NULL,
  p_after jsonb DEFAULT NULL,
  p_actor_type text DEFAULT 'user',
  p_actor_id text DEFAULT NULL,
  p_correlation_id text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id text := gen_random_uuid()::text;
BEGIN
  INSERT INTO public."AuditEvent" (
    "id", "organizationId", "userId", "actorType", "actorId", "action",
    "entityType", "entityId", "before", "after", "correlationId"
  ) VALUES (
    v_id, p_organization_id, public.current_app_user_id(), p_actor_type,
    COALESCE(p_actor_id, public.current_app_user_id()), p_action,
    p_entity_type, p_entity_id, p_before, p_after, p_correlation_id
  );
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_outbox_event(
  p_organization_id text,
  p_event_type text,
  p_aggregate_type text,
  p_aggregate_id text,
  p_recipient text,
  p_payload jsonb,
  p_idempotency_key text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id text;
BEGIN
  INSERT INTO public."OutboxEvent" (
    "organizationId", "eventType", "aggregateType", "aggregateId",
    "recipient", "payload", "idempotencyKey"
  ) VALUES (
    p_organization_id, p_event_type, p_aggregate_type, p_aggregate_id,
    p_recipient, p_payload, p_idempotency_key
  )
  ON CONFLICT ("idempotencyKey") DO UPDATE
    SET "idempotencyKey" = EXCLUDED."idempotencyKey"
  RETURNING "id" INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_idempotent_operation(
  p_organization_id text,
  p_actor_type text,
  p_actor_id text,
  p_operation text,
  p_idempotency_key text,
  p_request_hash text,
  p_lease_seconds integer DEFAULT 60
)
RETURNS TABLE (
  "recordId" text,
  "isReplay" boolean,
  "responseStatus" integer,
  "responseBody" jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row public."OperationIdempotency"%ROWTYPE;
  v_inserted_id text;
BEGIN
  IF NULLIF(trim(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'idempotency_key_required' USING ERRCODE = '22023';
  END IF;

  IF auth.role() <> 'service_role'
     AND p_actor_id IS DISTINCT FROM public.current_app_person_id()
     AND p_actor_id IS DISTINCT FROM public.current_app_user_id() THEN
    RAISE EXCEPTION 'actor_mismatch' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public."OperationIdempotency" (
    "organizationId", "actorType", "actorId", "operation", "idempotencyKey",
    "requestHash", "leaseExpiresAt"
  ) VALUES (
    p_organization_id, p_actor_type, p_actor_id, p_operation, p_idempotency_key,
    p_request_hash, CURRENT_TIMESTAMP + make_interval(secs => GREATEST(p_lease_seconds, 1))
  )
  ON CONFLICT DO NOTHING
  RETURNING "id" INTO v_inserted_id;

  SELECT * INTO v_row
  FROM public."OperationIdempotency"
  WHERE "organizationId" = p_organization_id
    AND "actorType" = p_actor_type
    AND "actorId" = p_actor_id
    AND "operation" = p_operation
    AND "idempotencyKey" = p_idempotency_key
  FOR UPDATE;

  IF v_row."requestHash" <> p_request_hash THEN
    RAISE EXCEPTION 'idempotency_key_reused_with_different_request' USING ERRCODE = '23505';
  END IF;

  IF v_inserted_id IS NULL AND v_row."status" = 'COMPLETED' THEN
    RETURN QUERY SELECT v_row."id", true, v_row."responseStatus", v_row."responseBody";
    RETURN;
  END IF;

  IF v_inserted_id IS NULL
     AND v_row."status" = 'PROCESSING'
     AND v_row."leaseExpiresAt" > CURRENT_TIMESTAMP THEN
    RAISE EXCEPTION 'operation_already_processing' USING ERRCODE = '55P03';
  END IF;

  UPDATE public."OperationIdempotency"
  SET "status" = 'PROCESSING',
      "leaseExpiresAt" = CURRENT_TIMESTAMP + make_interval(secs => GREATEST(p_lease_seconds, 1)),
      "error" = NULL
  WHERE "id" = v_row."id";

  RETURN QUERY SELECT v_row."id", false, NULL::integer, NULL::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_idempotent_operation(
  p_record_id text,
  p_response_status integer,
  p_response_body jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE public."OperationIdempotency"
  SET "status" = 'COMPLETED',
      "responseStatus" = p_response_status,
      "responseBody" = p_response_body,
      "completedAt" = CURRENT_TIMESTAMP,
      "leaseExpiresAt" = NULL
  WHERE "id" = p_record_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'idempotency_record_not_found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_idempotent_operation(
  p_record_id text,
  p_error text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE public."OperationIdempotency"
  SET "status" = 'FAILED',
      "error" = left(COALESCE(p_error, 'operation_failed'), 2000),
      "leaseExpiresAt" = NULL
  WHERE "id" = p_record_id AND "status" = 'PROCESSING';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'idempotency_record_not_processing' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_rental_application(
  p_listing_id text,
  p_person_id text,
  p_payload jsonb,
  p_idempotency_key text,
  p_request_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_listing public."Listing"%ROWTYPE;
  v_application_id text := gen_random_uuid()::text;
  v_organization_id text;
  v_snapshot jsonb;
  v_snapshot_hash text;
  v_internal_transfer boolean;
  v_idempotency record;
  v_response jsonb;
  v_member jsonb;
BEGIN
  IF auth.role() <> 'service_role' AND public.current_app_person_id() IS DISTINCT FROM p_person_id THEN
    RAISE EXCEPTION 'person_mismatch' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_listing
  FROM public."Listing"
  WHERE "id" = p_listing_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'listing_not_found' USING ERRCODE = 'P0002'; END IF;
  v_organization_id := v_listing."organizationId";

  IF public.current_app_organization_id() IS DISTINCT FROM v_organization_id AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_idempotency
  FROM public.claim_idempotent_operation(
    v_organization_id, 'person', p_person_id, 'submit_rental_application',
    p_idempotency_key, p_request_hash, 120
  );
  IF v_idempotency."isReplay" THEN RETURN v_idempotency."responseBody"; END IF;

  IF v_listing."status" <> 'PUBLISHED' THEN RAISE EXCEPTION 'listing_not_open' USING ERRCODE = 'P0001'; END IF;
  IF v_listing."applicationDeadline" IS NOT NULL AND v_listing."applicationDeadline" < CURRENT_TIMESTAMP THEN
    RAISE EXCEPTION 'application_deadline_passed' USING ERRCODE = 'P0001';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public."Contract" c
    JOIN public."ContractParty" cp ON cp."contractId" = c."id"
    WHERE c."organizationId" = v_organization_id
      AND c."status" = 'ACTIVE'
      AND cp."personId" = p_person_id
      AND cp."role" IN ('TENANT','CO_TENANT')
  ) INTO v_internal_transfer;

  INSERT INTO public."Application" (
    "id", "organizationId", "listingId", "mainApplicantPersonId", "status",
    "isInternalTransfer", "desiredMoveInDate", "currentHousing", "currentLandlord",
    "employment", "employer", "employmentType", "monthlyIncome", "otherIncome",
    "references", "pets", "vehicles", "specialNeeds", "message", "consentGivenAt",
    "consentVersion", "consentTextHash", "submittedAt"
  ) VALUES (
    v_application_id, v_organization_id, p_listing_id, p_person_id, 'SUBMITTED',
    COALESCE((p_payload->>'isInternalTransfer')::boolean, v_internal_transfer),
    NULLIF(p_payload->>'desiredMoveInDate','')::timestamp,
    NULLIF(p_payload->>'currentHousing',''), NULLIF(p_payload->>'currentLandlord',''),
    NULLIF(p_payload->>'employment',''), NULLIF(p_payload->>'employer',''),
    NULLIF(p_payload->>'employmentType',''), NULLIF(p_payload->>'monthlyIncome','')::numeric,
    NULLIF(p_payload->>'otherIncome',''), NULLIF(p_payload->>'references',''),
    NULLIF(p_payload->>'pets',''), NULLIF(p_payload->>'vehicles',''),
    NULLIF(p_payload->>'specialNeeds',''), NULLIF(p_payload->>'message',''), CURRENT_TIMESTAMP,
    COALESCE(NULLIF(p_payload->>'consentVersion',''), 'privacy-v1'),
    NULLIF(p_payload->>'consentTextHash',''), CURRENT_TIMESTAMP
  );

  INSERT INTO public."ApplicationMember" ("applicationId", "personId", "role")
  VALUES (v_application_id, p_person_id, 'MAIN_APPLICANT');

  FOR v_member IN SELECT value FROM jsonb_array_elements(COALESCE(p_payload->'coApplicants', '[]'::jsonb))
  LOOP
    IF NULLIF(v_member->>'personId','') IS NOT NULL THEN
      INSERT INTO public."ApplicationMember" ("applicationId", "personId", "role")
      SELECT v_application_id, p."id", 'CO_APPLICANT'
      FROM public."Person" p
      WHERE p."id" = v_member->>'personId' AND p."organizationId" = v_organization_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'co_applicant_not_found' USING ERRCODE = 'P0002'; END IF;
      INSERT INTO public."PersonRole" ("personId", "role")
      VALUES (v_member->>'personId', 'CO_APPLICANT') ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  INSERT INTO public."PersonRole" ("personId", "role")
  VALUES (p_person_id, 'APPLICANT') ON CONFLICT DO NOTHING;

  INSERT INTO public."ApplicationStatusEvent" ("applicationId", "toStatus", "comment")
  VALUES (v_application_id, 'SUBMITTED', 'Ansökan inskickad atomiskt');

  v_snapshot := jsonb_build_object(
    'applicationId', v_application_id,
    'listing', jsonb_build_object(
      'id', v_listing."id", 'title', v_listing."title", 'version', v_listing."updatedAt",
      'requirementProfile', v_listing."requirementProfile"
    ),
    'mainApplicantPersonId', p_person_id,
    'submittedPayload', p_payload,
    'submittedAt', CURRENT_TIMESTAMP
  );
  v_snapshot_hash := encode(digest(convert_to(v_snapshot::text, 'UTF8'), 'sha256'), 'hex');

  INSERT INTO public."ApplicationSnapshot" (
    "organizationId", "applicationId", "snapshot", "snapshotHash"
  ) VALUES (v_organization_id, v_application_id, v_snapshot, v_snapshot_hash);

  INSERT INTO public."Notification" (
    "organizationId", "personId", "eventType", "title", "body"
  ) VALUES (
    v_organization_id, p_person_id, 'application_received', 'Ansökan mottagen',
    'Vi har tagit emot din ansökan för ' || v_listing."title" || '.'
  );

  PERFORM public.enqueue_outbox_event(
    v_organization_id, 'application.submitted', 'application', v_application_id,
    p_person_id, jsonb_build_object('applicationId', v_application_id, 'listingId', p_listing_id),
    'application.submitted:' || v_application_id
  );
  PERFORM public.write_audit_event(
    v_organization_id, 'application_submitted', 'application', v_application_id,
    NULL, jsonb_build_object('listingId', p_listing_id, 'personId', p_person_id,
      'snapshotHash', v_snapshot_hash, 'internalTransfer', v_internal_transfer),
    'person', p_person_id, p_idempotency_key
  );

  v_response := jsonb_build_object(
    'applicationId', v_application_id,
    'listingId', p_listing_id,
    'status', 'SUBMITTED',
    'snapshotHash', v_snapshot_hash,
    'isInternalTransfer', COALESCE((p_payload->>'isInternalTransfer')::boolean, v_internal_transfer)
  );
  PERFORM public.complete_idempotent_operation(v_idempotency."recordId", 201, v_response);
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_rental_application(
  p_application_id text,
  p_person_id text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_app public."Application"%ROWTYPE;
BEGIN
  IF auth.role() <> 'service_role' AND public.current_app_person_id() IS DISTINCT FROM p_person_id THEN
    RAISE EXCEPTION 'person_mismatch' USING ERRCODE = '42501';
  END IF;
  SELECT a.* INTO v_app
  FROM public."Application" a
  WHERE a."id" = p_application_id
    AND EXISTS (
      SELECT 1 FROM public."ApplicationMember" am
      WHERE am."applicationId" = a."id" AND am."personId" = p_person_id
    )
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'application_not_found' USING ERRCODE = 'P0002'; END IF;
  IF auth.role() <> 'service_role' AND public.current_app_organization_id() IS DISTINCT FROM v_app."organizationId" THEN
    RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501';
  END IF;
  IF v_app."status" IN ('CLOSED','WITHDRAWN','ACCEPTED','CONTRACT_SENT','CONTRACT_SIGNED') THEN
    RAISE EXCEPTION 'application_cannot_be_withdrawn' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public."Application"
  SET "status" = 'WITHDRAWN', "closedAt" = CURRENT_TIMESTAMP, "version" = "version" + 1
  WHERE "id" = p_application_id;
  INSERT INTO public."ApplicationStatusEvent" ("applicationId", "fromStatus", "toStatus", "comment")
  VALUES (p_application_id, v_app."status", 'WITHDRAWN', p_reason);
  PERFORM public.write_audit_event(v_app."organizationId", 'application_withdrawn', 'application', p_application_id,
    jsonb_build_object('status', v_app."status"), jsonb_build_object('status', 'WITHDRAWN'), 'person', p_person_id);
  RETURN jsonb_build_object('applicationId', p_application_id, 'status', 'WITHDRAWN');
END;
$$;

CREATE OR REPLACE FUNCTION public.create_viewing_booking(
  p_viewing_id text,
  p_person_id text,
  p_application_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_viewing public."Viewing"%ROWTYPE;
  v_status public."ViewingAttendeeStatus";
  v_count integer;
  v_booking_id text := gen_random_uuid()::text;
BEGIN
  IF auth.role() <> 'service_role' AND public.current_app_person_id() IS DISTINCT FROM p_person_id THEN
    RAISE EXCEPTION 'person_mismatch' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_viewing FROM public."Viewing" WHERE "id" = p_viewing_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'viewing_not_found' USING ERRCODE = 'P0002'; END IF;
  IF auth.role() <> 'service_role' AND public.current_app_organization_id() IS DISTINCT FROM v_viewing."organizationId" THEN
    RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501';
  END IF;
  IF v_viewing."startsAt" <= CURRENT_TIMESTAMP THEN RAISE EXCEPTION 'viewing_started' USING ERRCODE = 'P0001'; END IF;
  SELECT count(*) INTO v_count FROM public."ViewingAttendee"
    WHERE "viewingId" = p_viewing_id AND "status" IN ('BOOKED','CHECKED_IN','ATTENDED');
  v_status := CASE WHEN v_viewing."maxAttendees" IS NOT NULL AND v_count >= v_viewing."maxAttendees"
                   THEN 'WAITLISTED'::public."ViewingAttendeeStatus"
                   ELSE 'BOOKED'::public."ViewingAttendeeStatus" END;
  INSERT INTO public."ViewingAttendee" ("id", "viewingId", "personId", "applicationId", "status")
  VALUES (v_booking_id, p_viewing_id, p_person_id, p_application_id, v_status);
  PERFORM public.write_audit_event(v_viewing."organizationId", 'viewing_booked', 'viewing_attendee', v_booking_id,
    NULL, jsonb_build_object('viewingId', p_viewing_id, 'status', v_status), 'person', p_person_id);
  RETURN jsonb_build_object('bookingId', v_booking_id, 'status', v_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_viewing_booking(
  p_booking_id text,
  p_person_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_booking public."ViewingAttendee"%ROWTYPE;
  v_viewing public."Viewing"%ROWTYPE;
  v_promoted_id text;
BEGIN
  IF auth.role() <> 'service_role' AND public.current_app_person_id() IS DISTINCT FROM p_person_id THEN
    RAISE EXCEPTION 'person_mismatch' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_booking FROM public."ViewingAttendee"
  WHERE "id" = p_booking_id AND "personId" = p_person_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_viewing FROM public."Viewing" WHERE "id" = v_booking."viewingId" FOR UPDATE;
  IF auth.role() <> 'service_role' AND public.current_app_organization_id() IS DISTINCT FROM v_viewing."organizationId" THEN
    RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501';
  END IF;
  UPDATE public."ViewingAttendee" SET "status" = 'CANCELLED' WHERE "id" = p_booking_id;
  IF v_booking."status" = 'BOOKED' THEN
    SELECT "id" INTO v_promoted_id FROM public."ViewingAttendee"
    WHERE "viewingId" = v_booking."viewingId" AND "status" = 'WAITLISTED'
    ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1;
    IF v_promoted_id IS NOT NULL THEN
      UPDATE public."ViewingAttendee" SET "status" = 'BOOKED' WHERE "id" = v_promoted_id;
    END IF;
  END IF;
  PERFORM public.write_audit_event(v_viewing."organizationId", 'viewing_booking_cancelled', 'viewing_attendee', p_booking_id,
    jsonb_build_object('status', v_booking."status"), jsonb_build_object('status', 'CANCELLED'), 'person', p_person_id);
  RETURN jsonb_build_object('bookingId', p_booking_id, 'status', 'CANCELLED', 'promotedBookingId', v_promoted_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.send_rental_offer(
  p_application_id text,
  p_expires_at timestamp,
  p_expected_application_version integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_application public."Application"%ROWTYPE;
  v_listing public."Listing"%ROWTYPE;
  v_person_id text;
  v_offer_id text := gen_random_uuid()::text;
  v_offer_version integer;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.app_has_permission('offers:create') THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;
  IF p_expires_at <= CURRENT_TIMESTAMP THEN
    RAISE EXCEPTION 'offer_expiry_must_be_future' USING ERRCODE = '22007';
  END IF;

  SELECT * INTO v_application
  FROM public."Application"
  WHERE "id" = p_application_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'application_not_found' USING ERRCODE = 'P0002'; END IF;
  IF auth.role() <> 'service_role'
     AND public.current_app_organization_id() IS DISTINCT FROM v_application."organizationId" THEN
    RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501';
  END IF;
  IF p_expected_application_version IS NOT NULL
     AND v_application."version" <> p_expected_application_version THEN
    RAISE EXCEPTION 'optimistic_lock_conflict' USING ERRCODE = '40001';
  END IF;
  IF v_application."status" NOT IN ('QUALIFIED','UNDER_REVIEW','VIEWING_BOOKED','VIEWING_OFFERED') THEN
    RAISE EXCEPTION 'application_not_offerable' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_listing FROM public."Listing"
  WHERE "id" = v_application."listingId" FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'listing_not_found' USING ERRCODE = 'P0002'; END IF;
  IF EXISTS (
    SELECT 1 FROM public."Reservation" r
    WHERE r."unitId" = v_listing."unitId" AND r."status" = 'ACTIVE'
  ) OR EXISTS (
    SELECT 1 FROM public."Contract" c
    WHERE c."unitId" = v_listing."unitId"
      AND c."status" IN ('SENT_FOR_SIGNING','PARTIALLY_SIGNED','SIGNED','ACTIVE')
  ) THEN
    RAISE EXCEPTION 'unit_not_available' USING ERRCODE = '23P01';
  END IF;

  SELECT am."personId" INTO v_person_id
  FROM public."ApplicationMember" am
  WHERE am."applicationId" = p_application_id AND am."role" = 'MAIN_APPLICANT'
  FOR UPDATE;
  IF v_person_id IS NULL THEN RAISE EXCEPTION 'main_applicant_missing' USING ERRCODE = 'P0002'; END IF;

  SELECT COALESCE(max(o."version"), 0) + 1 INTO v_offer_version
  FROM public."Offer" o WHERE o."applicationId" = p_application_id;

  INSERT INTO public."Offer" (
    "id", "organizationId", "listingId", "applicationId", "personId",
    "status", "expiresAt", "isInternalTransfer", "version"
  ) VALUES (
    v_offer_id, v_application."organizationId", v_application."listingId",
    p_application_id, v_person_id, 'SENT', p_expires_at,
    v_application."isInternalTransfer", v_offer_version
  );
  UPDATE public."Application"
  SET "status" = 'OFFER_SENT', "version" = "version" + 1
  WHERE "id" = p_application_id;
  INSERT INTO public."ApplicationStatusEvent" (
    "applicationId", "fromStatus", "toStatus", "comment", "changedByUserId"
  ) VALUES (
    p_application_id, v_application."status", 'OFFER_SENT',
    'Erbjudande skickat atomiskt', public.current_app_user_id()
  );
  UPDATE public."Unit" SET "status" = 'OFFER_SENT' WHERE "id" = v_listing."unitId";
  INSERT INTO public."Notification" (
    "organizationId", "personId", "eventType", "title", "body"
  ) VALUES (
    v_application."organizationId", v_person_id, 'offer_sent',
    'Du har fått ett erbjudande',
    'Du har fått ett bostadserbjudande. Svara före ' || to_char(p_expires_at, 'YYYY-MM-DD HH24:MI') || '.'
  );
  PERFORM public.enqueue_outbox_event(
    v_application."organizationId", 'offer.sent', 'offer', v_offer_id,
    v_person_id,
    jsonb_build_object('offerId', v_offer_id, 'applicationId', p_application_id,
      'listingId', v_application."listingId", 'expiresAt', p_expires_at),
    'offer.sent:' || v_offer_id
  );
  PERFORM public.write_audit_event(
    v_application."organizationId", 'offer_sent', 'offer', v_offer_id,
    NULL, jsonb_build_object('applicationId', p_application_id, 'personId', v_person_id,
      'expiresAt', p_expires_at, 'version', v_offer_version),
    'user', public.current_app_user_id()
  );
  RETURN jsonb_build_object(
    'offerId', v_offer_id, 'applicationId', p_application_id, 'personId', v_person_id,
    'status', 'SENT', 'expiresAt', p_expires_at, 'version', v_offer_version
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_rental_offer(
  p_offer_id text,
  p_person_id text,
  p_start_date timestamp DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_request_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_offer public."Offer"%ROWTYPE;
  v_listing public."Listing"%ROWTYPE;
  v_unit public."Unit"%ROWTYPE;
  v_application public."Application"%ROWTYPE;
  v_contract_id text := gen_random_uuid()::text;
  v_reservation_id text := gen_random_uuid()::text;
  v_contract_number text;
  v_sequence integer;
  v_start timestamp;
  v_version_id text := gen_random_uuid()::text;
  v_content jsonb;
  v_hash text;
  v_idempotency record;
  v_response jsonb;
  v_key text := COALESCE(NULLIF(p_idempotency_key,''), gen_random_uuid()::text);
  v_req_hash text := COALESCE(NULLIF(p_request_hash,''), encode(digest(convert_to(p_offer_id || ':' || p_person_id || ':accept', 'UTF8'), 'sha256'), 'hex'));
BEGIN
  IF auth.role() <> 'service_role' AND public.current_app_person_id() IS DISTINCT FROM p_person_id THEN
    RAISE EXCEPTION 'person_mismatch' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_offer FROM public."Offer" WHERE "id" = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'offer_not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_offer."personId" <> p_person_id THEN RAISE EXCEPTION 'offer_person_mismatch' USING ERRCODE = '42501'; END IF;
  IF auth.role() <> 'service_role' AND public.current_app_organization_id() IS DISTINCT FROM v_offer."organizationId" THEN
    RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_idempotency FROM public.claim_idempotent_operation(
    v_offer."organizationId", 'person', p_person_id, 'accept_rental_offer', v_key, v_req_hash, 120
  );
  IF v_idempotency."isReplay" THEN RETURN v_idempotency."responseBody"; END IF;

  IF v_offer."status" <> 'SENT' THEN RAISE EXCEPTION 'offer_not_open' USING ERRCODE = 'P0001'; END IF;
  IF v_offer."expiresAt" <= CURRENT_TIMESTAMP THEN RAISE EXCEPTION 'offer_expired' USING ERRCODE = 'P0001'; END IF;

  SELECT * INTO v_listing FROM public."Listing" WHERE "id" = v_offer."listingId" FOR UPDATE;
  SELECT * INTO v_unit FROM public."Unit" WHERE "id" = v_listing."unitId" FOR UPDATE;
  SELECT * INTO v_application FROM public."Application" WHERE "id" = v_offer."applicationId" FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM public."Reservation"
    WHERE "unitId" = v_unit."id" AND "status" = 'ACTIVE'
  ) THEN RAISE EXCEPTION 'unit_already_reserved' USING ERRCODE = '23P01'; END IF;
  IF EXISTS (
    SELECT 1 FROM public."Contract"
    WHERE "unitId" = v_unit."id" AND "status" IN ('SENT_FOR_SIGNING','PARTIALLY_SIGNED','SIGNED','ACTIVE')
  ) THEN RAISE EXCEPTION 'unit_has_binding_contract' USING ERRCODE = '23P01'; END IF;

  INSERT INTO public."Counter" ("organizationId", "key", "value")
  VALUES (v_offer."organizationId", 'contract', 1)
  ON CONFLICT ("organizationId", "key") DO UPDATE SET "value" = public."Counter"."value" + 1
  RETURNING "value" INTO v_sequence;

  v_contract_number := 'HK-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(v_sequence::text, 6, '0');
  v_start := COALESCE(p_start_date, v_application."desiredMoveInDate", v_listing."moveInDate", CURRENT_TIMESTAMP);
  v_content := jsonb_build_object(
    'contractNumber', v_contract_number,
    'unitId', v_unit."id",
    'rent', COALESCE(v_listing."rent", v_unit."rent", 0),
    'startDate', v_start,
    'offerId', v_offer."id"
  );
  v_hash := encode(digest(convert_to(v_content::text, 'UTF8'), 'sha256'), 'hex');

  INSERT INTO public."Contract" (
    "id", "organizationId", "unitId", "contractNumber", "type", "status",
    "startDate", "noticePeriodMonths", "rent", "deposit"
  ) VALUES (
    v_contract_id, v_offer."organizationId", v_unit."id", v_contract_number,
    CASE WHEN v_unit."type" = 'PARKING' THEN 'PARKING'::public."ContractType" ELSE 'RESIDENTIAL'::public."ContractType" END,
    'SENT_FOR_SIGNING', v_start, v_unit."noticePeriodMonths",
    COALESCE(v_listing."rent", v_unit."rent", 0), v_unit."deposit"
  );

  INSERT INTO public."ContractParty" ("contractId", "personId", "role")
  SELECT v_contract_id, am."personId",
    CASE WHEN am."role" = 'MAIN_APPLICANT' THEN 'TENANT'::public."ContractPartyRole" ELSE 'CO_TENANT'::public."ContractPartyRole" END
  FROM public."ApplicationMember" am
  WHERE am."applicationId" = v_application."id"
    AND am."role" IN ('MAIN_APPLICANT','CO_APPLICANT');

  INSERT INTO public."ContractVersion" (
    "id", "contractId", "versionNumber", "content", "documentHash", "createdByUserId"
  ) VALUES (v_version_id, v_contract_id, 1, v_content, v_hash, public.current_app_user_id());

  INSERT INTO public."SigningSession" (
    "organizationId", "contractId", "contractVersionId", "expiresAt"
  ) VALUES (v_offer."organizationId", v_contract_id, v_version_id, CURRENT_TIMESTAMP + INTERVAL '14 days');

  INSERT INTO public."ContractStatusEvent" ("contractId", "toStatus", "comment", "changedByUserId")
  VALUES (v_contract_id, 'SENT_FOR_SIGNING', 'Skapat atomiskt från accepterat erbjudande', public.current_app_user_id());

  INSERT INTO public."Reservation" (
    "id", "organizationId", "unitId", "listingId", "offerId", "contractId", "expiresAt"
  ) VALUES (
    v_reservation_id, v_offer."organizationId", v_unit."id", v_listing."id", v_offer."id", v_contract_id,
    CURRENT_TIMESTAMP + INTERVAL '14 days'
  );

  UPDATE public."Offer"
  SET "status" = 'ACCEPTED', "respondedAt" = CURRENT_TIMESTAMP, "contractId" = v_contract_id,
      "version" = "version" + 1
  WHERE "id" = v_offer."id";

  UPDATE public."Offer"
  SET "status" = 'WITHDRAWN', "respondedAt" = CURRENT_TIMESTAMP, "version" = "version" + 1
  WHERE "listingId" = v_listing."id" AND "id" <> v_offer."id" AND "status" = 'SENT';

  UPDATE public."Application"
  SET "status" = 'CONTRACT_SENT', "version" = "version" + 1
  WHERE "id" = v_application."id";

  INSERT INTO public."ApplicationStatusEvent" ("applicationId", "fromStatus", "toStatus", "comment")
  VALUES (v_application."id", v_application."status", 'CONTRACT_SENT', 'Erbjudande accepterat och avtal skapat');

  UPDATE public."Unit" SET "status" = 'CONTRACT_SENT' WHERE "id" = v_unit."id";

  INSERT INTO public."Notification" ("organizationId", "personId", "eventType", "title", "body")
  VALUES (v_offer."organizationId", p_person_id, 'contract_sent', 'Avtal att signera',
    'Avtal ' || v_contract_number || ' är skickat till dig för signering.');

  PERFORM public.enqueue_outbox_event(
    v_offer."organizationId", 'offer.accepted', 'offer', v_offer."id", p_person_id,
    jsonb_build_object('offerId', v_offer."id", 'contractId', v_contract_id, 'reservationId', v_reservation_id),
    'offer.accepted:' || v_offer."id"
  );
  PERFORM public.write_audit_event(
    v_offer."organizationId", 'offer_accepted', 'offer', v_offer."id",
    jsonb_build_object('status', v_offer."status"),
    jsonb_build_object('status', 'ACCEPTED', 'contractId', v_contract_id, 'reservationId', v_reservation_id,
      'internalTransferPending', v_offer."isInternalTransfer"),
    'person', p_person_id, v_key
  );

  v_response := jsonb_build_object(
    'offerId', v_offer."id", 'status', 'ACCEPTED', 'contractId', v_contract_id,
    'contractNumber', v_contract_number, 'reservationId', v_reservation_id,
    'terminationId', NULL, 'internalTransferPending', v_offer."isInternalTransfer"
  );
  PERFORM public.complete_idempotent_operation(v_idempotency."recordId", 200, v_response);
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_rental_offer(
  p_offer_id text,
  p_person_id text,
  p_idempotency_key text DEFAULT NULL,
  p_request_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_offer public."Offer"%ROWTYPE;
  v_unit_id text;
  v_idempotency record;
  v_response jsonb;
  v_key text := COALESCE(NULLIF(p_idempotency_key,''), gen_random_uuid()::text);
  v_req_hash text := COALESCE(NULLIF(p_request_hash,''), encode(digest(convert_to(p_offer_id || ':' || p_person_id || ':decline', 'UTF8'), 'sha256'), 'hex'));
BEGIN
  IF auth.role() <> 'service_role' AND public.current_app_person_id() IS DISTINCT FROM p_person_id THEN
    RAISE EXCEPTION 'person_mismatch' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_offer FROM public."Offer" WHERE "id" = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'offer_not_found' USING ERRCODE = 'P0002'; END IF;
  IF v_offer."personId" <> p_person_id THEN RAISE EXCEPTION 'offer_person_mismatch' USING ERRCODE = '42501'; END IF;
  IF auth.role() <> 'service_role' AND public.current_app_organization_id() IS DISTINCT FROM v_offer."organizationId" THEN
    RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_idempotency FROM public.claim_idempotent_operation(
    v_offer."organizationId", 'person', p_person_id, 'decline_rental_offer', v_key, v_req_hash, 120
  );
  IF v_idempotency."isReplay" THEN RETURN v_idempotency."responseBody"; END IF;
  IF v_offer."status" <> 'SENT' THEN RAISE EXCEPTION 'offer_not_open' USING ERRCODE = 'P0001'; END IF;

  SELECT l."unitId" INTO v_unit_id FROM public."Listing" l WHERE l."id" = v_offer."listingId" FOR UPDATE;
  UPDATE public."Offer" SET "status" = 'DECLINED', "respondedAt" = CURRENT_TIMESTAMP, "version" = "version" + 1
  WHERE "id" = p_offer_id;
  UPDATE public."Application" SET "status" = 'DECLINED', "version" = "version" + 1
  WHERE "id" = v_offer."applicationId";
  INSERT INTO public."ApplicationStatusEvent" ("applicationId", "fromStatus", "toStatus", "comment")
  VALUES (v_offer."applicationId", 'OFFER_SENT', 'DECLINED', 'Erbjudande avböjt');

  IF NOT EXISTS (SELECT 1 FROM public."Reservation" WHERE "unitId" = v_unit_id AND "status" = 'ACTIVE')
     AND NOT EXISTS (SELECT 1 FROM public."Contract" WHERE "unitId" = v_unit_id AND "status" IN ('SENT_FOR_SIGNING','PARTIALLY_SIGNED','SIGNED','ACTIVE'))
     AND NOT EXISTS (SELECT 1 FROM public."Offer" o JOIN public."Listing" l ON l."id" = o."listingId"
                     WHERE l."unitId" = v_unit_id AND o."status" IN ('SENT','ACCEPTED')) THEN
    UPDATE public."Unit" SET "status" = 'PUBLISHED' WHERE "id" = v_unit_id;
  END IF;

  PERFORM public.write_audit_event(v_offer."organizationId", 'offer_declined', 'offer', p_offer_id,
    jsonb_build_object('status', 'SENT'), jsonb_build_object('status', 'DECLINED'), 'person', p_person_id, v_key);
  v_response := jsonb_build_object('offerId', p_offer_id, 'status', 'DECLINED');
  PERFORM public.complete_idempotent_operation(v_idempotency."recordId", 200, v_response);
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_contract_version(
  p_contract_id text,
  p_content jsonb,
  p_document_hash text,
  p_expected_contract_version integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_contract public."Contract"%ROWTYPE;
  v_next integer;
  v_id text := gen_random_uuid()::text;
BEGIN
  SELECT * INTO v_contract FROM public."Contract" WHERE "id" = p_contract_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'contract_not_found' USING ERRCODE = 'P0002'; END IF;
  IF auth.role() <> 'service_role' AND public.current_app_organization_id() IS DISTINCT FROM v_contract."organizationId" THEN
    RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501';
  END IF;
  IF auth.role() <> 'service_role' AND NOT public.app_has_permission('contracts:update') THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;
  IF v_contract."version" <> p_expected_contract_version THEN
    RAISE EXCEPTION 'optimistic_lock_conflict' USING ERRCODE = '40001';
  END IF;
  IF v_contract."status" IN ('SIGNED','ACTIVE','TERMINATED','ENDED','RESCINDED','ARCHIVED') THEN
    RAISE EXCEPTION 'contract_version_locked' USING ERRCODE = '55000';
  END IF;
  SELECT COALESCE(max("versionNumber"),0)+1 INTO v_next
  FROM public."ContractVersion" WHERE "contractId" = p_contract_id;
  INSERT INTO public."ContractVersion" ("id", "contractId", "versionNumber", "content", "documentHash", "createdByUserId")
  VALUES (v_id, p_contract_id, v_next, p_content, p_document_hash, public.current_app_user_id());
  UPDATE public."Contract" SET "version" = "version" + 1 WHERE "id" = p_contract_id;
  PERFORM public.write_audit_event(v_contract."organizationId", 'contract_version_created', 'contract_version', v_id,
    NULL, jsonb_build_object('contractId', p_contract_id, 'versionNumber', v_next, 'documentHash', p_document_hash));
  RETURN jsonb_build_object('contractVersionId', v_id, 'versionNumber', v_next, 'documentHash', p_document_hash);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_signing_session(
  p_contract_id text,
  p_contract_version_id text,
  p_expires_at timestamp
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_contract public."Contract"%ROWTYPE;
  v_version public."ContractVersion"%ROWTYPE;
  v_id text := gen_random_uuid()::text;
BEGIN
  IF p_expires_at <= CURRENT_TIMESTAMP THEN
    RAISE EXCEPTION 'signing_session_expiry_must_be_future' USING ERRCODE = '22007';
  END IF;
  SELECT * INTO v_contract FROM public."Contract" WHERE "id" = p_contract_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'contract_not_found' USING ERRCODE = 'P0002'; END IF;
  IF auth.role() <> 'service_role' AND public.current_app_organization_id() IS DISTINCT FROM v_contract."organizationId" THEN
    RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_version FROM public."ContractVersion"
    WHERE "id" = p_contract_version_id AND "contractId" = p_contract_id;
  IF NOT FOUND OR v_version."documentHash" IS NULL THEN RAISE EXCEPTION 'contract_version_not_signable' USING ERRCODE = 'P0001'; END IF;
  IF auth.role() <> 'service_role' AND NOT public.app_has_permission('contracts:approve') THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;
  UPDATE public."SigningSession" SET "status" = 'CANCELLED'
  WHERE "contractId" = p_contract_id AND "status" = 'OPEN';
  INSERT INTO public."SigningSession" ("id", "organizationId", "contractId", "contractVersionId", "expiresAt")
  VALUES (v_id, v_contract."organizationId", p_contract_id, p_contract_version_id, p_expires_at);
  UPDATE public."Contract" SET "status" = 'SENT_FOR_SIGNING', "version" = "version" + 1 WHERE "id" = p_contract_id;
  RETURN jsonb_build_object('signingSessionId', v_id, 'contractVersionId', p_contract_version_id, 'expiresAt', p_expires_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_contract_signature(
  p_signing_session_id text,
  p_person_id text,
  p_document_hash text,
  p_authentication_method text,
  p_provider_reference text DEFAULT NULL,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_evidence jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session public."SigningSession"%ROWTYPE;
  v_version public."ContractVersion"%ROWTYPE;
  v_party public."ContractParty"%ROWTYPE;
  v_signature_id text := gen_random_uuid()::text;
  v_remaining integer;
  v_new_status public."ContractStatus";
  v_old_status public."ContractStatus";
BEGIN
  IF auth.role() <> 'service_role' AND public.current_app_person_id() IS DISTINCT FROM p_person_id THEN
    RAISE EXCEPTION 'person_mismatch' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_session FROM public."SigningSession" WHERE "id" = p_signing_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'signing_session_not_found' USING ERRCODE = 'P0002'; END IF;
  IF auth.role() <> 'service_role' AND public.current_app_organization_id() IS DISTINCT FROM v_session."organizationId" THEN
    RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501';
  END IF;
  IF v_session."status" <> 'OPEN' OR v_session."expiresAt" <= CURRENT_TIMESTAMP THEN
    RAISE EXCEPTION 'signing_session_not_open' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_version FROM public."ContractVersion" WHERE "id" = v_session."contractVersionId";
  IF v_version."documentHash" IS DISTINCT FROM p_document_hash THEN
    RAISE EXCEPTION 'document_hash_mismatch' USING ERRCODE = '22000';
  END IF;
  SELECT * INTO v_party FROM public."ContractParty"
  WHERE "contractId" = v_session."contractId" AND "personId" = p_person_id AND "requiredSignature" = true
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'contract_party_not_found' USING ERRCODE = 'P0002'; END IF;

  INSERT INTO public."ContractSignature" (
    "id", "organizationId", "signingSessionId", "contractId", "contractVersionId",
    "contractPartyId", "personId", "authUserId", "documentHash", "authenticationMethod",
    "providerReference", "ip", "userAgent", "evidence"
  ) VALUES (
    v_signature_id, v_session."organizationId", v_session."id", v_session."contractId", v_session."contractVersionId",
    v_party."id", p_person_id, auth.uid(), p_document_hash, p_authentication_method,
    p_provider_reference, p_ip, p_user_agent, p_evidence
  );

  UPDATE public."ContractParty"
  SET "signedAt" = CURRENT_TIMESTAMP, "signatureMethod" = p_authentication_method
  WHERE "id" = v_party."id";

  SELECT count(*) INTO v_remaining
  FROM public."ContractParty" cp
  WHERE cp."contractId" = v_session."contractId"
    AND cp."requiredSignature" = true
    AND cp."role" <> 'LANDLORD'
    AND NOT EXISTS (
      SELECT 1 FROM public."ContractSignature" cs
      WHERE cs."signingSessionId" = v_session."id" AND cs."contractPartyId" = cp."id"
    );
  SELECT c."status" INTO v_old_status FROM public."Contract" c
  WHERE c."id" = v_session."contractId" FOR UPDATE;
  v_new_status := CASE WHEN v_remaining = 0 THEN 'SIGNED'::public."ContractStatus" ELSE 'PARTIALLY_SIGNED'::public."ContractStatus" END;
  UPDATE public."Contract" SET "status" = v_new_status, "version" = "version" + 1 WHERE "id" = v_session."contractId";
  INSERT INTO public."ContractStatusEvent" ("contractId", "fromStatus", "toStatus", "comment")
  VALUES (v_session."contractId", v_old_status, v_new_status, 'Verifierad signatur registrerad');
  IF v_remaining = 0 THEN
    UPDATE public."SigningSession" SET "status" = 'COMPLETED', "completedAt" = CURRENT_TIMESTAMP WHERE "id" = v_session."id";
  END IF;
  PERFORM public.write_audit_event(v_session."organizationId", 'contract_signature_recorded', 'contract_signature', v_signature_id,
    NULL, jsonb_build_object('contractId', v_session."contractId", 'personId', p_person_id,
      'documentHash', p_document_hash, 'authenticationMethod', p_authentication_method), 'person', p_person_id);
  RETURN jsonb_build_object('signatureId', v_signature_id, 'contractId', v_session."contractId", 'status', v_new_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.countersign_contract(
  p_contract_id text,
  p_contract_version_id text,
  p_document_hash text,
  p_final_pdf_storage_key text,
  p_final_pdf_hash text,
  p_evidence_report jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_contract public."Contract"%ROWTYPE;
  v_version public."ContractVersion"%ROWTYPE;
  v_report_id text := gen_random_uuid()::text;
BEGIN
  IF NULLIF(trim(p_final_pdf_storage_key), '') IS NULL
     OR NULLIF(trim(p_final_pdf_hash), '') IS NULL
     OR NULLIF(trim(p_document_hash), '') IS NULL THEN
    RAISE EXCEPTION 'final_document_evidence_required' USING ERRCODE = '22023';
  END IF;
  IF auth.role() <> 'service_role' AND NOT public.app_has_permission('contracts:approve') THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_contract FROM public."Contract" WHERE "id" = p_contract_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'contract_not_found' USING ERRCODE = 'P0002'; END IF;
  IF auth.role() <> 'service_role' AND public.current_app_organization_id() IS DISTINCT FROM v_contract."organizationId" THEN
    RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_version FROM public."ContractVersion"
  WHERE "id" = p_contract_version_id AND "contractId" = p_contract_id FOR UPDATE;
  IF NOT FOUND OR v_version."documentHash" IS DISTINCT FROM p_document_hash THEN
    RAISE EXCEPTION 'contract_version_hash_mismatch' USING ERRCODE = '22000';
  END IF;
  IF v_contract."status" <> 'SIGNED' THEN RAISE EXCEPTION 'tenant_signatures_incomplete' USING ERRCODE = 'P0001'; END IF;
  IF EXISTS (
    SELECT 1
    FROM public."ContractParty" cp
    WHERE cp."contractId" = p_contract_id
      AND cp."requiredSignature" = true
      AND cp."role" <> 'LANDLORD'
      AND NOT EXISTS (
        SELECT 1
        FROM public."ContractSignature" cs
        WHERE cs."contractId" = p_contract_id
          AND cs."contractVersionId" = p_contract_version_id
          AND cs."contractPartyId" = cp."id"
          AND cs."documentHash" = p_document_hash
      )
  ) THEN
    RAISE EXCEPTION 'tenant_signature_evidence_incomplete' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public."ContractVersion"
  SET "finalPdfHash" = p_final_pdf_hash, "finalPdfStorageKey" = p_final_pdf_storage_key, "lockedAt" = CURRENT_TIMESTAMP
  WHERE "id" = p_contract_version_id;
  UPDATE public."Contract"
  SET "landlordCountersignedAt" = CURRENT_TIMESTAMP,
      "landlordCountersignedByUserId" = public.current_app_user_id(),
      "finalDocumentHash" = p_final_pdf_hash,
      "finalPdfStorageKey" = p_final_pdf_storage_key,
      "version" = "version" + 1
  WHERE "id" = p_contract_id;
  INSERT INTO public."EvidenceReport" (
    "id", "organizationId", "contractId", "contractVersionId", "documentHash", "finalPdfHash", "report"
  ) VALUES (v_report_id, v_contract."organizationId", p_contract_id, p_contract_version_id,
    p_document_hash, p_final_pdf_hash, p_evidence_report);
  PERFORM public.write_audit_event(v_contract."organizationId", 'contract_countersigned', 'contract', p_contract_id,
    NULL, jsonb_build_object('contractVersionId', p_contract_version_id, 'finalPdfHash', p_final_pdf_hash));
  RETURN jsonb_build_object('contractId', p_contract_id, 'evidenceReportId', v_report_id, 'countersigned', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_signed_contract(
  p_contract_id text,
  p_idempotency_key text,
  p_request_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_contract public."Contract"%ROWTYPE;
  v_reservation public."Reservation"%ROWTYPE;
  v_listing_id text;
  v_idempotency record;
  v_response jsonb;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.app_has_permission('contracts:activate') THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_contract FROM public."Contract" WHERE "id" = p_contract_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'contract_not_found' USING ERRCODE = 'P0002'; END IF;
  IF auth.role() <> 'service_role' AND public.current_app_organization_id() IS DISTINCT FROM v_contract."organizationId" THEN
    RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_idempotency FROM public.claim_idempotent_operation(
    v_contract."organizationId", 'user', COALESCE(public.current_app_user_id(), 'service_role'),
    'activate_signed_contract', p_idempotency_key, p_request_hash, 120
  );
  IF v_idempotency."isReplay" THEN RETURN v_idempotency."responseBody"; END IF;
  IF v_contract."status" <> 'SIGNED' THEN RAISE EXCEPTION 'contract_not_signed' USING ERRCODE = 'P0001'; END IF;
  IF v_contract."landlordCountersignedAt" IS NULL OR v_contract."finalDocumentHash" IS NULL OR v_contract."finalPdfStorageKey" IS NULL THEN
    RAISE EXCEPTION 'countersign_or_final_pdf_missing' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public."ContractParty" cp
    WHERE cp."contractId" = p_contract_id AND cp."requiredSignature" = true AND cp."role" <> 'LANDLORD'
      AND cp."signedAt" IS NULL
  ) THEN RAISE EXCEPTION 'required_signatures_missing' USING ERRCODE = 'P0001'; END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public."ContractVersion" cv
    JOIN public."EvidenceReport" er
      ON er."contractVersionId" = cv."id" AND er."contractId" = cv."contractId"
    WHERE cv."contractId" = p_contract_id
      AND cv."lockedAt" IS NOT NULL
      AND cv."finalPdfHash" = v_contract."finalDocumentHash"
      AND cv."finalPdfStorageKey" = v_contract."finalPdfStorageKey"
      AND er."documentHash" = cv."documentHash"
      AND er."finalPdfHash" = cv."finalPdfHash"
      AND NOT EXISTS (
        SELECT 1
        FROM public."ContractSignature" cs
        WHERE cs."contractId" = p_contract_id
          AND cs."contractVersionId" = cv."id"
          AND cs."documentHash" IS DISTINCT FROM cv."documentHash"
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public."ContractParty" cp
        WHERE cp."contractId" = p_contract_id
          AND cp."requiredSignature" = true
          AND cp."role" <> 'LANDLORD'
          AND NOT EXISTS (
            SELECT 1
            FROM public."ContractSignature" cs
            WHERE cs."contractId" = p_contract_id
              AND cs."contractVersionId" = cv."id"
              AND cs."contractPartyId" = cp."id"
              AND cs."documentHash" = cv."documentHash"
          )
      )
  ) THEN
    RAISE EXCEPTION 'signature_or_evidence_chain_invalid' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_reservation FROM public."Reservation"
  WHERE "contractId" = p_contract_id AND "status" = 'ACTIVE' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'active_reservation_missing' USING ERRCODE = 'P0001'; END IF;

  UPDATE public."Contract"
  SET "status" = 'ACTIVE', "activatedAt" = CURRENT_TIMESTAMP, "version" = "version" + 1
  WHERE "id" = p_contract_id;
  UPDATE public."Reservation" SET "status" = 'CONVERTED' WHERE "id" = v_reservation."id";
  UPDATE public."Unit" SET "status" = 'RENTED' WHERE "id" = v_contract."unitId";
  SELECT "listingId" INTO v_listing_id FROM public."Reservation" WHERE "id" = v_reservation."id";
  IF v_listing_id IS NOT NULL THEN
    UPDATE public."Listing" SET "status" = 'COMPLETED', "completedAt" = CURRENT_TIMESTAMP WHERE "id" = v_listing_id;
    UPDATE public."Offer" SET "status" = 'WITHDRAWN', "version" = "version" + 1
      WHERE "listingId" = v_listing_id AND "contractId" IS DISTINCT FROM p_contract_id AND "status" = 'SENT';
  END IF;
  INSERT INTO public."ContractStatusEvent" ("contractId", "fromStatus", "toStatus", "comment", "changedByUserId")
  VALUES (p_contract_id, 'SIGNED', 'ACTIVE', 'Avtal aktiverat atomiskt', public.current_app_user_id());
  INSERT INTO public."MoveInCase" ("organizationId", "contractId", "unitId")
  VALUES (v_contract."organizationId", p_contract_id, v_contract."unitId")
  ON CONFLICT ("contractId") DO NOTHING;
  PERFORM public.enqueue_outbox_event(v_contract."organizationId", 'contract.activated', 'contract', p_contract_id,
    NULL, jsonb_build_object('contractId', p_contract_id, 'unitId', v_contract."unitId"), 'contract.activated:' || p_contract_id);
  PERFORM public.write_audit_event(v_contract."organizationId", 'contract_activated', 'contract', p_contract_id,
    jsonb_build_object('status', v_contract."status"), jsonb_build_object('status', 'ACTIVE'), 'user', public.current_app_user_id(), p_idempotency_key);
  v_response := jsonb_build_object('contractId', p_contract_id, 'status', 'ACTIVE', 'moveInCreated', true);
  PERFORM public.complete_idempotent_operation(v_idempotency."recordId", 200, v_response);
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_contract_termination(
  p_contract_id text,
  p_person_id text,
  p_desired_move_out_date timestamp,
  p_reason text DEFAULT NULL,
  p_is_internal_transfer boolean DEFAULT false,
  p_new_contract_id text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_request_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_contract public."Contract"%ROWTYPE;
  v_earliest timestamp;
  v_effective timestamp;
  v_id text := gen_random_uuid()::text;
  v_idempotency record;
  v_response jsonb;
  v_key text := COALESCE(NULLIF(p_idempotency_key,''), gen_random_uuid()::text);
  v_req_hash text := COALESCE(NULLIF(p_request_hash,''), encode(digest(convert_to(
    p_contract_id || ':' || p_person_id || ':' || p_desired_move_out_date::text || ':' || COALESCE(p_reason,''), 'UTF8'), 'sha256'), 'hex'));
BEGIN
  IF auth.role() <> 'service_role' AND public.current_app_person_id() IS DISTINCT FROM p_person_id THEN
    RAISE EXCEPTION 'person_mismatch' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_contract FROM public."Contract" WHERE "id" = p_contract_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'contract_not_found' USING ERRCODE = 'P0002'; END IF;
  IF auth.role() <> 'service_role' AND public.current_app_organization_id() IS DISTINCT FROM v_contract."organizationId" THEN
    RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public."ContractParty" WHERE "contractId" = p_contract_id
                 AND "personId" = p_person_id AND "role" IN ('TENANT','CO_TENANT')) THEN
    RAISE EXCEPTION 'not_contract_party' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_idempotency FROM public.claim_idempotent_operation(
    v_contract."organizationId", 'person', p_person_id, 'request_contract_termination', v_key, v_req_hash, 120
  );
  IF v_idempotency."isReplay" THEN RETURN v_idempotency."responseBody"; END IF;

  IF v_contract."status" <> 'ACTIVE' THEN RAISE EXCEPTION 'contract_not_active' USING ERRCODE = 'P0001'; END IF;
  IF EXISTS (SELECT 1 FROM public."Termination" WHERE "contractId" = p_contract_id
             AND "status" IN ('REQUESTED','CONFIRMED','INSPECTION_BOOKED')) THEN
    RAISE EXCEPTION 'termination_already_open' USING ERRCODE = '23505';
  END IF;
  v_earliest := (date_trunc('month', CURRENT_TIMESTAMP) + make_interval(months => v_contract."noticePeriodMonths" + 1) - INTERVAL '1 day')::timestamp;
  v_effective := GREATEST(p_desired_move_out_date, v_earliest);
  INSERT INTO public."Termination" (
    "id", "organizationId", "contractId", "requestedByPersonId", "desiredMoveOutDate",
    "earliestEndDate", "effectiveEndDate", "status", "reason", "isInternalTransfer", "newContractId"
  ) VALUES (
    v_id, v_contract."organizationId", p_contract_id, p_person_id, p_desired_move_out_date,
    v_earliest, v_effective, 'REQUESTED', p_reason, p_is_internal_transfer, p_new_contract_id
  );
  UPDATE public."Contract"
  SET "terminationEffectiveDate" = v_effective, "version" = "version" + 1
  WHERE "id" = p_contract_id;
  UPDATE public."Unit" SET "status" = 'UPCOMING', "availableFrom" = v_effective WHERE "id" = v_contract."unitId";
  INSERT INTO public."MoveOutCase" ("organizationId", "contractId", "terminationId", "unitId")
  VALUES (v_contract."organizationId", p_contract_id, v_id, v_contract."unitId");
  PERFORM public.write_audit_event(v_contract."organizationId", 'termination_requested', 'termination', v_id,
    NULL, jsonb_build_object('contractId', p_contract_id, 'effectiveEndDate', v_effective,
      'contractRemainsActive', true, 'isInternalTransfer', p_is_internal_transfer), 'person', p_person_id, v_key);
  v_response := jsonb_build_object('terminationId', v_id, 'status', 'REQUESTED',
    'effectiveEndDate', v_effective, 'contractStatus', 'ACTIVE');
  PERFORM public.complete_idempotent_operation(v_idempotency."recordId", 201, v_response);
  RETURN v_response;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_contract_termination(
  p_termination_id text,
  p_expected_version integer,
  p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_termination public."Termination"%ROWTYPE;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.app_has_permission('contracts:update') THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_termination FROM public."Termination" WHERE "id" = p_termination_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'termination_not_found' USING ERRCODE = 'P0002'; END IF;
  IF auth.role() <> 'service_role' AND public.current_app_organization_id() IS DISTINCT FROM v_termination."organizationId" THEN
    RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501';
  END IF;
  IF v_termination."version" <> p_expected_version THEN RAISE EXCEPTION 'optimistic_lock_conflict' USING ERRCODE = '40001'; END IF;
  IF v_termination."status" <> 'REQUESTED' THEN RAISE EXCEPTION 'termination_not_request' USING ERRCODE = 'P0001'; END IF;
  UPDATE public."Termination" SET "status" = 'CONFIRMED', "version" = "version" + 1 WHERE "id" = p_termination_id;
  PERFORM public.write_audit_event(v_termination."organizationId", 'termination_confirmed', 'termination', p_termination_id,
    jsonb_build_object('status', 'REQUESTED'), jsonb_build_object('status', 'CONFIRMED', 'comment', p_comment));
  RETURN jsonb_build_object('terminationId', p_termination_id, 'status', 'CONFIRMED');
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_contract_termination(
  p_termination_id text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_termination public."Termination"%ROWTYPE;
  v_contract public."Contract"%ROWTYPE;
BEGIN
  SELECT * INTO v_termination FROM public."Termination" WHERE "id" = p_termination_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'termination_not_found' USING ERRCODE = 'P0002'; END IF;
  IF auth.role() <> 'service_role' AND public.current_app_organization_id() IS DISTINCT FROM v_termination."organizationId" THEN
    RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501';
  END IF;
  IF auth.role() <> 'service_role'
     AND public.current_app_person_id() IS DISTINCT FROM v_termination."requestedByPersonId"
     AND NOT public.app_has_permission('contracts:update') THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;
  IF v_termination."status" NOT IN ('REQUESTED','CONFIRMED') THEN RAISE EXCEPTION 'termination_cannot_cancel' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO v_contract FROM public."Contract" WHERE "id" = v_termination."contractId" FOR UPDATE;
  UPDATE public."Termination" SET "status" = 'CANCELLED', "version" = "version" + 1 WHERE "id" = p_termination_id;
  UPDATE public."Contract" SET "terminationEffectiveDate" = NULL, "version" = "version" + 1 WHERE "id" = v_contract."id";
  UPDATE public."Unit" SET "status" = 'RENTED', "availableFrom" = NULL WHERE "id" = v_contract."unitId" AND v_contract."status" = 'ACTIVE';
  UPDATE public."MoveOutCase" SET "status" = 'CANCELLED' WHERE "terminationId" = p_termination_id;
  PERFORM public.write_audit_event(v_termination."organizationId", 'termination_cancelled', 'termination', p_termination_id,
    jsonb_build_object('status', v_termination."status"), jsonb_build_object('status', 'CANCELLED', 'reason', p_reason));
  RETURN jsonb_build_object('terminationId', p_termination_id, 'status', 'CANCELLED', 'contractStatus', v_contract."status");
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_internal_transfer(
  p_old_contract_id text,
  p_new_contract_id text,
  p_person_id text,
  p_effective_end_date timestamp
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_old public."Contract"%ROWTYPE;
  v_new public."Contract"%ROWTYPE;
  v_result jsonb;
BEGIN
  IF auth.role() <> 'service_role' AND public.current_app_person_id() IS DISTINCT FROM p_person_id THEN
    RAISE EXCEPTION 'person_mismatch' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_new FROM public."Contract" WHERE "id" = p_new_contract_id FOR UPDATE;
  IF NOT FOUND OR v_new."status" <> 'ACTIVE' THEN RAISE EXCEPTION 'new_contract_not_active' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO v_old FROM public."Contract" WHERE "id" = p_old_contract_id FOR UPDATE;
  IF NOT FOUND OR v_old."status" <> 'ACTIVE' THEN RAISE EXCEPTION 'old_contract_not_active' USING ERRCODE = 'P0001'; END IF;
  IF v_old."organizationId" <> v_new."organizationId" THEN RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501'; END IF;
  IF auth.role() <> 'service_role' AND public.current_app_organization_id() IS DISTINCT FROM v_old."organizationId" THEN
    RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public."ContractParty" WHERE "contractId" = v_old."id" AND "personId" = p_person_id)
     OR NOT EXISTS (SELECT 1 FROM public."ContractParty" WHERE "contractId" = v_new."id" AND "personId" = p_person_id) THEN
    RAISE EXCEPTION 'person_not_party_to_both_contracts' USING ERRCODE = '42501';
  END IF;
  v_result := public.request_contract_termination(v_old."id", p_person_id, p_effective_end_date,
    'Intern omflyttning', true, v_new."id");
  UPDATE public."Contract" SET "replacesContractId" = v_old."id", "version" = "version" + 1 WHERE "id" = v_new."id";
  RETURN v_result || jsonb_build_object('oldContractId', v_old."id", 'newContractId', v_new."id");
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_move_in(
  p_move_in_id text,
  p_checklist jsonb,
  p_expected_contract_version integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_case public."MoveInCase"%ROWTYPE;
  v_contract public."Contract"%ROWTYPE;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.app_has_permission('contracts:update') THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_case FROM public."MoveInCase" WHERE "id" = p_move_in_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'move_in_not_found' USING ERRCODE = 'P0002'; END IF;
  IF auth.role() <> 'service_role' AND public.current_app_organization_id() IS DISTINCT FROM v_case."organizationId" THEN
    RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_contract FROM public."Contract" WHERE "id" = v_case."contractId" FOR UPDATE;
  IF v_contract."version" <> p_expected_contract_version THEN RAISE EXCEPTION 'optimistic_lock_conflict' USING ERRCODE = '40001'; END IF;
  IF v_contract."status" <> 'ACTIVE' THEN RAISE EXCEPTION 'contract_not_active' USING ERRCODE = 'P0001'; END IF;
  IF NOT (
    COALESCE((p_checklist->>'identityVerified')::boolean, false)
    AND COALESCE((p_checklist->>'inspectionCompleted')::boolean, false)
    AND COALESCE((p_checklist->>'keyReceiptCompleted')::boolean, false)
    AND COALESCE((p_checklist->>'tenantInformationAccepted')::boolean, false)
  ) THEN
    RAISE EXCEPTION 'move_in_checklist_incomplete' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public."MoveInCase" SET "status" = 'COMPLETED', "checklist" = p_checklist,
    "completedAt" = CURRENT_TIMESTAMP, "completedByUserId" = public.current_app_user_id() WHERE "id" = p_move_in_id;
  PERFORM public.write_audit_event(v_case."organizationId", 'move_in_completed', 'move_in', p_move_in_id,
    NULL, jsonb_build_object('contractId', v_case."contractId"));
  RETURN jsonb_build_object('moveInId', p_move_in_id, 'status', 'COMPLETED');
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_move_out(
  p_move_out_id text,
  p_checklist jsonb,
  p_unit_status public."UnitStatus" DEFAULT 'NOT_PUBLISHED'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_case public."MoveOutCase"%ROWTYPE;
  v_contract public."Contract"%ROWTYPE;
  v_termination public."Termination"%ROWTYPE;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.app_has_permission('contracts:update') THEN
    RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_case FROM public."MoveOutCase" WHERE "id" = p_move_out_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'move_out_not_found' USING ERRCODE = 'P0002'; END IF;
  IF auth.role() <> 'service_role' AND public.current_app_organization_id() IS DISTINCT FROM v_case."organizationId" THEN
    RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_contract FROM public."Contract" WHERE "id" = v_case."contractId" FOR UPDATE;
  SELECT * INTO v_termination FROM public."Termination" WHERE "id" = v_case."terminationId" FOR UPDATE;
  IF v_termination."status" <> 'CONFIRMED' THEN RAISE EXCEPTION 'termination_not_confirmed' USING ERRCODE = 'P0001'; END IF;
  IF v_termination."effectiveEndDate" > CURRENT_TIMESTAMP THEN RAISE EXCEPTION 'contract_end_date_not_reached' USING ERRCODE = 'P0001'; END IF;
  IF NOT (
    COALESCE((p_checklist->>'inspectionCompleted')::boolean, false)
    AND COALESCE((p_checklist->>'keysReturned')::boolean, false)
    AND COALESCE((p_checklist->>'meterReadingRecorded')::boolean, false)
    AND COALESCE((p_checklist->>'settlementReviewed')::boolean, false)
  ) THEN
    RAISE EXCEPTION 'move_out_checklist_incomplete' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public."MoveOutCase" SET "status" = 'COMPLETED', "checklist" = p_checklist,
    "completedAt" = CURRENT_TIMESTAMP, "completedByUserId" = public.current_app_user_id() WHERE "id" = p_move_out_id;
  UPDATE public."Termination" SET "status" = 'COMPLETED', "version" = "version" + 1 WHERE "id" = v_termination."id";
  UPDATE public."Contract" SET "status" = 'ENDED', "endDate" = v_termination."effectiveEndDate",
    "terminatedAt" = CURRENT_TIMESTAMP, "version" = "version" + 1 WHERE "id" = v_contract."id";
  UPDATE public."Unit" SET "status" = p_unit_status WHERE "id" = v_case."unitId";
  INSERT INTO public."ContractStatusEvent" ("contractId", "fromStatus", "toStatus", "comment", "changedByUserId")
  VALUES (v_contract."id", v_contract."status", 'ENDED', 'Avflyttning slutförd', public.current_app_user_id());
  PERFORM public.write_audit_event(v_case."organizationId", 'move_out_completed', 'move_out', p_move_out_id,
    NULL, jsonb_build_object('contractId', v_contract."id", 'unitStatus', p_unit_status));
  RETURN jsonb_build_object('moveOutId', p_move_out_id, 'status', 'COMPLETED', 'contractStatus', 'ENDED', 'unitStatus', p_unit_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_outbox_jobs(
  p_worker_id text,
  p_limit integer DEFAULT 25,
  p_lease_seconds integer DEFAULT 60
)
RETURNS SETOF public."OutboxEvent"
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'worker_role_required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH picked AS (
    SELECT "id"
    FROM public."OutboxEvent"
    WHERE "status" IN ('PENDING','FAILED')
      AND "nextAttemptAt" <= CURRENT_TIMESTAMP
      AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" <= CURRENT_TIMESTAMP)
    ORDER BY "createdAt"
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(1, LEAST(p_limit, 100))
  )
  UPDATE public."OutboxEvent" o
  SET "status" = 'PROCESSING',
      "claimedAt" = CURRENT_TIMESTAMP,
      "claimedBy" = p_worker_id,
      "leaseExpiresAt" = CURRENT_TIMESTAMP + make_interval(secs => GREATEST(p_lease_seconds, 1)),
      "attemptCount" = o."attemptCount" + 1
  FROM picked
  WHERE o."id" = picked."id"
  RETURNING o.*;
END;
$$;

ALTER TABLE public."ApplicationSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Reservation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SigningSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ContractSignature" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EvidenceReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MoveInCase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MoveOutCase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OutboxEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OperationIdempotency" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_app_organization_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_app_person_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_has_permission(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_rental_application(text,text,jsonb,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.withdraw_rental_application(text,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_viewing_booking(text,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_viewing_booking(text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.send_rental_offer(text,timestamp,integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_rental_offer(text,text,timestamp,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.decline_rental_offer(text,text,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_contract_signature(text,text,text,text,text,text,text,jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.request_contract_termination(text,text,timestamp,text,boolean,text,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_contract_termination(text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_internal_transfer(text,text,text,timestamp) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_contract_version(text,jsonb,text,integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_signing_session(text,text,timestamp) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.countersign_contract(text,text,text,text,text,jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.activate_signed_contract(text,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_contract_termination(text,integer,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_move_in(text,jsonb,integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_move_out(text,jsonb,public."UnitStatus") TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_outbox_jobs(text,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_idempotent_operation(text,text,text,text,text,text,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_idempotent_operation(text,integer,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_idempotent_operation(text,text) TO service_role;

COMMIT;
