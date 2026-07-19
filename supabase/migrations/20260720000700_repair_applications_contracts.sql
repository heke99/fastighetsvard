-- Östgöta El Teknik Fastighetsplattform
-- Step: Idempotent repair for applications and contracts
-- Safe to run in filename order. This file is transactional.

BEGIN;
SET LOCAL search_path = public, extensions;

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "listingId" TEXT NOT NULL;

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT';

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "isInternalTransfer" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "desiredMoveInDate" TIMESTAMP(3);

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "currentHousing" TEXT;

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "currentLandlord" TEXT;

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "employment" TEXT;

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "employer" TEXT;

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "employmentType" TEXT;

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "monthlyIncome" DECIMAL(12,2);

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "otherIncome" TEXT;

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "references" TEXT;

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "pets" TEXT;

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "vehicles" TEXT;

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "specialNeeds" TEXT;

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "message" TEXT;

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "consentGivenAt" TIMESTAMP(3);

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3);

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Application_pkey'
      AND conrelid = 'public."Application"'::regclass
  ) THEN
    ALTER TABLE public."Application" ADD CONSTRAINT "Application_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."ApplicationMember" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."ApplicationMember" ADD COLUMN IF NOT EXISTS "applicationId" TEXT NOT NULL;

ALTER TABLE public."ApplicationMember" ADD COLUMN IF NOT EXISTS "personId" TEXT NOT NULL;

ALTER TABLE public."ApplicationMember" ADD COLUMN IF NOT EXISTS "role" "ApplicationMemberRole" NOT NULL;

ALTER TABLE public."ApplicationMember" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ApplicationMember_pkey'
      AND conrelid = 'public."ApplicationMember"'::regclass
  ) THEN
    ALTER TABLE public."ApplicationMember" ADD CONSTRAINT "ApplicationMember_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."ApplicationStatusEvent" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."ApplicationStatusEvent" ADD COLUMN IF NOT EXISTS "applicationId" TEXT NOT NULL;

ALTER TABLE public."ApplicationStatusEvent" ADD COLUMN IF NOT EXISTS "fromStatus" "ApplicationStatus";

ALTER TABLE public."ApplicationStatusEvent" ADD COLUMN IF NOT EXISTS "toStatus" "ApplicationStatus" NOT NULL;

ALTER TABLE public."ApplicationStatusEvent" ADD COLUMN IF NOT EXISTS "comment" TEXT;

ALTER TABLE public."ApplicationStatusEvent" ADD COLUMN IF NOT EXISTS "changedByUserId" TEXT;

ALTER TABLE public."ApplicationStatusEvent" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ApplicationStatusEvent_pkey'
      AND conrelid = 'public."ApplicationStatusEvent"'::regclass
  ) THEN
    ALTER TABLE public."ApplicationStatusEvent" ADD CONSTRAINT "ApplicationStatusEvent_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."Viewing" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Viewing" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."Viewing" ADD COLUMN IF NOT EXISTS "listingId" TEXT NOT NULL;

ALTER TABLE public."Viewing" ADD COLUMN IF NOT EXISTS "kind" "ViewingKind" NOT NULL DEFAULT 'INDIVIDUAL';

ALTER TABLE public."Viewing" ADD COLUMN IF NOT EXISTS "startsAt" TIMESTAMP(3) NOT NULL;

ALTER TABLE public."Viewing" ADD COLUMN IF NOT EXISTS "endsAt" TIMESTAMP(3) NOT NULL;

ALTER TABLE public."Viewing" ADD COLUMN IF NOT EXISTS "maxAttendees" INTEGER;

ALTER TABLE public."Viewing" ADD COLUMN IF NOT EXISTS "location" TEXT;

ALTER TABLE public."Viewing" ADD COLUMN IF NOT EXISTS "notes" TEXT;

ALTER TABLE public."Viewing" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."Viewing" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Viewing_pkey'
      AND conrelid = 'public."Viewing"'::regclass
  ) THEN
    ALTER TABLE public."Viewing" ADD CONSTRAINT "Viewing_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."ViewingAttendee" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."ViewingAttendee" ADD COLUMN IF NOT EXISTS "viewingId" TEXT NOT NULL;

