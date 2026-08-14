-- FaddeBo: indexes for foreign keys that are actually joined, filtered or
-- cascade-deleted on.
--
-- The canonical index migration covers the composite access patterns
-- (organizationId + status + createdAt), but 80 foreign keys had no index at
-- all. Without them every parent delete has to sequentially scan the child
-- table, and the child-side lookups used by the admin lists, the tenant portal
-- and the public catalog degrade linearly with the data volume.
--
-- Only keys that are read or cascaded in the current code base are indexed
-- here. Purely descriptive keys on single-row configuration tables (for example
-- Brand.logoDocumentId) are deliberately left without an index.

BEGIN;
SET LOCAL search_path = public, extensions;

-- Property structure: property -> building -> entrance -> floor -> unit
CREATE INDEX IF NOT EXISTS "Building_propertyId_idx" ON public."Building"("propertyId");
CREATE INDEX IF NOT EXISTS "Building_organizationId_idx" ON public."Building"("organizationId");
CREATE INDEX IF NOT EXISTS "Entrance_buildingId_idx" ON public."Entrance"("buildingId");
CREATE INDEX IF NOT EXISTS "Floor_entranceId_idx" ON public."Floor"("entranceId");
CREATE INDEX IF NOT EXISTS "Unit_propertyId_idx" ON public."Unit"("propertyId");
CREATE INDEX IF NOT EXISTS "Unit_buildingId_idx" ON public."Unit"("buildingId");
CREATE INDEX IF NOT EXISTS "Unit_entranceId_idx" ON public."Unit"("entranceId");
CREATE INDEX IF NOT EXISTS "Unit_floorId_idx" ON public."Unit"("floorId");
CREATE INDEX IF NOT EXISTS "Unit_parentUnitId_idx" ON public."Unit"("parentUnitId");
CREATE INDEX IF NOT EXISTS "UnitMedia_unitId_sortOrder_idx" ON public."UnitMedia"("unitId", "sortOrder");

-- Listings and the public catalog
CREATE INDEX IF NOT EXISTS "Listing_unitId_idx" ON public."Listing"("unitId");
CREATE INDEX IF NOT EXISTS "ListingPublication_listingId_idx" ON public."ListingPublication"("listingId");
CREATE INDEX IF NOT EXISTS "Favorite_listingId_idx" ON public."Favorite"("listingId");
CREATE INDEX IF NOT EXISTS "Favorite_organizationId_idx" ON public."Favorite"("organizationId");
CREATE INDEX IF NOT EXISTS "SavedSearch_organizationId_idx" ON public."SavedSearch"("organizationId");

-- Applications, viewings and offers
CREATE INDEX IF NOT EXISTS "ApplicationMember_personId_idx" ON public."ApplicationMember"("personId");
CREATE INDEX IF NOT EXISTS "ViewingAttendee_personId_idx" ON public."ViewingAttendee"("personId");
CREATE INDEX IF NOT EXISTS "ViewingAttendee_applicationId_idx" ON public."ViewingAttendee"("applicationId");
CREATE INDEX IF NOT EXISTS "Viewing_organizationId_idx" ON public."Viewing"("organizationId");
CREATE INDEX IF NOT EXISTS "Offer_organizationId_idx" ON public."Offer"("organizationId");
CREATE INDEX IF NOT EXISTS "Reservation_organizationId_idx" ON public."Reservation"("organizationId");
CREATE INDEX IF NOT EXISTS "Reservation_listingId_idx" ON public."Reservation"("listingId");
CREATE INDEX IF NOT EXISTS "Reservation_offerId_idx" ON public."Reservation"("offerId");
CREATE INDEX IF NOT EXISTS "Reservation_contractId_idx" ON public."Reservation"("contractId");

-- Contracts, signing and tenancy transitions
CREATE INDEX IF NOT EXISTS "ContractParty_personId_idx" ON public."ContractParty"("personId");
CREATE INDEX IF NOT EXISTS "ContractSignature_personId_idx" ON public."ContractSignature"("personId");
CREATE INDEX IF NOT EXISTS "ContractSignature_contractVersionId_idx" ON public."ContractSignature"("contractVersionId");
CREATE INDEX IF NOT EXISTS "ContractSignature_contractPartyId_idx" ON public."ContractSignature"("contractPartyId");
CREATE INDEX IF NOT EXISTS "ContractSignature_organizationId_idx" ON public."ContractSignature"("organizationId");
CREATE INDEX IF NOT EXISTS "SigningSession_contractVersionId_idx" ON public."SigningSession"("contractVersionId");
CREATE INDEX IF NOT EXISTS "SigningSession_organizationId_idx" ON public."SigningSession"("organizationId");
CREATE INDEX IF NOT EXISTS "SigningChallenge_contractId_idx" ON public."SigningChallenge"("contractId");
CREATE INDEX IF NOT EXISTS "SigningChallenge_organizationId_idx" ON public."SigningChallenge"("organizationId");
CREATE INDEX IF NOT EXISTS "EvidenceReport_contractId_idx" ON public."EvidenceReport"("contractId");
CREATE INDEX IF NOT EXISTS "Termination_organizationId_idx" ON public."Termination"("organizationId");
CREATE INDEX IF NOT EXISTS "Termination_requestedByPersonId_idx" ON public."Termination"("requestedByPersonId");
CREATE INDEX IF NOT EXISTS "MoveInCase_unitId_idx" ON public."MoveInCase"("unitId");
CREATE INDEX IF NOT EXISTS "MoveInCase_organizationId_idx" ON public."MoveInCase"("organizationId");
CREATE INDEX IF NOT EXISTS "MoveOutCase_contractId_idx" ON public."MoveOutCase"("contractId");
CREATE INDEX IF NOT EXISTS "MoveOutCase_unitId_idx" ON public."MoveOutCase"("unitId");
CREATE INDEX IF NOT EXISTS "MoveOutCase_organizationId_idx" ON public."MoveOutCase"("organizationId");
CREATE INDEX IF NOT EXISTS "Inspection_organizationId_idx" ON public."Inspection"("organizationId");

