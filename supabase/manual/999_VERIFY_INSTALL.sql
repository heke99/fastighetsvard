-- Verification only. This file changes no data.
WITH expected_tables(name) AS (
  VALUES
  ('Organization'),('MasterDataConfig'),('Person'),('PersonRole'),('User'),('Invitation'),('Role'),('RolePermission'),('UserRole'),
  ('Property'),('Building'),('Entrance'),('Floor'),('Unit'),('UnitMedia'),('Listing'),('ListingPublication'),('Favorite'),('SavedSearch'),
  ('Application'),('ApplicationMember'),('ApplicationStatusEvent'),('Viewing'),('ViewingAttendee'),('Offer'),('Contract'),('ContractParty'),
  ('ContractVersion'),('ContractStatusEvent'),('Termination'),('Inspection'),('Invoice'),('InvoiceLine'),('InvoiceStatusEvent'),('Payment'),
  ('PaymentAllocation'),('ExternalReference'),('IntegrationConnection'),('IntegrationSyncJob'),('SyncReviewItem'),('MaintenanceRequest'),
  ('MaintenanceComment'),('MaintenanceStatusEvent'),('WorkOrder'),('Supplier'),('Document'),('Message'),('Notification'),('ApiKey'),
  ('IdempotencyRecord'),('WebhookSubscription'),('WebhookDelivery'),('InboundWebhookEvent'),('ImportJob'),('AuditEvent'),('Counter')
), actual_tables AS (
  SELECT tablename AS name
  FROM pg_tables
  WHERE schemaname = 'public'
), missing_tables AS (
  SELECT e.name FROM expected_tables e
  LEFT JOIN actual_tables a USING (name)
  WHERE a.name IS NULL
), counts AS (
  SELECT
    (SELECT count(*) FROM expected_tables) AS expected_table_count,
    (SELECT count(*) FROM actual_tables a JOIN expected_tables e USING (name)) AS installed_table_count,
    (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype='e') AS public_enum_count,
    (SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.contype='f') AS foreign_key_count,
    (SELECT count(*) FROM pg_policies WHERE schemaname='public') AS public_policy_count,
    (SELECT count(*) FROM storage.buckets WHERE id IN ('property-media','tenant-documents','maintenance-files')) AS storage_bucket_count
)
SELECT
  c.*,
  COALESCE((SELECT jsonb_agg(name ORDER BY name) FROM missing_tables), '[]'::jsonb) AS missing_tables,
  CASE
    WHEN c.installed_table_count = c.expected_table_count
     AND c.public_enum_count >= 28
     AND c.storage_bucket_count = 3
    THEN 'OK'
    ELSE 'INCOMPLETE'
  END AS installation_status
FROM counts c;
