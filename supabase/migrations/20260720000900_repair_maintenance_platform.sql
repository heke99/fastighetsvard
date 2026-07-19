-- Östgöta El Teknik Fastighetsplattform
-- Step: Idempotent repair for maintenance and platform tables
-- Safe to run in filename order. This file is transactional.

BEGIN;
SET LOCAL search_path = public, extensions;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "requestNumber" INTEGER NOT NULL;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "propertyId" TEXT;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "unitId" TEXT;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "personId" TEXT;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "status" "MaintenanceStatus" NOT NULL DEFAULT 'RECEIVED';

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "priority" "MaintenancePriority" NOT NULL DEFAULT 'NORMAL';

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "subcategory" TEXT;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "room" TEXT;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "description" TEXT NOT NULL;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "discoveredAt" TIMESTAMP(3);

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "preferredTime" TEXT;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "masterKeyAllowed" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "petsInHome" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "isEmergency" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "rating" INTEGER;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'MaintenanceRequest_pkey'
      AND conrelid = 'public."MaintenanceRequest"'::regclass
  ) THEN
    ALTER TABLE public."MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."MaintenanceComment" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."MaintenanceComment" ADD COLUMN IF NOT EXISTS "requestId" TEXT NOT NULL;

ALTER TABLE public."MaintenanceComment" ADD COLUMN IF NOT EXISTS "authorUserId" TEXT;

ALTER TABLE public."MaintenanceComment" ADD COLUMN IF NOT EXISTS "authorName" TEXT NOT NULL;

ALTER TABLE public."MaintenanceComment" ADD COLUMN IF NOT EXISTS "body" TEXT NOT NULL;

ALTER TABLE public."MaintenanceComment" ADD COLUMN IF NOT EXISTS "isInternal" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."MaintenanceComment" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'MaintenanceComment_pkey'
      AND conrelid = 'public."MaintenanceComment"'::regclass
  ) THEN
    ALTER TABLE public."MaintenanceComment" ADD CONSTRAINT "MaintenanceComment_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."MaintenanceStatusEvent" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."MaintenanceStatusEvent" ADD COLUMN IF NOT EXISTS "requestId" TEXT NOT NULL;

ALTER TABLE public."MaintenanceStatusEvent" ADD COLUMN IF NOT EXISTS "fromStatus" "MaintenanceStatus";

ALTER TABLE public."MaintenanceStatusEvent" ADD COLUMN IF NOT EXISTS "toStatus" "MaintenanceStatus" NOT NULL;

ALTER TABLE public."MaintenanceStatusEvent" ADD COLUMN IF NOT EXISTS "comment" TEXT;

ALTER TABLE public."MaintenanceStatusEvent" ADD COLUMN IF NOT EXISTS "changedByUserId" TEXT;

ALTER TABLE public."MaintenanceStatusEvent" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'MaintenanceStatusEvent_pkey'
      AND conrelid = 'public."MaintenanceStatusEvent"'::regclass
  ) THEN
    ALTER TABLE public."MaintenanceStatusEvent" ADD CONSTRAINT "MaintenanceStatusEvent_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "requestId" TEXT;

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "supplierId" TEXT;

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "assigneeUserId" TEXT;

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "orderNumber" INTEGER NOT NULL;

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "status" "WorkOrderStatus" NOT NULL DEFAULT 'CREATED';

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "priority" "MaintenancePriority" NOT NULL DEFAULT 'NORMAL';

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL;

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "description" TEXT NOT NULL;

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "accessInfo" TEXT;

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "timeReported" DECIMAL(8,2);

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "materialsUsed" TEXT;

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "cost" DECIMAL(12,2);

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "invoiceReference" TEXT;

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "checklist" JSONB;

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "notes" TEXT;

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "approvedByUserId" TEXT;

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WorkOrder_pkey'
      AND conrelid = 'public."WorkOrder"'::regclass
  ) THEN
    ALTER TABLE public."WorkOrder" ADD CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."Supplier" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Supplier" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."Supplier" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;

