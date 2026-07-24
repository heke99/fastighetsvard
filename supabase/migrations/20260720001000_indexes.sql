-- Östgöta El Teknik Fastighetsplattform
-- Step: Indexes and uniqueness rules
-- Canonical installation migration. Duplicate index names are treated as schema drift.

BEGIN;
SET LOCAL search_path = public, extensions;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_orgNumber_key" ON public."Organization"("orgNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MasterDataConfig_organizationId_domain_key" ON public."MasterDataConfig"("organizationId", "domain");

-- CreateIndex
CREATE INDEX "Person_organizationId_personalNumber_idx" ON public."Person"("organizationId", "personalNumber");

-- CreateIndex
CREATE INDEX "Person_organizationId_lastName_firstName_idx" ON public."Person"("organizationId", "lastName", "firstName");

-- CreateIndex
CREATE UNIQUE INDEX "Person_organizationId_email_key" ON public."Person"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "PersonRole_personId_role_key" ON public."PersonRole"("personId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "User_personId_key" ON public."User"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON public."User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON public."User"("email");

-- CreateIndex

-- CreateIndex

-- CreateIndex

-- CreateIndex

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON public."Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_organizationId_personId_idx" ON public."Invitation"("organizationId", "personId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_organizationId_slug_key" ON public."Role"("organizationId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permission_key" ON public."RolePermission"("roleId", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_propertyId_key" ON public."UserRole"("userId", "roleId", "propertyId");

-- CreateIndex
CREATE INDEX "Property_organizationId_city_idx" ON public."Property"("organizationId", "city");

-- CreateIndex
CREATE INDEX "Unit_organizationId_status_idx" ON public."Unit"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Unit_organizationId_type_status_idx" ON public."Unit"("organizationId", "type", "status");

-- CreateIndex
CREATE INDEX "Unit_organizationId_city_idx" ON public."Unit"("organizationId", "city");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_organizationId_unitNumber_key" ON public."Unit"("organizationId", "unitNumber");

-- CreateIndex
CREATE INDEX "Listing_organizationId_status_category_idx" ON public."Listing"("organizationId", "status", "category");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_organizationId_slug_key" ON public."Listing"("organizationId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_personId_listingId_key" ON public."Favorite"("personId", "listingId");

-- CreateIndex
CREATE INDEX "SavedSearch_personId_idx" ON public."SavedSearch"("personId");

-- CreateIndex
CREATE INDEX "Application_organizationId_status_idx" ON public."Application"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Application_listingId_status_idx" ON public."Application"("listingId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationMember_applicationId_personId_role_key" ON public."ApplicationMember"("applicationId", "personId", "role");

-- CreateIndex
CREATE INDEX "ApplicationStatusEvent_applicationId_idx" ON public."ApplicationStatusEvent"("applicationId");

-- CreateIndex
CREATE INDEX "Viewing_listingId_startsAt_idx" ON public."Viewing"("listingId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "ViewingAttendee_viewingId_personId_key" ON public."ViewingAttendee"("viewingId", "personId");

-- CreateIndex
CREATE INDEX "Offer_applicationId_idx" ON public."Offer"("applicationId");

-- CreateIndex
CREATE INDEX "Offer_personId_status_idx" ON public."Offer"("personId", "status");

-- CreateIndex
CREATE INDEX "Contract_organizationId_status_idx" ON public."Contract"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Contract_unitId_status_idx" ON public."Contract"("unitId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_organizationId_contractNumber_key" ON public."Contract"("organizationId", "contractNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ContractParty_contractId_personId_role_key" ON public."ContractParty"("contractId", "personId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "ContractVersion_contractId_versionNumber_key" ON public."ContractVersion"("contractId", "versionNumber");

-- CreateIndex
CREATE INDEX "ContractStatusEvent_contractId_idx" ON public."ContractStatusEvent"("contractId");

-- CreateIndex
CREATE INDEX "Termination_contractId_idx" ON public."Termination"("contractId");

-- CreateIndex
CREATE INDEX "Inspection_unitId_idx" ON public."Inspection"("unitId");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_status_idx" ON public."Invoice"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Invoice_personId_status_idx" ON public."Invoice"("personId", "status");

-- CreateIndex
CREATE INDEX "Invoice_contractId_idx" ON public."Invoice"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_organizationId_invoiceNumber_key" ON public."Invoice"("organizationId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "InvoiceStatusEvent_invoiceId_idx" ON public."InvoiceStatusEvent"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_organizationId_paidAt_idx" ON public."Payment"("organizationId", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_paymentId_invoiceId_key" ON public."PaymentAllocation"("paymentId", "invoiceId");

-- CreateIndex
CREATE INDEX "ExternalReference_personId_idx" ON public."ExternalReference"("personId");

-- CreateIndex
CREATE INDEX "ExternalReference_invoiceId_idx" ON public."ExternalReference"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalReference_organizationId_externalSystem_entityType__key" ON public."ExternalReference"("organizationId", "externalSystem", "entityType", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnection_organizationId_provider_name_key" ON public."IntegrationConnection"("organizationId", "provider", "name");

-- CreateIndex
CREATE INDEX "IntegrationSyncJob_organizationId_status_idx" ON public."IntegrationSyncJob"("organizationId", "status");

-- CreateIndex
CREATE INDEX "SyncReviewItem_organizationId_status_idx" ON public."SyncReviewItem"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SyncReviewItem_organizationId_externalSystem_entityType_ext_key" ON public."SyncReviewItem"("organizationId", "externalSystem", "entityType", "externalId", "status");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_organizationId_status_idx" ON public."MaintenanceRequest"("organizationId", "status");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_personId_idx" ON public."MaintenanceRequest"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceRequest_organizationId_requestNumber_key" ON public."MaintenanceRequest"("organizationId", "requestNumber");

-- CreateIndex
CREATE INDEX "MaintenanceComment_requestId_idx" ON public."MaintenanceComment"("requestId");

-- CreateIndex
CREATE INDEX "MaintenanceStatusEvent_requestId_idx" ON public."MaintenanceStatusEvent"("requestId");

-- CreateIndex
CREATE INDEX "WorkOrder_organizationId_status_idx" ON public."WorkOrder"("organizationId", "status");

-- CreateIndex
CREATE INDEX "WorkOrder_supplierId_status_idx" ON public."WorkOrder"("supplierId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_organizationId_orderNumber_key" ON public."WorkOrder"("organizationId", "orderNumber");

-- CreateIndex
CREATE INDEX "Supplier_organizationId_idx" ON public."Supplier"("organizationId");

-- CreateIndex
CREATE INDEX "Document_organizationId_type_idx" ON public."Document"("organizationId", "type");

-- CreateIndex
CREATE INDEX "Document_personId_idx" ON public."Document"("personId");

-- CreateIndex
CREATE INDEX "Document_contractId_idx" ON public."Document"("contractId");

-- CreateIndex
CREATE INDEX "Message_recipientPersonId_readAt_idx" ON public."Message"("recipientPersonId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_personId_readAt_idx" ON public."Notification"("personId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON public."ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_organizationId_idx" ON public."ApiKey"("organizationId");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON public."IdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_apiKeyId_idempotencyKey_key" ON public."IdempotencyRecord"("apiKeyId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "WebhookSubscription_organizationId_isActive_idx" ON public."WebhookSubscription"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "WebhookDelivery_status_nextAttemptAt_idx" ON public."WebhookDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookDelivery_subscriptionId_eventId_key" ON public."WebhookDelivery"("subscriptionId", "eventId");

-- CreateIndex
CREATE INDEX "InboundWebhookEvent_organizationId_processedAt_idx" ON public."InboundWebhookEvent"("organizationId", "processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InboundWebhookEvent_organizationId_provider_eventId_key" ON public."InboundWebhookEvent"("organizationId", "provider", "eventId");

-- CreateIndex
CREATE INDEX "ImportJob_organizationId_status_idx" ON public."ImportJob"("organizationId", "status");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_entityType_entityId_idx" ON public."AuditEvent"("organizationId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_createdAt_idx" ON public."AuditEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Counter_organizationId_key_key" ON public."Counter"("organizationId", "key");

COMMIT;
