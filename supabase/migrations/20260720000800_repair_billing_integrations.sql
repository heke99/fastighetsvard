-- Östgöta El Teknik Fastighetsplattform
-- Step: Idempotent repair for billing and integrations
-- Safe to run in filename order. This file is transactional.

BEGIN;
SET LOCAL search_path = public, extensions;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "personId" TEXT NOT NULL;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "contractId" TEXT;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "unitId" TEXT;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT NOT NULL;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT';

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "invoiceDate" TIMESTAMP(3) NOT NULL;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3) NOT NULL;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "periodStart" TIMESTAMP(3);

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "periodEnd" TIMESTAMP(3);

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "totalAmount" DECIMAL(12,2) NOT NULL;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "vatAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'SEK';

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "ocr" TEXT;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "bankgiro" TEXT;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "reference" TEXT;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "pdfUrl" TEXT;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "reminderCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "isCreditNote" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "creditsInvoiceId" TEXT;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Invoice_pkey'
      AND conrelid = 'public."Invoice"'::regclass
  ) THEN
    ALTER TABLE public."Invoice" ADD CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."InvoiceLine" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."InvoiceLine" ADD COLUMN IF NOT EXISTS "invoiceId" TEXT NOT NULL;

ALTER TABLE public."InvoiceLine" ADD COLUMN IF NOT EXISTS "description" TEXT NOT NULL;

ALTER TABLE public."InvoiceLine" ADD COLUMN IF NOT EXISTS "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1;

ALTER TABLE public."InvoiceLine" ADD COLUMN IF NOT EXISTS "unitPrice" DECIMAL(12,2) NOT NULL;

ALTER TABLE public."InvoiceLine" ADD COLUMN IF NOT EXISTS "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 25;

ALTER TABLE public."InvoiceLine" ADD COLUMN IF NOT EXISTS "amount" DECIMAL(12,2) NOT NULL;

ALTER TABLE public."InvoiceLine" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'InvoiceLine_pkey'
      AND conrelid = 'public."InvoiceLine"'::regclass
  ) THEN
    ALTER TABLE public."InvoiceLine" ADD CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."InvoiceStatusEvent" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."InvoiceStatusEvent" ADD COLUMN IF NOT EXISTS "invoiceId" TEXT NOT NULL;

ALTER TABLE public."InvoiceStatusEvent" ADD COLUMN IF NOT EXISTS "fromStatus" "InvoiceStatus";

ALTER TABLE public."InvoiceStatusEvent" ADD COLUMN IF NOT EXISTS "toStatus" "InvoiceStatus" NOT NULL;

ALTER TABLE public."InvoiceStatusEvent" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL;

ALTER TABLE public."InvoiceStatusEvent" ADD COLUMN IF NOT EXISTS "comment" TEXT;

ALTER TABLE public."InvoiceStatusEvent" ADD COLUMN IF NOT EXISTS "changedByUserId" TEXT;

ALTER TABLE public."InvoiceStatusEvent" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'InvoiceStatusEvent_pkey'
      AND conrelid = 'public."InvoiceStatusEvent"'::regclass
  ) THEN
    ALTER TABLE public."InvoiceStatusEvent" ADD CONSTRAINT "InvoiceStatusEvent_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."Payment" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Payment" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."Payment" ADD COLUMN IF NOT EXISTS "amount" DECIMAL(12,2) NOT NULL;

ALTER TABLE public."Payment" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'SEK';

ALTER TABLE public."Payment" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3) NOT NULL;

ALTER TABLE public."Payment" ADD COLUMN IF NOT EXISTS "method" TEXT;

ALTER TABLE public."Payment" ADD COLUMN IF NOT EXISTS "reference" TEXT;

ALTER TABLE public."Payment" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Payment_pkey'
      AND conrelid = 'public."Payment"'::regclass
  ) THEN
    ALTER TABLE public."Payment" ADD CONSTRAINT "Payment_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."PaymentAllocation" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."PaymentAllocation" ADD COLUMN IF NOT EXISTS "paymentId" TEXT NOT NULL;

ALTER TABLE public."PaymentAllocation" ADD COLUMN IF NOT EXISTS "invoiceId" TEXT NOT NULL;

ALTER TABLE public."PaymentAllocation" ADD COLUMN IF NOT EXISTS "amount" DECIMAL(12,2) NOT NULL;

ALTER TABLE public."PaymentAllocation" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PaymentAllocation_pkey'
      AND conrelid = 'public."PaymentAllocation"'::regclass
  ) THEN
    ALTER TABLE public."PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."ExternalReference" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."ExternalReference" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."ExternalReference" ADD COLUMN IF NOT EXISTS "externalSystem" TEXT NOT NULL;

ALTER TABLE public."ExternalReference" ADD COLUMN IF NOT EXISTS "entityType" TEXT NOT NULL;

ALTER TABLE public."ExternalReference" ADD COLUMN IF NOT EXISTS "externalId" TEXT NOT NULL;

ALTER TABLE public."ExternalReference" ADD COLUMN IF NOT EXISTS "personId" TEXT;

ALTER TABLE public."ExternalReference" ADD COLUMN IF NOT EXISTS "invoiceId" TEXT;

ALTER TABLE public."ExternalReference" ADD COLUMN IF NOT EXISTS "paymentId" TEXT;

ALTER TABLE public."ExternalReference" ADD COLUMN IF NOT EXISTS "contractId" TEXT;

