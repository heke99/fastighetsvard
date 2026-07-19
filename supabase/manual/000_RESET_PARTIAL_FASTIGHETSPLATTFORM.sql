-- DESTRUCTIVE RESET FOR A NEW OR PARTIALLY INSTALLED APP DATABASE.
-- Run only when the application tables contain no important data.
-- Supabase Auth users are not deleted.

BEGIN;
SET LOCAL search_path = public, extensions;

DROP POLICY IF EXISTS "public_property_media_read" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_private_storage_read" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_private_storage_insert" ON storage.objects;

DROP FUNCTION IF EXISTS public.current_app_person_id() CASCADE;
DROP FUNCTION IF EXISTS public.current_app_organization_id() CASCADE;
DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;

DROP TABLE IF EXISTS
  public."Counter",
  public."AuditEvent",
  public."ImportJob",
  public."InboundWebhookEvent",
  public."WebhookDelivery",
  public."WebhookSubscription",
  public."IdempotencyRecord",
  public."ApiKey",
  public."Notification",
  public."Message",
  public."Document",
  public."Supplier",
  public."WorkOrder",
  public."MaintenanceStatusEvent",
  public."MaintenanceComment",
  public."MaintenanceRequest",
  public."SyncReviewItem",
  public."IntegrationSyncJob",
  public."IntegrationConnection",
  public."ExternalReference",
  public."PaymentAllocation",
  public."Payment",
  public."InvoiceStatusEvent",
  public."InvoiceLine",
  public."Invoice",
  public."Inspection",
  public."Termination",
  public."ContractStatusEvent",
  public."ContractVersion",
  public."ContractParty",
  public."Contract",
  public."Offer",
  public."ViewingAttendee",
  public."Viewing",
  public."ApplicationStatusEvent",
  public."ApplicationMember",
  public."Application",
  public."SavedSearch",
  public."Favorite",
  public."ListingPublication",
  public."Listing",
  public."UnitMedia",
  public."Unit",
  public."Floor",
  public."Entrance",
  public."Building",
  public."Property",
  public."UserRole",
  public."RolePermission",
  public."Role",
  public."Invitation",
  public."User",
  public."PersonRole",
  public."Person",
  public."MasterDataConfig",
  public."Organization"
CASCADE;

DROP TYPE IF EXISTS public."ImportJobStatus" CASCADE;
DROP TYPE IF EXISTS public."WebhookDeliveryStatus" CASCADE;
DROP TYPE IF EXISTS public."NotificationChannel" CASCADE;
DROP TYPE IF EXISTS public."DocumentType" CASCADE;
DROP TYPE IF EXISTS public."WorkOrderStatus" CASCADE;
DROP TYPE IF EXISTS public."MaintenancePriority" CASCADE;
DROP TYPE IF EXISTS public."MaintenanceStatus" CASCADE;
DROP TYPE IF EXISTS public."ReviewItemStatus" CASCADE;
DROP TYPE IF EXISTS public."SyncJobStatus" CASCADE;
DROP TYPE IF EXISTS public."InvoiceStatus" CASCADE;
DROP TYPE IF EXISTS public."InspectionType" CASCADE;
DROP TYPE IF EXISTS public."TerminationStatus" CASCADE;
DROP TYPE IF EXISTS public."ContractPartyRole" CASCADE;
DROP TYPE IF EXISTS public."ContractStatus" CASCADE;
DROP TYPE IF EXISTS public."ContractType" CASCADE;
DROP TYPE IF EXISTS public."OfferStatus" CASCADE;
DROP TYPE IF EXISTS public."ViewingAttendeeStatus" CASCADE;
DROP TYPE IF EXISTS public."ViewingKind" CASCADE;
DROP TYPE IF EXISTS public."ApplicationMemberRole" CASCADE;
DROP TYPE IF EXISTS public."ApplicationStatus" CASCADE;
DROP TYPE IF EXISTS public."ListingStatus" CASCADE;
DROP TYPE IF EXISTS public."ListingCategory" CASCADE;
DROP TYPE IF EXISTS public."MediaKind" CASCADE;
DROP TYPE IF EXISTS public."UnitStatus" CASCADE;
DROP TYPE IF EXISTS public."UnitType" CASCADE;
DROP TYPE IF EXISTS public."PropertyStatus" CASCADE;
DROP TYPE IF EXISTS public."PersonRoleType" CASCADE;
DROP TYPE IF EXISTS public."MasterDataDomain" CASCADE;

DELETE FROM storage.buckets
WHERE id IN ('property-media', 'tenant-documents', 'maintenance-files');

COMMIT;