ALTER TABLE public."Supplier" ADD COLUMN IF NOT EXISTS "orgNumber" TEXT;

ALTER TABLE public."Supplier" ADD COLUMN IF NOT EXISTS "email" TEXT;

ALTER TABLE public."Supplier" ADD COLUMN IF NOT EXISTS "phone" TEXT;

ALTER TABLE public."Supplier" ADD COLUMN IF NOT EXISTS "specialty" TEXT;

ALTER TABLE public."Supplier" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public."Supplier" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."Supplier" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Supplier_pkey'
      AND conrelid = 'public."Supplier"'::regclass
  ) THEN
    ALTER TABLE public."Supplier" ADD CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "type" "DocumentType" NOT NULL;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "fileName" TEXT NOT NULL;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "mimeType" TEXT NOT NULL;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "sizeBytes" INTEGER NOT NULL;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "storageKey" TEXT NOT NULL;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "sha256" TEXT NOT NULL;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "personId" TEXT;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "unitId" TEXT;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "propertyId" TEXT;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "contractId" TEXT;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "applicationId" TEXT;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "maintenanceRequestId" TEXT;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "workOrderId" TEXT;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "signStatus" TEXT;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "uploadedByUserId" TEXT;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "retentionUntil" TIMESTAMP(3);

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Document_pkey'
      AND conrelid = 'public."Document"'::regclass
  ) THEN
    ALTER TABLE public."Document" ADD CONSTRAINT "Document_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."Message" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Message" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."Message" ADD COLUMN IF NOT EXISTS "senderPersonId" TEXT;

ALTER TABLE public."Message" ADD COLUMN IF NOT EXISTS "recipientPersonId" TEXT NOT NULL;

ALTER TABLE public."Message" ADD COLUMN IF NOT EXISTS "subject" TEXT NOT NULL;

ALTER TABLE public."Message" ADD COLUMN IF NOT EXISTS "body" TEXT NOT NULL;

ALTER TABLE public."Message" ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3);

ALTER TABLE public."Message" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Message_pkey'
      AND conrelid = 'public."Message"'::regclass
  ) THEN
    ALTER TABLE public."Message" ADD CONSTRAINT "Message_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."Notification" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Notification" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."Notification" ADD COLUMN IF NOT EXISTS "personId" TEXT NOT NULL;

ALTER TABLE public."Notification" ADD COLUMN IF NOT EXISTS "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP';

ALTER TABLE public."Notification" ADD COLUMN IF NOT EXISTS "eventType" TEXT NOT NULL;

ALTER TABLE public."Notification" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL;

ALTER TABLE public."Notification" ADD COLUMN IF NOT EXISTS "body" TEXT NOT NULL;

ALTER TABLE public."Notification" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);

ALTER TABLE public."Notification" ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3);

ALTER TABLE public."Notification" ADD COLUMN IF NOT EXISTS "error" TEXT;

ALTER TABLE public."Notification" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Notification_pkey'
      AND conrelid = 'public."Notification"'::regclass
  ) THEN
    ALTER TABLE public."Notification" ADD CONSTRAINT "Notification_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."ApiKey" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."ApiKey" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."ApiKey" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;

ALTER TABLE public."ApiKey" ADD COLUMN IF NOT EXISTS "keyPrefix" TEXT NOT NULL;

ALTER TABLE public."ApiKey" ADD COLUMN IF NOT EXISTS "keyHash" TEXT NOT NULL;

ALTER TABLE public."ApiKey" ADD COLUMN IF NOT EXISTS "scopes" TEXT[];

ALTER TABLE public."ApiKey" ADD COLUMN IF NOT EXISTS "allowedIps" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE public."ApiKey" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public."ApiKey" ADD COLUMN IF NOT EXISTS "lastUsedAt" TIMESTAMP(3);

ALTER TABLE public."ApiKey" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

ALTER TABLE public."ApiKey" ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);