ALTER TABLE public."ViewingAttendee" ADD COLUMN IF NOT EXISTS "personId" TEXT NOT NULL;

ALTER TABLE public."ViewingAttendee" ADD COLUMN IF NOT EXISTS "applicationId" TEXT;

ALTER TABLE public."ViewingAttendee" ADD COLUMN IF NOT EXISTS "status" "ViewingAttendeeStatus" NOT NULL DEFAULT 'BOOKED';

ALTER TABLE public."ViewingAttendee" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."ViewingAttendee" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ViewingAttendee_pkey'
      AND conrelid = 'public."ViewingAttendee"'::regclass
  ) THEN
    ALTER TABLE public."ViewingAttendee" ADD CONSTRAINT "ViewingAttendee_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."Offer" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Offer" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."Offer" ADD COLUMN IF NOT EXISTS "listingId" TEXT NOT NULL;

ALTER TABLE public."Offer" ADD COLUMN IF NOT EXISTS "applicationId" TEXT NOT NULL;

ALTER TABLE public."Offer" ADD COLUMN IF NOT EXISTS "personId" TEXT NOT NULL;

ALTER TABLE public."Offer" ADD COLUMN IF NOT EXISTS "status" "OfferStatus" NOT NULL DEFAULT 'SENT';

ALTER TABLE public."Offer" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3) NOT NULL;

ALTER TABLE public."Offer" ADD COLUMN IF NOT EXISTS "respondedAt" TIMESTAMP(3);

ALTER TABLE public."Offer" ADD COLUMN IF NOT EXISTS "decisionNote" TEXT;

ALTER TABLE public."Offer" ADD COLUMN IF NOT EXISTS "isInternalTransfer" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."Offer" ADD COLUMN IF NOT EXISTS "contractId" TEXT;

ALTER TABLE public."Offer" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."Offer" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Offer_pkey'
      AND conrelid = 'public."Offer"'::regclass
  ) THEN
    ALTER TABLE public."Offer" ADD CONSTRAINT "Offer_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "unitId" TEXT NOT NULL;

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "contractNumber" TEXT NOT NULL;

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "type" "ContractType" NOT NULL DEFAULT 'RESIDENTIAL';

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT';

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3) NOT NULL;

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3);

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "noticePeriodMonths" INTEGER NOT NULL DEFAULT 3;

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "rent" DECIMAL(12,2) NOT NULL;

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "rentAddons" JSONB;

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "deposit" DECIMAL(12,2);

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "invoiceReference" TEXT;

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "isImported" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "replacesContractId" TEXT;

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "terminatedAt" TIMESTAMP(3);

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "terminationEffectiveDate" TIMESTAMP(3);

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "activatedAt" TIMESTAMP(3);

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Contract_pkey'
      AND conrelid = 'public."Contract"'::regclass
  ) THEN
    ALTER TABLE public."Contract" ADD CONSTRAINT "Contract_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."ContractParty" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."ContractParty" ADD COLUMN IF NOT EXISTS "contractId" TEXT NOT NULL;

ALTER TABLE public."ContractParty" ADD COLUMN IF NOT EXISTS "personId" TEXT NOT NULL;

ALTER TABLE public."ContractParty" ADD COLUMN IF NOT EXISTS "role" "ContractPartyRole" NOT NULL;

ALTER TABLE public."ContractParty" ADD COLUMN IF NOT EXISTS "signedAt" TIMESTAMP(3);

ALTER TABLE public."ContractParty" ADD COLUMN IF NOT EXISTS "signatureMethod" TEXT;

ALTER TABLE public."ContractParty" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ContractParty_pkey'
      AND conrelid = 'public."ContractParty"'::regclass
  ) THEN
    ALTER TABLE public."ContractParty" ADD CONSTRAINT "ContractParty_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."ContractVersion" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."ContractVersion" ADD COLUMN IF NOT EXISTS "contractId" TEXT NOT NULL;

