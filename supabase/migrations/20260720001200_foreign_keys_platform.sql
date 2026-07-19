-- Östgöta El Teknik Fastighetsplattform
-- Step: Foreign keys for billing, maintenance and platform services
-- Safe to run in filename order. This file is transactional.

BEGIN;
SET LOCAL search_path = public, extensions;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Invoice_organizationId_fkey'
      AND conrelid = 'public."Invoice"'::regclass
  ) THEN
    ALTER TABLE public."Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Invoice_personId_fkey'
      AND conrelid = 'public."Invoice"'::regclass
  ) THEN
    ALTER TABLE public."Invoice" ADD CONSTRAINT "Invoice_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Invoice_contractId_fkey'
      AND conrelid = 'public."Invoice"'::regclass
  ) THEN
    ALTER TABLE public."Invoice" ADD CONSTRAINT "Invoice_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Invoice_unitId_fkey'
      AND conrelid = 'public."Invoice"'::regclass
  ) THEN
    ALTER TABLE public."Invoice" ADD CONSTRAINT "Invoice_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Invoice_creditsInvoiceId_fkey'
      AND conrelid = 'public."Invoice"'::regclass
  ) THEN
    ALTER TABLE public."Invoice" ADD CONSTRAINT "Invoice_creditsInvoiceId_fkey" FOREIGN KEY ("creditsInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'InvoiceLine_invoiceId_fkey'
      AND conrelid = 'public."InvoiceLine"'::regclass
  ) THEN
    ALTER TABLE public."InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'InvoiceStatusEvent_invoiceId_fkey'
      AND conrelid = 'public."InvoiceStatusEvent"'::regclass
  ) THEN
    ALTER TABLE public."InvoiceStatusEvent" ADD CONSTRAINT "InvoiceStatusEvent_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Payment_organizationId_fkey'
      AND conrelid = 'public."Payment"'::regclass
  ) THEN
    ALTER TABLE public."Payment" ADD CONSTRAINT "Payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PaymentAllocation_paymentId_fkey'
      AND conrelid = 'public."PaymentAllocation"'::regclass
  ) THEN
    ALTER TABLE public."PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PaymentAllocation_invoiceId_fkey'
      AND conrelid = 'public."PaymentAllocation"'::regclass
  ) THEN
    ALTER TABLE public."PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ExternalReference_organizationId_fkey'
      AND conrelid = 'public."ExternalReference"'::regclass
  ) THEN
    ALTER TABLE public."ExternalReference" ADD CONSTRAINT "ExternalReference_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ExternalReference_personId_fkey'
      AND conrelid = 'public."ExternalReference"'::regclass
  ) THEN
    ALTER TABLE public."ExternalReference" ADD CONSTRAINT "ExternalReference_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ExternalReference_invoiceId_fkey'
      AND conrelid = 'public."ExternalReference"'::regclass
  ) THEN
    ALTER TABLE public."ExternalReference" ADD CONSTRAINT "ExternalReference_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ExternalReference_paymentId_fkey'
      AND conrelid = 'public."ExternalReference"'::regclass
  ) THEN
    ALTER TABLE public."ExternalReference" ADD CONSTRAINT "ExternalReference_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ExternalReference_contractId_fkey'
      AND conrelid = 'public."ExternalReference"'::regclass
  ) THEN
    ALTER TABLE public."ExternalReference" ADD CONSTRAINT "ExternalReference_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ExternalReference_unitId_fkey'
      AND conrelid = 'public."ExternalReference"'::regclass
  ) THEN
    ALTER TABLE public."ExternalReference" ADD CONSTRAINT "ExternalReference_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'IntegrationConnection_organizationId_fkey'
      AND conrelid = 'public."IntegrationConnection"'::regclass
  ) THEN
    ALTER TABLE public."IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'IntegrationSyncJob_organizationId_fkey'
      AND conrelid = 'public."IntegrationSyncJob"'::regclass
  ) THEN
    ALTER TABLE public."IntegrationSyncJob" ADD CONSTRAINT "IntegrationSyncJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'IntegrationSyncJob_connectionId_fkey'
      AND conrelid = 'public."IntegrationSyncJob"'::regclass
  ) THEN
    ALTER TABLE public."IntegrationSyncJob" ADD CONSTRAINT "IntegrationSyncJob_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'SyncReviewItem_organizationId_fkey'
      AND conrelid = 'public."SyncReviewItem"'::regclass
  ) THEN
    ALTER TABLE public."SyncReviewItem" ADD CONSTRAINT "SyncReviewItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'SyncReviewItem_syncJobId_fkey'
      AND conrelid = 'public."SyncReviewItem"'::regclass
  ) THEN
    ALTER TABLE public."SyncReviewItem" ADD CONSTRAINT "SyncReviewItem_syncJobId_fkey" FOREIGN KEY ("syncJobId") REFERENCES "IntegrationSyncJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'MaintenanceRequest_organizationId_fkey'
      AND conrelid = 'public."MaintenanceRequest"'::regclass
  ) THEN
    ALTER TABLE public."MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'MaintenanceRequest_propertyId_fkey'
      AND conrelid = 'public."MaintenanceRequest"'::regclass
  ) THEN
    ALTER TABLE public."MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'MaintenanceRequest_unitId_fkey'
      AND conrelid = 'public."MaintenanceRequest"'::regclass
  ) THEN
    ALTER TABLE public."MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'MaintenanceRequest_personId_fkey'
      AND conrelid = 'public."MaintenanceRequest"'::regclass
  ) THEN
    ALTER TABLE public."MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'MaintenanceComment_requestId_fkey'
      AND conrelid = 'public."MaintenanceComment"'::regclass
  ) THEN
    ALTER TABLE public."MaintenanceComment" ADD CONSTRAINT "MaintenanceComment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'MaintenanceStatusEvent_requestId_fkey'
      AND conrelid = 'public."MaintenanceStatusEvent"'::regclass
  ) THEN
    ALTER TABLE public."MaintenanceStatusEvent" ADD CONSTRAINT "MaintenanceStatusEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WorkOrder_organizationId_fkey'
      AND conrelid = 'public."WorkOrder"'::regclass
  ) THEN
    ALTER TABLE public."WorkOrder" ADD CONSTRAINT "WorkOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WorkOrder_requestId_fkey'
      AND conrelid = 'public."WorkOrder"'::regclass
  ) THEN
    ALTER TABLE public."WorkOrder" ADD CONSTRAINT "WorkOrder_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WorkOrder_supplierId_fkey'
      AND conrelid = 'public."WorkOrder"'::regclass
  ) THEN
    ALTER TABLE public."WorkOrder" ADD CONSTRAINT "WorkOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WorkOrder_assigneeUserId_fkey'
      AND conrelid = 'public."WorkOrder"'::regclass
  ) THEN
    ALTER TABLE public."WorkOrder" ADD CONSTRAINT "WorkOrder_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Supplier_organizationId_fkey'
      AND conrelid = 'public."Supplier"'::regclass
  ) THEN
    ALTER TABLE public."Supplier" ADD CONSTRAINT "Supplier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Document_organizationId_fkey'
      AND conrelid = 'public."Document"'::regclass
  ) THEN
    ALTER TABLE public."Document" ADD CONSTRAINT "Document_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Document_personId_fkey'
      AND conrelid = 'public."Document"'::regclass
  ) THEN
    ALTER TABLE public."Document" ADD CONSTRAINT "Document_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Document_unitId_fkey'
      AND conrelid = 'public."Document"'::regclass
  ) THEN
    ALTER TABLE public."Document" ADD CONSTRAINT "Document_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Document_propertyId_fkey'
      AND conrelid = 'public."Document"'::regclass
  ) THEN
    ALTER TABLE public."Document" ADD CONSTRAINT "Document_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Document_contractId_fkey'
      AND conrelid = 'public."Document"'::regclass
  ) THEN
    ALTER TABLE public."Document" ADD CONSTRAINT "Document_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Document_applicationId_fkey'
      AND conrelid = 'public."Document"'::regclass
  ) THEN
    ALTER TABLE public."Document" ADD CONSTRAINT "Document_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Document_maintenanceRequestId_fkey'
      AND conrelid = 'public."Document"'::regclass
  ) THEN
    ALTER TABLE public."Document" ADD CONSTRAINT "Document_maintenanceRequestId_fkey" FOREIGN KEY ("maintenanceRequestId") REFERENCES "MaintenanceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Document_workOrderId_fkey'
      AND conrelid = 'public."Document"'::regclass
  ) THEN
    ALTER TABLE public."Document" ADD CONSTRAINT "Document_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Message_organizationId_fkey'
      AND conrelid = 'public."Message"'::regclass
  ) THEN
    ALTER TABLE public."Message" ADD CONSTRAINT "Message_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Message_senderPersonId_fkey'
      AND conrelid = 'public."Message"'::regclass
  ) THEN
    ALTER TABLE public."Message" ADD CONSTRAINT "Message_senderPersonId_fkey" FOREIGN KEY ("senderPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Message_recipientPersonId_fkey'
      AND conrelid = 'public."Message"'::regclass
  ) THEN
    ALTER TABLE public."Message" ADD CONSTRAINT "Message_recipientPersonId_fkey" FOREIGN KEY ("recipientPersonId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Notification_organizationId_fkey'
      AND conrelid = 'public."Notification"'::regclass
  ) THEN
    ALTER TABLE public."Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Notification_personId_fkey'
      AND conrelid = 'public."Notification"'::regclass
  ) THEN
    ALTER TABLE public."Notification" ADD CONSTRAINT "Notification_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ApiKey_organizationId_fkey'
      AND conrelid = 'public."ApiKey"'::regclass
  ) THEN
    ALTER TABLE public."ApiKey" ADD CONSTRAINT "ApiKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'IdempotencyRecord_apiKeyId_fkey'
      AND conrelid = 'public."IdempotencyRecord"'::regclass
  ) THEN
    ALTER TABLE public."IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WebhookSubscription_organizationId_fkey'
      AND conrelid = 'public."WebhookSubscription"'::regclass
  ) THEN
    ALTER TABLE public."WebhookSubscription" ADD CONSTRAINT "WebhookSubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WebhookDelivery_organizationId_fkey'
      AND conrelid = 'public."WebhookDelivery"'::regclass
  ) THEN
    ALTER TABLE public."WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WebhookDelivery_subscriptionId_fkey'
      AND conrelid = 'public."WebhookDelivery"'::regclass
  ) THEN
    ALTER TABLE public."WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "WebhookSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'InboundWebhookEvent_organizationId_fkey'
      AND conrelid = 'public."InboundWebhookEvent"'::regclass
  ) THEN
    ALTER TABLE public."InboundWebhookEvent" ADD CONSTRAINT "InboundWebhookEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ImportJob_organizationId_fkey'
      AND conrelid = 'public."ImportJob"'::regclass
  ) THEN
    ALTER TABLE public."ImportJob" ADD CONSTRAINT "ImportJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'AuditEvent_organizationId_fkey'
      AND conrelid = 'public."AuditEvent"'::regclass
  ) THEN
    ALTER TABLE public."AuditEvent" ADD CONSTRAINT "AuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'AuditEvent_userId_fkey'
      AND conrelid = 'public."AuditEvent"'::regclass
  ) THEN
    ALTER TABLE public."AuditEvent" ADD CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

CREATE UNIQUE INDEX IF NOT EXISTS "Role_system_slug_key" ON public."Role"("slug") WHERE "organizationId" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "UserRole_global_key" ON public."UserRole"("userId","roleId") WHERE "propertyId" IS NULL;

COMMIT;
