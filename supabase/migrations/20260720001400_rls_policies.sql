-- Fastighetsvärd
-- Canonical RLS policies. Default is deny; only explicit owner/party/permission
-- relationships are allowed from browser-scoped Supabase clients.

BEGIN;
SET LOCAL search_path = public, extensions;

DO $rls$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'Organization','MasterDataConfig','Person','PersonRole','User','Invitation','Role','RolePermission','UserRole',
    'Property','Building','Entrance','Floor','Unit','UnitMedia','Listing','ListingPublication','Favorite','SavedSearch',
    'Application','ApplicationMember','ApplicationStatusEvent','Viewing','ViewingAttendee','Offer','Contract','ContractParty',
    'ContractVersion','ContractStatusEvent','Termination','Inspection','Invoice','InvoiceLine','InvoiceStatusEvent','Payment',
    'PaymentAllocation','ExternalReference','IntegrationConnection','IntegrationSyncJob','SyncReviewItem','MaintenanceRequest',
    'MaintenanceComment','MaintenanceStatusEvent','WorkOrder','Supplier','Document','Message','Notification','ApiKey',
    'IdempotencyRecord','WebhookSubscription','WebhookDelivery','InboundWebhookEvent','ImportJob','AuditEvent','Counter'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END
$rls$;

-- Remove earlier broad public policies.
DROP POLICY IF EXISTS "public_read_published_listings" ON public."Listing";
DROP POLICY IF EXISTS "public_read_catalog_units" ON public."Unit";
DROP POLICY IF EXISTS "public_read_properties" ON public."Property";
DROP POLICY IF EXISTS "public_read_buildings" ON public."Building";
DROP POLICY IF EXISTS "public_read_unit_media" ON public."UnitMedia";

-- Safe public read model. Raw tables are not granted to anon.
DROP VIEW IF EXISTS public.published_listing_catalog;
CREATE VIEW public.published_listing_catalog AS
SELECT
  l."id",
  l."slug",
  l."title",
  l."description",
  l."category",
  l."publishedAt",
  l."applicationDeadline",
  l."moveInDate",
  l."rent",
  l."price",
  l."contactName",
  l."contactEmail",
  l."contactPhone",
  l."seoTitle",
  l."seoDescription",
  u."id" AS "unitId",
  u."unitNumber",
  u."apartmentNumber",
  u."type" AS "unitType",
  u."address",
  u."postalCode",
  u."city",
  u."floorLevel",
  u."rooms",
  u."livingArea",
  u."hasElevator",
  u."hasBalcony",
  u."hasPatio",
  u."accessible",
  p."name" AS "propertyName"
FROM public."Listing" l
JOIN public."Unit" u ON u."id" = l."unitId"
JOIN public."Property" p ON p."id" = u."propertyId"
WHERE l."status" = 'PUBLISHED'
  AND (l."publishAt" IS NULL OR l."publishAt" <= CURRENT_TIMESTAMP)
  AND (l."applicationDeadline" IS NULL OR l."applicationDeadline" >= CURRENT_TIMESTAMP);

REVOKE ALL ON public.published_listing_catalog FROM PUBLIC;
GRANT SELECT ON public.published_listing_catalog TO anon, authenticated;

-- Own app profile. Verification state is synchronized from auth.users.
DROP POLICY IF EXISTS "user_read_own_profile" ON public."User";
CREATE POLICY "user_read_own_profile" ON public."User" FOR SELECT TO authenticated
USING ("authUserId" = auth.uid());
DROP POLICY IF EXISTS "user_update_own_profile" ON public."User";
CREATE POLICY "user_update_own_profile" ON public."User" FOR UPDATE TO authenticated
USING ("authUserId" = auth.uid())
WITH CHECK ("authUserId" = auth.uid() AND "isActive" = true);

DROP POLICY IF EXISTS "person_read_own" ON public."Person";
CREATE POLICY "person_read_own_or_authorized" ON public."Person" FOR SELECT TO authenticated
USING (
  "id" = public.current_app_person_id()
  OR ("organizationId" = public.current_app_organization_id() AND public.app_has_permission('persons:read'))
);
DROP POLICY IF EXISTS "person_update_own" ON public."Person";
CREATE POLICY "person_update_own" ON public."Person" FOR UPDATE TO authenticated
USING ("id" = public.current_app_person_id())
WITH CHECK ("id" = public.current_app_person_id() AND "organizationId" = public.current_app_organization_id());

DROP POLICY IF EXISTS "person_roles_read_own" ON public."PersonRole";
CREATE POLICY "person_roles_read_own_or_authorized" ON public."PersonRole" FOR SELECT TO authenticated
USING (
  "personId" = public.current_app_person_id()
  OR public.app_has_permission('persons:read')
);

