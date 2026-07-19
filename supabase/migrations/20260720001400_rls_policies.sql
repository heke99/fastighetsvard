-- Östgöta El Teknik Fastighetsplattform
-- Step: Row level security and application policies
-- Safe to run in filename order. This file is transactional.

BEGIN;
SET LOCAL search_path = public, extensions;

ALTER TABLE public."Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MasterDataConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Person" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PersonRole" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Invitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Role" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RolePermission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."UserRole" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Property" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Building" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Entrance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Floor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Unit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."UnitMedia" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Listing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ListingPublication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Favorite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SavedSearch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Application" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ApplicationMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ApplicationStatusEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Viewing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ViewingAttendee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Offer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Contract" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ContractParty" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ContractVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ContractStatusEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Termination" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Inspection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."InvoiceLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."InvoiceStatusEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PaymentAllocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ExternalReference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."IntegrationConnection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."IntegrationSyncJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SyncReviewItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MaintenanceRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MaintenanceComment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MaintenanceStatusEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WorkOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Supplier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ApiKey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."IdempotencyRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WebhookSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WebhookDelivery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."InboundWebhookEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ImportJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AuditEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Counter" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_published_listings" ON public."Listing";
CREATE POLICY "public_read_published_listings" ON public."Listing" FOR SELECT TO anon, authenticated
USING ("status" = 'PUBLISHED');
DROP POLICY IF EXISTS "public_read_catalog_units" ON public."Unit";
CREATE POLICY "public_read_catalog_units" ON public."Unit" FOR SELECT TO anon, authenticated
USING ("status" IN ('PUBLISHED','APPLICATION_OPEN','FOR_SALE','BIDDING','RENTED'));
DROP POLICY IF EXISTS "public_read_properties" ON public."Property";
CREATE POLICY "public_read_properties" ON public."Property" FOR SELECT TO anon, authenticated
USING ("status" <> 'ARCHIVED');
DROP POLICY IF EXISTS "public_read_buildings" ON public."Building";
CREATE POLICY "public_read_buildings" ON public."Building" FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "public_read_unit_media" ON public."UnitMedia";
CREATE POLICY "public_read_unit_media" ON public."UnitMedia" FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "user_read_own_profile" ON public."User";
CREATE POLICY "user_read_own_profile" ON public."User" FOR SELECT TO authenticated
USING ("authUserId" = auth.uid());
DROP POLICY IF EXISTS "user_update_own_profile" ON public."User";
CREATE POLICY "user_update_own_profile" ON public."User" FOR UPDATE TO authenticated
USING ("authUserId" = auth.uid()) WITH CHECK ("authUserId" = auth.uid());
DROP POLICY IF EXISTS "person_read_own" ON public."Person";
CREATE POLICY "person_read_own" ON public."Person" FOR SELECT TO authenticated
USING ("id" = public.current_app_person_id());
DROP POLICY IF EXISTS "person_update_own" ON public."Person";
CREATE POLICY "person_update_own" ON public."Person" FOR UPDATE TO authenticated
USING ("id" = public.current_app_person_id()) WITH CHECK ("id" = public.current_app_person_id());
DROP POLICY IF EXISTS "person_roles_read_own" ON public."PersonRole";
CREATE POLICY "person_roles_read_own" ON public."PersonRole" FOR SELECT TO authenticated
USING ("personId" = public.current_app_person_id());

COMMIT;