ALTER TABLE public."ContractVersion" ADD COLUMN IF NOT EXISTS "versionNumber" INTEGER NOT NULL;

ALTER TABLE public."ContractVersion" ADD COLUMN IF NOT EXISTS "content" JSONB NOT NULL;

ALTER TABLE public."ContractVersion" ADD COLUMN IF NOT EXISTS "documentHash" TEXT;

ALTER TABLE public."ContractVersion" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;

ALTER TABLE public."ContractVersion" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ContractVersion_pkey'
      AND conrelid = 'public."ContractVersion"'::regclass
  ) THEN
    ALTER TABLE public."ContractVersion" ADD CONSTRAINT "ContractVersion_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."ContractStatusEvent" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."ContractStatusEvent" ADD COLUMN IF NOT EXISTS "contractId" TEXT NOT NULL;

ALTER TABLE public."ContractStatusEvent" ADD COLUMN IF NOT EXISTS "fromStatus" "ContractStatus";

ALTER TABLE public."ContractStatusEvent" ADD COLUMN IF NOT EXISTS "toStatus" "ContractStatus" NOT NULL;

ALTER TABLE public."ContractStatusEvent" ADD COLUMN IF NOT EXISTS "comment" TEXT;

ALTER TABLE public."ContractStatusEvent" ADD COLUMN IF NOT EXISTS "changedByUserId" TEXT;

ALTER TABLE public."ContractStatusEvent" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ContractStatusEvent_pkey'
      AND conrelid = 'public."ContractStatusEvent"'::regclass
  ) THEN
    ALTER TABLE public."ContractStatusEvent" ADD CONSTRAINT "ContractStatusEvent_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."Termination" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Termination" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."Termination" ADD COLUMN IF NOT EXISTS "contractId" TEXT NOT NULL;

ALTER TABLE public."Termination" ADD COLUMN IF NOT EXISTS "requestedByPersonId" TEXT NOT NULL;

ALTER TABLE public."Termination" ADD COLUMN IF NOT EXISTS "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."Termination" ADD COLUMN IF NOT EXISTS "desiredMoveOutDate" TIMESTAMP(3) NOT NULL;

ALTER TABLE public."Termination" ADD COLUMN IF NOT EXISTS "earliestEndDate" TIMESTAMP(3) NOT NULL;

ALTER TABLE public."Termination" ADD COLUMN IF NOT EXISTS "effectiveEndDate" TIMESTAMP(3);

ALTER TABLE public."Termination" ADD COLUMN IF NOT EXISTS "status" "TerminationStatus" NOT NULL DEFAULT 'REQUESTED';

ALTER TABLE public."Termination" ADD COLUMN IF NOT EXISTS "reason" TEXT;

ALTER TABLE public."Termination" ADD COLUMN IF NOT EXISTS "isInternalTransfer" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."Termination" ADD COLUMN IF NOT EXISTS "newContractId" TEXT;

ALTER TABLE public."Termination" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."Termination" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Termination_pkey'
      AND conrelid = 'public."Termination"'::regclass
  ) THEN
    ALTER TABLE public."Termination" ADD CONSTRAINT "Termination_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."Inspection" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Inspection" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."Inspection" ADD COLUMN IF NOT EXISTS "unitId" TEXT NOT NULL;

ALTER TABLE public."Inspection" ADD COLUMN IF NOT EXISTS "type" "InspectionType" NOT NULL;

ALTER TABLE public."Inspection" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);

ALTER TABLE public."Inspection" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

ALTER TABLE public."Inspection" ADD COLUMN IF NOT EXISTS "inspectorName" TEXT;

ALTER TABLE public."Inspection" ADD COLUMN IF NOT EXISTS "result" TEXT;

ALTER TABLE public."Inspection" ADD COLUMN IF NOT EXISTS "notes" TEXT;

ALTER TABLE public."Inspection" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."Inspection" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Inspection_pkey'
      AND conrelid = 'public."Inspection"'::regclass
  ) THEN
    ALTER TABLE public."Inspection" ADD CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

COMMIT;
