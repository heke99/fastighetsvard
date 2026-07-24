\set ON_ERROR_STOP on

DO $$
DECLARE
  broad_policy text[];
BEGIN
  SELECT array_agg(format('%I.%I', schemaname, tablename) || ':' || policyname)
  INTO broad_policy
  FROM pg_policies
  WHERE schemaname IN ('public', 'storage')
    AND roles @> ARRAY['authenticated']::name[]
    AND lower(COALESCE(qual, '')) IN ('true', '(true)')
    AND tablename <> 'objects';
  IF broad_policy IS NOT NULL THEN
    RAISE EXCEPTION 'Broad authenticated policies found: %', broad_policy;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname IN ('authenticated_private_storage_read', 'authenticated_private_storage_insert')
  ) THEN
    RAISE EXCEPTION 'Legacy permissive private Storage policy still exists';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'private_storage_owner_or_staff_read'
  ) THEN
    RAISE EXCEPTION 'Path-bound private Storage read policy is missing';
  END IF;
END $$;

SELECT 'rls_verification_ok' AS result;

DO $$
DECLARE
  overgranted text[];
BEGIN
  SELECT array_agg(required.table_name ORDER BY required.table_name)
  INTO overgranted
  FROM (VALUES
    ('Organization'), ('MasterDataConfig'), ('Invitation'), ('Role'), ('RolePermission'), ('UserRole'),
    ('Property'), ('Building'), ('Entrance'), ('Floor'), ('Unit'), ('UnitMedia'), ('Listing'),
    ('ListingPublication'), ('Application'), ('ApplicationMember'), ('ApplicationStatusEvent'),
    ('Viewing'), ('ViewingAttendee'), ('Offer'), ('Contract'), ('ContractParty'),
    ('ContractVersion'), ('ContractStatusEvent'), ('Termination'), ('Inspection'), ('Invoice'),
    ('InvoiceLine'), ('InvoiceStatusEvent'), ('Payment'), ('PaymentAllocation'),
    ('ExternalReference'), ('IntegrationConnection'), ('IntegrationSyncJob'), ('SyncReviewItem'),
    ('MaintenanceRequest'), ('MaintenanceComment'), ('MaintenanceStatusEvent'), ('WorkOrder'),
    ('Supplier'), ('Document'), ('ApiKey'), ('IdempotencyRecord'), ('WebhookSubscription'),
    ('WebhookDelivery'), ('InboundWebhookEvent'), ('ImportJob'), ('AuditEvent'), ('Counter')
  ) AS required(table_name)
  WHERE has_table_privilege('authenticated', format('public.%I', required.table_name), 'INSERT')
     OR has_table_privilege('authenticated', format('public.%I', required.table_name), 'DELETE');
  IF overgranted IS NOT NULL THEN
    RAISE EXCEPTION 'Authenticated role has forbidden direct write grants: %', overgranted;
  END IF;
END $$;

DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public."AuditEvent"', 'UPDATE')
     OR has_table_privilege('authenticated', 'public."AuditEvent"', 'DELETE') THEN
    RAISE EXCEPTION 'AuditEvent is mutable through authenticated grants';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'AuditEvent'
      AND t.tgname = 'AuditEvent_append_only' AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'Append-only AuditEvent trigger is missing';
  END IF;
END $$;

SELECT 'grant_and_audit_verification_ok' AS result;