ALTER TABLE public."ApiKey" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."ApiKey" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ApiKey_pkey'
      AND conrelid = 'public."ApiKey"'::regclass
  ) THEN
    ALTER TABLE public."ApiKey" ADD CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."IdempotencyRecord" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."IdempotencyRecord" ADD COLUMN IF NOT EXISTS "apiKeyId" TEXT NOT NULL;

ALTER TABLE public."IdempotencyRecord" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT NOT NULL;

ALTER TABLE public."IdempotencyRecord" ADD COLUMN IF NOT EXISTS "requestHash" TEXT NOT NULL;

ALTER TABLE public."IdempotencyRecord" ADD COLUMN IF NOT EXISTS "responseStatus" INTEGER NOT NULL;

ALTER TABLE public."IdempotencyRecord" ADD COLUMN IF NOT EXISTS "responseBody" JSONB NOT NULL;

ALTER TABLE public."IdempotencyRecord" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."IdempotencyRecord" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3) NOT NULL;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'IdempotencyRecord_pkey'
      AND conrelid = 'public."IdempotencyRecord"'::regclass
  ) THEN
    ALTER TABLE public."IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."WebhookSubscription" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."WebhookSubscription" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."WebhookSubscription" ADD COLUMN IF NOT EXISTS "url" TEXT NOT NULL;

ALTER TABLE public."WebhookSubscription" ADD COLUMN IF NOT EXISTS "secret" TEXT NOT NULL;

ALTER TABLE public."WebhookSubscription" ADD COLUMN IF NOT EXISTS "events" TEXT[];

ALTER TABLE public."WebhookSubscription" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public."WebhookSubscription" ADD COLUMN IF NOT EXISTS "disabledAt" TIMESTAMP(3);

ALTER TABLE public."WebhookSubscription" ADD COLUMN IF NOT EXISTS "disabledReason" TEXT;

ALTER TABLE public."WebhookSubscription" ADD COLUMN IF NOT EXISTS "consecutiveFailures" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public."WebhookSubscription" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."WebhookSubscription" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WebhookSubscription_pkey'
      AND conrelid = 'public."WebhookSubscription"'::regclass
  ) THEN
    ALTER TABLE public."WebhookSubscription" ADD CONSTRAINT "WebhookSubscription_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."WebhookDelivery" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."WebhookDelivery" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."WebhookDelivery" ADD COLUMN IF NOT EXISTS "subscriptionId" TEXT NOT NULL;

ALTER TABLE public."WebhookDelivery" ADD COLUMN IF NOT EXISTS "eventId" TEXT NOT NULL;

ALTER TABLE public."WebhookDelivery" ADD COLUMN IF NOT EXISTS "eventType" TEXT NOT NULL;

ALTER TABLE public."WebhookDelivery" ADD COLUMN IF NOT EXISTS "payload" JSONB NOT NULL;

ALTER TABLE public."WebhookDelivery" ADD COLUMN IF NOT EXISTS "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING';

ALTER TABLE public."WebhookDelivery" ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public."WebhookDelivery" ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP(3);

ALTER TABLE public."WebhookDelivery" ADD COLUMN IF NOT EXISTS "nextAttemptAt" TIMESTAMP(3);

ALTER TABLE public."WebhookDelivery" ADD COLUMN IF NOT EXISTS "lastStatusCode" INTEGER;

ALTER TABLE public."WebhookDelivery" ADD COLUMN IF NOT EXISTS "lastError" TEXT;

ALTER TABLE public."WebhookDelivery" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);

ALTER TABLE public."WebhookDelivery" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."WebhookDelivery" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WebhookDelivery_pkey'
      AND conrelid = 'public."WebhookDelivery"'::regclass
  ) THEN
    ALTER TABLE public."WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."InboundWebhookEvent" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."InboundWebhookEvent" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."InboundWebhookEvent" ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL;

ALTER TABLE public."InboundWebhookEvent" ADD COLUMN IF NOT EXISTS "eventId" TEXT NOT NULL;

ALTER TABLE public."InboundWebhookEvent" ADD COLUMN IF NOT EXISTS "eventType" TEXT NOT NULL;

ALTER TABLE public."InboundWebhookEvent" ADD COLUMN IF NOT EXISTS "payload" JSONB NOT NULL;