-- Maintenance
CREATE INDEX IF NOT EXISTS "MaintenanceRequest_unitId_idx" ON public."MaintenanceRequest"("unitId");
CREATE INDEX IF NOT EXISTS "MaintenanceRequest_propertyId_idx" ON public."MaintenanceRequest"("propertyId");
CREATE INDEX IF NOT EXISTS "WorkOrder_requestId_idx" ON public."WorkOrder"("requestId");
CREATE INDEX IF NOT EXISTS "WorkOrder_assigneeUserId_idx" ON public."WorkOrder"("assigneeUserId");

-- Billing
CREATE INDEX IF NOT EXISTS "Invoice_unitId_idx" ON public."Invoice"("unitId");
CREATE INDEX IF NOT EXISTS "Invoice_creditsInvoiceId_idx" ON public."Invoice"("creditsInvoiceId");
CREATE INDEX IF NOT EXISTS "InvoiceLine_invoiceId_idx" ON public."InvoiceLine"("invoiceId");
CREATE INDEX IF NOT EXISTS "PaymentAllocation_invoiceId_idx" ON public."PaymentAllocation"("invoiceId");
CREATE INDEX IF NOT EXISTS "ExternalReference_contractId_idx" ON public."ExternalReference"("contractId");
CREATE INDEX IF NOT EXISTS "ExternalReference_unitId_idx" ON public."ExternalReference"("unitId");
CREATE INDEX IF NOT EXISTS "ExternalReference_paymentId_idx" ON public."ExternalReference"("paymentId");

-- Documents, messaging and identity
CREATE INDEX IF NOT EXISTS "Document_unitId_idx" ON public."Document"("unitId");
CREATE INDEX IF NOT EXISTS "Document_propertyId_idx" ON public."Document"("propertyId");
CREATE INDEX IF NOT EXISTS "Document_applicationId_idx" ON public."Document"("applicationId");
CREATE INDEX IF NOT EXISTS "Document_maintenanceRequestId_idx" ON public."Document"("maintenanceRequestId");
CREATE INDEX IF NOT EXISTS "Document_workOrderId_idx" ON public."Document"("workOrderId");
CREATE INDEX IF NOT EXISTS "Message_senderPersonId_idx" ON public."Message"("senderPersonId");
CREATE INDEX IF NOT EXISTS "Message_organizationId_idx" ON public."Message"("organizationId");
CREATE INDEX IF NOT EXISTS "Notification_organizationId_idx" ON public."Notification"("organizationId");
CREATE INDEX IF NOT EXISTS "Invitation_personId_idx" ON public."Invitation"("personId");
CREATE INDEX IF NOT EXISTS "User_organizationId_idx" ON public."User"("organizationId");
CREATE INDEX IF NOT EXISTS "User_supplierId_idx" ON public."User"("supplierId");
CREATE INDEX IF NOT EXISTS "UserRole_roleId_idx" ON public."UserRole"("roleId");
CREATE INDEX IF NOT EXISTS "UserRole_propertyId_idx" ON public."UserRole"("propertyId");
CREATE INDEX IF NOT EXISTS "AuditEvent_userId_idx" ON public."AuditEvent"("userId");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx" ON public."PasswordResetToken"("userId");

-- Integrations and delivery queues
CREATE INDEX IF NOT EXISTS "IntegrationSyncJob_connectionId_idx" ON public."IntegrationSyncJob"("connectionId");
CREATE INDEX IF NOT EXISTS "SyncReviewItem_syncJobId_idx" ON public."SyncReviewItem"("syncJobId");
CREATE INDEX IF NOT EXISTS "WebhookDelivery_organizationId_idx" ON public."WebhookDelivery"("organizationId");
CREATE INDEX IF NOT EXISTS "OutboxEvent_organizationId_idx" ON public."OutboxEvent"("organizationId");

COMMIT;