CREATE POLICY "organization_read_own" ON public."Organization" FOR SELECT TO authenticated
USING ("id" = public.current_app_organization_id());

CREATE POLICY "staff_read_properties" ON public."Property" FOR SELECT TO authenticated
USING ("organizationId" = public.current_app_organization_id() AND public.app_has_permission('properties:read'));
CREATE POLICY "staff_read_buildings" ON public."Building" FOR SELECT TO authenticated
USING ("organizationId" = public.current_app_organization_id() AND public.app_has_permission('properties:read'));
CREATE POLICY "staff_read_units" ON public."Unit" FOR SELECT TO authenticated
USING ("organizationId" = public.current_app_organization_id() AND public.app_has_permission('units:read'));
CREATE POLICY "staff_read_listings" ON public."Listing" FOR SELECT TO authenticated
USING ("organizationId" = public.current_app_organization_id() AND public.app_has_permission('listings:read'));

CREATE POLICY "favorite_own" ON public."Favorite" FOR ALL TO authenticated
USING ("personId" = public.current_app_person_id() AND "organizationId" = public.current_app_organization_id())
WITH CHECK ("personId" = public.current_app_person_id() AND "organizationId" = public.current_app_organization_id());
CREATE POLICY "saved_search_own" ON public."SavedSearch" FOR ALL TO authenticated
USING ("personId" = public.current_app_person_id() AND "organizationId" = public.current_app_organization_id())
WITH CHECK ("personId" = public.current_app_person_id() AND "organizationId" = public.current_app_organization_id());

CREATE POLICY "application_party_or_staff_read" ON public."Application" FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."ApplicationMember" am
    WHERE am."applicationId" = "Application"."id"
      AND am."personId" = public.current_app_person_id()
  )
  OR ("organizationId" = public.current_app_organization_id() AND public.app_has_permission('applications:read'))
);
CREATE POLICY "application_member_party_or_staff_read" ON public."ApplicationMember" FOR SELECT TO authenticated
USING (
  "personId" = public.current_app_person_id()
  OR EXISTS (
    SELECT 1 FROM public."Application" a
    WHERE a."id" = "ApplicationMember"."applicationId"
      AND a."organizationId" = public.current_app_organization_id()
      AND public.app_has_permission('applications:read')
  )
);
CREATE POLICY "application_status_party_or_staff_read" ON public."ApplicationStatusEvent" FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public."Application" a
    LEFT JOIN public."ApplicationMember" am ON am."applicationId" = a."id"
    WHERE a."id" = "ApplicationStatusEvent"."applicationId"
      AND (am."personId" = public.current_app_person_id()
        OR (a."organizationId" = public.current_app_organization_id() AND public.app_has_permission('applications:read')))
  )
);

CREATE POLICY "viewing_booking_party_or_staff_read" ON public."ViewingAttendee" FOR SELECT TO authenticated
USING (
  "personId" = public.current_app_person_id()
  OR EXISTS (
    SELECT 1 FROM public."Viewing" v
    WHERE v."id" = "ViewingAttendee"."viewingId"
      AND v."organizationId" = public.current_app_organization_id()
      AND public.app_has_permission('viewings:read')
  )
);
CREATE POLICY "viewing_party_or_staff_read" ON public."Viewing" FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."ViewingAttendee" va
    WHERE va."viewingId" = "Viewing"."id" AND va."personId" = public.current_app_person_id()
  )
  OR ("organizationId" = public.current_app_organization_id() AND public.app_has_permission('viewings:read'))
);

CREATE POLICY "offer_owner_or_staff_read" ON public."Offer" FOR SELECT TO authenticated
USING (
  "personId" = public.current_app_person_id()
  OR ("organizationId" = public.current_app_organization_id() AND public.app_has_permission('offers:read'))
);

CREATE POLICY "contract_party_or_staff_read" ON public."Contract" FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."ContractParty" cp
    WHERE cp."contractId" = "Contract"."id" AND cp."personId" = public.current_app_person_id()
  )
  OR ("organizationId" = public.current_app_organization_id() AND public.app_has_permission('contracts:read'))
);
CREATE POLICY "contract_party_rows_read" ON public."ContractParty" FOR SELECT TO authenticated
USING (
  "personId" = public.current_app_person_id()
  OR EXISTS (
    SELECT 1 FROM public."Contract" c
    WHERE c."id" = "ContractParty"."contractId"
      AND c."organizationId" = public.current_app_organization_id()
      AND public.app_has_permission('contracts:read')
  )
);
CREATE POLICY "contract_version_party_or_staff_read" ON public."ContractVersion" FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."Contract" c
    LEFT JOIN public."ContractParty" cp ON cp."contractId" = c."id"
    WHERE c."id" = "ContractVersion"."contractId"
      AND (cp."personId" = public.current_app_person_id()
        OR (c."organizationId" = public.current_app_organization_id() AND public.app_has_permission('contracts:read')))
  )
);
CREATE POLICY "termination_party_or_staff_read" ON public."Termination" FOR SELECT TO authenticated
USING (
  "requestedByPersonId" = public.current_app_person_id()
  OR EXISTS (
    SELECT 1 FROM public."ContractParty" cp
    WHERE cp."contractId" = "Termination"."contractId" AND cp."personId" = public.current_app_person_id()
  )
  OR ("organizationId" = public.current_app_organization_id() AND public.app_has_permission('contracts:read'))
);