ALTER TABLE public."InboundWebhookEvent" ADD COLUMN IF NOT EXISTS "signatureValid" BOOLEAN NOT NULL;

ALTER TABLE public."InboundWebhookEvent" ADD COLUMN IF NOT EXISTS "processedAt" TIMESTAMP(3);

ALTER TABLE public."InboundWebhookEvent" ADD COLUMN IF NOT EXISTS "processingError" TEXT;

ALTER TABLE public."InboundWebhookEvent" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'InboundWebhookEvent_pkey'
      AND conrelid = 'public."InboundWebhookEvent"'::regclass
  ) THEN
    ALTER TABLE public."InboundWebhookEvent" ADD CONSTRAINT "InboundWebhookEvent_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."ImportJob" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."ImportJob" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."ImportJob" ADD COLUMN IF NOT EXISTS "importType" TEXT NOT NULL;

ALTER TABLE public."ImportJob" ADD COLUMN IF NOT EXISTS "fileName" TEXT;

ALTER TABLE public."ImportJob" ADD COLUMN IF NOT EXISTS "status" "ImportJobStatus" NOT NULL DEFAULT 'PREVIEW';

ALTER TABLE public."ImportJob" ADD COLUMN IF NOT EXISTS "totalRows" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public."ImportJob" ADD COLUMN IF NOT EXISTS "successRows" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public."ImportJob" ADD COLUMN IF NOT EXISTS "errorRows" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public."ImportJob" ADD COLUMN IF NOT EXISTS "skippedRows" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public."ImportJob" ADD COLUMN IF NOT EXISTS "rowResults" JSONB;

ALTER TABLE public."ImportJob" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;

ALTER TABLE public."ImportJob" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);

ALTER TABLE public."ImportJob" ADD COLUMN IF NOT EXISTS "finishedAt" TIMESTAMP(3);

ALTER TABLE public."ImportJob" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ImportJob_pkey'
      AND conrelid = 'public."ImportJob"'::regclass
  ) THEN
    ALTER TABLE public."ImportJob" ADD CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."AuditEvent" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."AuditEvent" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

ALTER TABLE public."AuditEvent" ADD COLUMN IF NOT EXISTS "userId" TEXT;

ALTER TABLE public."AuditEvent" ADD COLUMN IF NOT EXISTS "actorType" TEXT NOT NULL DEFAULT 'user';

ALTER TABLE public."AuditEvent" ADD COLUMN IF NOT EXISTS "actorId" TEXT;

ALTER TABLE public."AuditEvent" ADD COLUMN IF NOT EXISTS "action" TEXT NOT NULL;

ALTER TABLE public."AuditEvent" ADD COLUMN IF NOT EXISTS "entityType" TEXT NOT NULL;

ALTER TABLE public."AuditEvent" ADD COLUMN IF NOT EXISTS "entityId" TEXT;

ALTER TABLE public."AuditEvent" ADD COLUMN IF NOT EXISTS "before" JSONB;

ALTER TABLE public."AuditEvent" ADD COLUMN IF NOT EXISTS "after" JSONB;

ALTER TABLE public."AuditEvent" ADD COLUMN IF NOT EXISTS "ip" TEXT;

ALTER TABLE public."AuditEvent" ADD COLUMN IF NOT EXISTS "correlationId" TEXT;

ALTER TABLE public."AuditEvent" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'AuditEvent_pkey'
      AND conrelid = 'public."AuditEvent"'::regclass
  ) THEN
    ALTER TABLE public."AuditEvent" ADD CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."Counter" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Counter" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."Counter" ADD COLUMN IF NOT EXISTS "key" TEXT NOT NULL;

ALTER TABLE public."Counter" ADD COLUMN IF NOT EXISTS "value" INTEGER NOT NULL DEFAULT 0;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Counter_pkey'
      AND conrelid = 'public."Counter"'::regclass
  ) THEN
    ALTER TABLE public."Counter" ADD CONSTRAINT "Counter_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

COMMIT;
