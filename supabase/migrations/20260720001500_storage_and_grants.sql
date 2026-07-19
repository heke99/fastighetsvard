-- Östgöta El Teknik Fastighetsplattform
-- Step: Storage buckets, storage policies and PostgREST grants
-- Safe to run in filename order. This file is transactional.

BEGIN;
SET LOCAL search_path = public, extensions;

-- Storage buckets and policies.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('property-media', 'property-media', true, 20971520, ARRAY['image/jpeg','image/png','image/webp','application/pdf']),
  ('tenant-documents', 'tenant-documents', false, 52428800, ARRAY['application/pdf','image/jpeg','image/png','image/webp']),
  ('maintenance-files', 'maintenance-files', false, 52428800, ARRAY['image/jpeg','image/png','image/webp','application/pdf','video/mp4'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public_property_media_read" ON storage.objects;
CREATE POLICY "public_property_media_read" ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'property-media');
DROP POLICY IF EXISTS "authenticated_private_storage_read" ON storage.objects;
CREATE POLICY "authenticated_private_storage_read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN ('tenant-documents','maintenance-files'));
DROP POLICY IF EXISTS "authenticated_private_storage_insert" ON storage.objects;
CREATE POLICY "authenticated_private_storage_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('tenant-documents','maintenance-files'));

-- PostgREST permissions. RLS still determines which rows are visible.
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Organization" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."MasterDataConfig" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Person" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."PersonRole" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."User" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Invitation" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Role" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."RolePermission" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."UserRole" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Property" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Building" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Entrance" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Floor" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Unit" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."UnitMedia" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Listing" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."ListingPublication" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Favorite" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."SavedSearch" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Application" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."ApplicationMember" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."ApplicationStatusEvent" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Viewing" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."ViewingAttendee" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Offer" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Contract" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."ContractParty" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."ContractVersion" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."ContractStatusEvent" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Termination" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Inspection" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Invoice" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."InvoiceLine" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."InvoiceStatusEvent" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Payment" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."PaymentAllocation" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."ExternalReference" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."IntegrationConnection" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."IntegrationSyncJob" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."SyncReviewItem" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."MaintenanceRequest" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."MaintenanceComment" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."MaintenanceStatusEvent" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."WorkOrder" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Supplier" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Document" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Message" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Notification" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."ApiKey" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."IdempotencyRecord" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."WebhookSubscription" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."WebhookDelivery" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."InboundWebhookEvent" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."ImportJob" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."AuditEvent" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Counter" TO authenticated;
GRANT SELECT ON TABLE public."Listing" TO anon;
GRANT SELECT ON TABLE public."Unit" TO anon;
GRANT SELECT ON TABLE public."Property" TO anon;
GRANT SELECT ON TABLE public."Building" TO anon;
GRANT SELECT ON TABLE public."UnitMedia" TO anon;

COMMIT;