ALTER TABLE public."ExternalReference" ADD COLUMN IF NOT EXISTS "unitId" TEXT;

ALTER TABLE public."ExternalReference" ADD COLUMN IF NOT EXISTS "syncStatus" TEXT NOT NULL DEFAULT 'synced';

ALTER TABLE public."ExternalReference" ADD COLUMN IF NOT EXISTS "lastSyncedAt" TIMESTAMP(3);

ALTER TABLE public."ExternalReference" ADD COLUMN IF NOT EXISTS "sourceVersion" TEXT;

ALTER TABLE public."ExternalReference" ADD COLUMN IF NOT EXISTS "sourceUpdatedAt" TIMESTAMP(3);

ALTER TABLE public."ExternalReference" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

ALTER TABLE public."ExternalReference" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."ExternalReference" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ExternalReference_pkey'
      AND conrelid = 'public."ExternalReference"'::regclass
  ) THEN
    ALTER TABLE public."ExternalReference" ADD CONSTRAINT "ExternalReference_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."IntegrationConnection" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."IntegrationConnection" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."IntegrationConnection" ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL;

ALTER TABLE public."IntegrationConnection" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;

ALTER TABLE public."IntegrationConnection" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public."IntegrationConnection" ADD COLUMN IF NOT EXISTS "credentialsEncrypted" TEXT;

ALTER TABLE public."IntegrationConnection" ADD COLUMN IF NOT EXISTS "settings" JSONB;

ALTER TABLE public."IntegrationConnection" ADD COLUMN IF NOT EXISTS "webhookSecret" TEXT;

ALTER TABLE public."IntegrationConnection" ADD COLUMN IF NOT EXISTS "lastSyncAt" TIMESTAMP(3);

ALTER TABLE public."IntegrationConnection" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."IntegrationConnection" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'IntegrationConnection_pkey'
      AND conrelid = 'public."IntegrationConnection"'::regclass
  ) THEN
    ALTER TABLE public."IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."IntegrationSyncJob" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."IntegrationSyncJob" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."IntegrationSyncJob" ADD COLUMN IF NOT EXISTS "connectionId" TEXT NOT NULL;

ALTER TABLE public."IntegrationSyncJob" ADD COLUMN IF NOT EXISTS "jobType" TEXT NOT NULL;

ALTER TABLE public."IntegrationSyncJob" ADD COLUMN IF NOT EXISTS "status" "SyncJobStatus" NOT NULL DEFAULT 'PENDING';

ALTER TABLE public."IntegrationSyncJob" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);

ALTER TABLE public."IntegrationSyncJob" ADD COLUMN IF NOT EXISTS "finishedAt" TIMESTAMP(3);

ALTER TABLE public."IntegrationSyncJob" ADD COLUMN IF NOT EXISTS "itemsProcessed" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public."IntegrationSyncJob" ADD COLUMN IF NOT EXISTS "itemsCreated" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public."IntegrationSyncJob" ADD COLUMN IF NOT EXISTS "itemsUpdated" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public."IntegrationSyncJob" ADD COLUMN IF NOT EXISTS "itemsSkipped" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public."IntegrationSyncJob" ADD COLUMN IF NOT EXISTS "itemsFailed" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public."IntegrationSyncJob" ADD COLUMN IF NOT EXISTS "log" JSONB;

ALTER TABLE public."IntegrationSyncJob" ADD COLUMN IF NOT EXISTS "error" TEXT;

ALTER TABLE public."IntegrationSyncJob" ADD COLUMN IF NOT EXISTS "correlationId" TEXT;

ALTER TABLE public."IntegrationSyncJob" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'IntegrationSyncJob_pkey'
      AND conrelid = 'public."IntegrationSyncJob"'::regclass
  ) THEN
    ALTER TABLE public."IntegrationSyncJob" ADD CONSTRAINT "IntegrationSyncJob_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."SyncReviewItem" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."SyncReviewItem" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."SyncReviewItem" ADD COLUMN IF NOT EXISTS "syncJobId" TEXT;

ALTER TABLE public."SyncReviewItem" ADD COLUMN IF NOT EXISTS "entityType" TEXT NOT NULL;

ALTER TABLE public."SyncReviewItem" ADD COLUMN IF NOT EXISTS "externalSystem" TEXT NOT NULL;

ALTER TABLE public."SyncReviewItem" ADD COLUMN IF NOT EXISTS "externalId" TEXT NOT NULL;

ALTER TABLE public."SyncReviewItem" ADD COLUMN IF NOT EXISTS "payload" JSONB NOT NULL;

ALTER TABLE public."SyncReviewItem" ADD COLUMN IF NOT EXISTS "reason" TEXT NOT NULL;

ALTER TABLE public."SyncReviewItem" ADD COLUMN IF NOT EXISTS "status" "ReviewItemStatus" NOT NULL DEFAULT 'PENDING';

ALTER TABLE public."SyncReviewItem" ADD COLUMN IF NOT EXISTS "resolvedByUserId" TEXT;

ALTER TABLE public."SyncReviewItem" ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3);

ALTER TABLE public."SyncReviewItem" ADD COLUMN IF NOT EXISTS "resolutionNote" TEXT;

ALTER TABLE public."SyncReviewItem" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."SyncReviewItem" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'SyncReviewItem_pkey'
      AND conrelid = 'public."SyncReviewItem"'::regclass
  ) THEN
    ALTER TABLE public."SyncReviewItem" ADD CONSTRAINT "SyncReviewItem_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

COMMIT;
