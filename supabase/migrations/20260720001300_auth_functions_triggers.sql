-- Östgöta El Teknik Fastighetsplattform
-- Step: Supabase Auth link, helper functions and updatedAt triggers
-- Safe to run in filename order. This file is transactional.

BEGIN;
SET LOCAL search_path = public, extensions;

-- App profiles are linked 1:1 to Supabase Auth users.
CREATE UNIQUE INDEX IF NOT EXISTS "User_authUserId_key" ON public."User"("authUserId");
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'User_auth_user_fkey'
      AND conrelid = 'public."User"'::regclass
  ) THEN
    ALTER TABLE public."User"
      ADD CONSTRAINT "User_auth_user_fkey"
      FOREIGN KEY ("authUserId") REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$constraint$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "Organization_set_updated_at" ON public."Organization";
CREATE TRIGGER "Organization_set_updated_at" BEFORE UPDATE ON public."Organization" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "MasterDataConfig_set_updated_at" ON public."MasterDataConfig";
CREATE TRIGGER "MasterDataConfig_set_updated_at" BEFORE UPDATE ON public."MasterDataConfig" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "Person_set_updated_at" ON public."Person";
CREATE TRIGGER "Person_set_updated_at" BEFORE UPDATE ON public."Person" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "User_set_updated_at" ON public."User";
CREATE TRIGGER "User_set_updated_at" BEFORE UPDATE ON public."User" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "Role_set_updated_at" ON public."Role";
CREATE TRIGGER "Role_set_updated_at" BEFORE UPDATE ON public."Role" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "Property_set_updated_at" ON public."Property";
CREATE TRIGGER "Property_set_updated_at" BEFORE UPDATE ON public."Property" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "Building_set_updated_at" ON public."Building";
CREATE TRIGGER "Building_set_updated_at" BEFORE UPDATE ON public."Building" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "Unit_set_updated_at" ON public."Unit";
CREATE TRIGGER "Unit_set_updated_at" BEFORE UPDATE ON public."Unit" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "Listing_set_updated_at" ON public."Listing";
CREATE TRIGGER "Listing_set_updated_at" BEFORE UPDATE ON public."Listing" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "SavedSearch_set_updated_at" ON public."SavedSearch";
CREATE TRIGGER "SavedSearch_set_updated_at" BEFORE UPDATE ON public."SavedSearch" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "Application_set_updated_at" ON public."Application";
CREATE TRIGGER "Application_set_updated_at" BEFORE UPDATE ON public."Application" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "Viewing_set_updated_at" ON public."Viewing";
CREATE TRIGGER "Viewing_set_updated_at" BEFORE UPDATE ON public."Viewing" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "ViewingAttendee_set_updated_at" ON public."ViewingAttendee";
CREATE TRIGGER "ViewingAttendee_set_updated_at" BEFORE UPDATE ON public."ViewingAttendee" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "Offer_set_updated_at" ON public."Offer";
CREATE TRIGGER "Offer_set_updated_at" BEFORE UPDATE ON public."Offer" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "Contract_set_updated_at" ON public."Contract";
CREATE TRIGGER "Contract_set_updated_at" BEFORE UPDATE ON public."Contract" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "Termination_set_updated_at" ON public."Termination";
CREATE TRIGGER "Termination_set_updated_at" BEFORE UPDATE ON public."Termination" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "Inspection_set_updated_at" ON public."Inspection";
CREATE TRIGGER "Inspection_set_updated_at" BEFORE UPDATE ON public."Inspection" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "Invoice_set_updated_at" ON public."Invoice";
CREATE TRIGGER "Invoice_set_updated_at" BEFORE UPDATE ON public."Invoice" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "ExternalReference_set_updated_at" ON public."ExternalReference";
CREATE TRIGGER "ExternalReference_set_updated_at" BEFORE UPDATE ON public."ExternalReference" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "IntegrationConnection_set_updated_at" ON public."IntegrationConnection";
CREATE TRIGGER "IntegrationConnection_set_updated_at" BEFORE UPDATE ON public."IntegrationConnection" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "SyncReviewItem_set_updated_at" ON public."SyncReviewItem";
CREATE TRIGGER "SyncReviewItem_set_updated_at" BEFORE UPDATE ON public."SyncReviewItem" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "MaintenanceRequest_set_updated_at" ON public."MaintenanceRequest";
CREATE TRIGGER "MaintenanceRequest_set_updated_at" BEFORE UPDATE ON public."MaintenanceRequest" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "WorkOrder_set_updated_at" ON public."WorkOrder";
CREATE TRIGGER "WorkOrder_set_updated_at" BEFORE UPDATE ON public."WorkOrder" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "Supplier_set_updated_at" ON public."Supplier";
CREATE TRIGGER "Supplier_set_updated_at" BEFORE UPDATE ON public."Supplier" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "Document_set_updated_at" ON public."Document";
CREATE TRIGGER "Document_set_updated_at" BEFORE UPDATE ON public."Document" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "ApiKey_set_updated_at" ON public."ApiKey";
CREATE TRIGGER "ApiKey_set_updated_at" BEFORE UPDATE ON public."ApiKey" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "WebhookSubscription_set_updated_at" ON public."WebhookSubscription";
CREATE TRIGGER "WebhookSubscription_set_updated_at" BEFORE UPDATE ON public."WebhookSubscription" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "WebhookDelivery_set_updated_at" ON public."WebhookDelivery";
CREATE TRIGGER "WebhookDelivery_set_updated_at" BEFORE UPDATE ON public."WebhookDelivery" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- Helpers used by Row Level Security.
CREATE OR REPLACE FUNCTION public.current_app_organization_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT "organizationId" FROM "User" WHERE "authUserId" = auth.uid() AND "isActive" = true LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_app_person_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT "personId" FROM "User" WHERE "authUserId" = auth.uid() AND "isActive" = true LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_app_organization_id() FROM public;
REVOKE ALL ON FUNCTION public.current_app_person_id() FROM public;
GRANT EXECUTE ON FUNCTION public.current_app_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_app_person_id() TO authenticated;

-- RLS is enabled on every application table. Server administration uses the
-- Supabase secret key; browser access remains policy-controlled.

COMMIT;