CREATE POLICY "invoice_owner_or_staff_read" ON public."Invoice" FOR SELECT TO authenticated
USING (
  "personId" = public.current_app_person_id()
  OR ("organizationId" = public.current_app_organization_id() AND public.app_has_permission('invoices:read'))
);
CREATE POLICY "invoice_line_owner_or_staff_read" ON public."InvoiceLine" FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."Invoice" i
    WHERE i."id" = "InvoiceLine"."invoiceId"
      AND (i."personId" = public.current_app_person_id()
        OR (i."organizationId" = public.current_app_organization_id() AND public.app_has_permission('invoices:read')))
  )
);
CREATE POLICY "payment_owner_or_staff_read" ON public."Payment" FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public."PaymentAllocation" pa
    JOIN public."Invoice" i ON i."id" = pa."invoiceId"
    WHERE pa."paymentId" = "Payment"."id"
      AND (i."personId" = public.current_app_person_id()
        OR (i."organizationId" = public.current_app_organization_id() AND public.app_has_permission('payments:read')))
  )
);

CREATE POLICY "maintenance_owner_or_staff_read" ON public."MaintenanceRequest" FOR SELECT TO authenticated
USING (
  "personId" = public.current_app_person_id()
  OR ("organizationId" = public.current_app_organization_id() AND public.app_has_permission('maintenance:read'))
);
CREATE POLICY "maintenance_comment_owner_or_staff_read" ON public."MaintenanceComment" FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."MaintenanceRequest" mr
    WHERE mr."id" = "MaintenanceComment"."requestId"
      AND (mr."personId" = public.current_app_person_id()
        OR (mr."organizationId" = public.current_app_organization_id() AND public.app_has_permission('maintenance:read')))
  )
);
CREATE POLICY "work_order_assignee_or_staff_read" ON public."WorkOrder" FOR SELECT TO authenticated
USING (
  "assigneeUserId" = public.current_app_user_id()
  OR ("organizationId" = public.current_app_organization_id() AND public.app_has_permission('workorders:read'))
);
CREATE POLICY "work_order_assignee_update" ON public."WorkOrder" FOR UPDATE TO authenticated
USING ("assigneeUserId" = public.current_app_user_id())
WITH CHECK ("assigneeUserId" = public.current_app_user_id());

CREATE POLICY "document_related_person_or_staff_read" ON public."Document" FOR SELECT TO authenticated
USING (
  "personId" = public.current_app_person_id()
  OR EXISTS (SELECT 1 FROM public."ApplicationMember" am WHERE am."applicationId" = "Document"."applicationId" AND am."personId" = public.current_app_person_id())
  OR EXISTS (SELECT 1 FROM public."ContractParty" cp WHERE cp."contractId" = "Document"."contractId" AND cp."personId" = public.current_app_person_id())
  OR EXISTS (SELECT 1 FROM public."MaintenanceRequest" mr WHERE mr."id" = "Document"."maintenanceRequestId" AND mr."personId" = public.current_app_person_id())
  OR ("organizationId" = public.current_app_organization_id() AND public.app_has_permission('documents:read'))
);

CREATE POLICY "message_party_read" ON public."Message" FOR SELECT TO authenticated
USING ("senderPersonId" = public.current_app_person_id() OR "recipientPersonId" = public.current_app_person_id()
  OR ("organizationId" = public.current_app_organization_id() AND public.app_has_permission('messages:read')));
CREATE POLICY "message_recipient_mark_read" ON public."Message" FOR UPDATE TO authenticated
USING ("recipientPersonId" = public.current_app_person_id())
WITH CHECK ("recipientPersonId" = public.current_app_person_id());
CREATE POLICY "notification_owner_read" ON public."Notification" FOR SELECT TO authenticated
USING ("personId" = public.current_app_person_id());
CREATE POLICY "notification_owner_mark_read" ON public."Notification" FOR UPDATE TO authenticated
USING ("personId" = public.current_app_person_id())
WITH CHECK ("personId" = public.current_app_person_id());

-- Audit is read-only and only for explicit permission. No update/delete policies.
CREATE POLICY "audit_authorized_read" ON public."AuditEvent" FOR SELECT TO authenticated
USING ("organizationId" = public.current_app_organization_id() AND public.app_has_permission('audit:read'));

COMMIT;
