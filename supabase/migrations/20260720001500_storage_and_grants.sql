-- Fastighetsvärd
-- Canonical Storage buckets and least-privilege PostgREST grants.
-- Private object policies are installed after the domain permission helpers.

BEGIN;
SET LOCAL search_path = public, extensions;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('listing-media', 'listing-media', true, 20971520, ARRAY['image/jpeg','image/png','image/webp','image/avif','application/pdf']),
  ('application-documents', 'application-documents', false, 52428800, ARRAY['application/pdf','image/jpeg','image/png','image/webp']),
  ('contract-drafts', 'contract-drafts', false, 52428800, ARRAY['application/pdf']),
  ('signed-contracts', 'signed-contracts', false, 52428800, ARRAY['application/pdf']),
  ('tenant-documents', 'tenant-documents', false, 52428800, ARRAY['application/pdf','image/jpeg','image/png','image/webp']),
  ('maintenance-files', 'maintenance-files', false, 52428800, ARRAY['image/jpeg','image/png','image/webp','application/pdf','video/mp4']),
  ('inspection-files', 'inspection-files', false, 52428800, ARRAY['image/jpeg','image/png','image/webp','application/pdf']),
  ('invoice-files', 'invoice-files', false, 52428800, ARRAY['application/pdf']),
  ('exports', 'exports', false, 104857600, ARRAY['application/pdf','text/csv','application/json','application/zip','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "public_property_media_read" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_private_storage_read" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_private_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "public_listing_media_read" ON storage.objects;
CREATE POLICY "public_listing_media_read"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'listing-media');

GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Remove the blanket grants installed by the legacy monolithic migration.
-- Re-grant only the browser operations that are intentionally supported below.
REVOKE ALL ON TABLE
  public."Organization", public."MasterDataConfig", public."Person", public."PersonRole",
  public."User", public."Invitation", public."Role", public."RolePermission", public."UserRole",
  public."Property", public."Building", public."Entrance", public."Floor", public."Unit",
  public."UnitMedia", public."Listing", public."ListingPublication", public."Favorite",
  public."SavedSearch", public."Application", public."ApplicationMember",
  public."ApplicationStatusEvent", public."Viewing", public."ViewingAttendee", public."Offer",
  public."Contract", public."ContractParty", public."ContractVersion", public."ContractStatusEvent",
  public."Termination", public."Inspection", public."Invoice", public."InvoiceLine",
  public."InvoiceStatusEvent", public."Payment", public."PaymentAllocation",
  public."ExternalReference", public."IntegrationConnection", public."IntegrationSyncJob",
  public."SyncReviewItem", public."MaintenanceRequest", public."MaintenanceComment",
  public."MaintenanceStatusEvent", public."WorkOrder", public."Supplier", public."Document",
  public."Message", public."Notification", public."ApiKey", public."IdempotencyRecord",
  public."WebhookSubscription", public."WebhookDelivery", public."InboundWebhookEvent",
  public."ImportJob", public."AuditEvent", public."Counter"
FROM anon, authenticated;

-- Browser clients do not receive blanket table writes. RLS plus explicit grants
-- determine access; critical writes go through SECURITY DEFINER RPC functions.
GRANT SELECT ON TABLE
  public."Listing", public."Unit", public."Property", public."Building", public."UnitMedia"
TO authenticated;

GRANT SELECT, UPDATE ON TABLE public."User", public."Person" TO authenticated;
GRANT SELECT ON TABLE
  public."PersonRole", public."Favorite", public."SavedSearch", public."Application",
  public."ApplicationMember", public."ApplicationStatusEvent", public."Viewing",
  public."ViewingAttendee", public."Offer", public."Contract", public."ContractParty",
  public."ContractVersion", public."ContractStatusEvent", public."Termination",
  public."Inspection", public."Invoice", public."InvoiceLine", public."InvoiceStatusEvent",
  public."Payment", public."PaymentAllocation", public."MaintenanceRequest",
  public."MaintenanceComment", public."MaintenanceStatusEvent", public."WorkOrder",
  public."Document", public."Message", public."Notification"
TO authenticated;

GRANT INSERT, DELETE ON TABLE public."Favorite", public."SavedSearch" TO authenticated;
GRANT UPDATE ON TABLE public."Message", public."Notification" TO authenticated;

COMMIT;
