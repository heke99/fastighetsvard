-- FaddeBo: least-privilege grants for the PostgREST roles.
--
-- Background
-- ----------
-- Supabase installs default privileges that grant EXECUTE on every new function
-- in `public` to `anon`, `authenticated` and `service_role`, and ALL table
-- privileges to `anon` and `authenticated`. The earlier hardening migration only
-- revoked from PUBLIC, which does not remove privileges that were granted to the
-- named roles. As a result every SECURITY DEFINER command in this schema was
-- callable straight from the publishable key, and tables created after the
-- hardening migration kept INSERT/UPDATE/DELETE grants that no RLS policy backs.
--
-- This migration makes the grant surface explicit and deterministic:
--   1. no function in `public` is executable by `anon` or `authenticated`
--      unless it is on the allow list below;
--   2. `anon` may only read the four published catalog views;
--   3. `authenticated` keeps SELECT plus the exact writes that RLS policies
--      already constrain (own person, own user row, own favorites/searches,
--      marking own message/notification as read);
--   4. default privileges no longer leak EXECUTE to the API roles, so future
--      migrations cannot silently reintroduce the problem.
--
-- Functions invoked from inside SECURITY DEFINER functions run with the owner's
-- privileges, so revoking caller EXECUTE does not break internal composition
-- (for example write_audit_event called from change_listing_status).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Functions
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.signature);
  END LOOP;
END
$$;

-- Functions the browser session (user JWT) legitimately calls through PostgREST
-- or that RLS policies evaluate as the `authenticated` role.
DO $$
DECLARE
  fn record;
  allowed constant text[] := ARRAY[
    -- RLS/session helpers evaluated as the querying role
    'current_app_user_id',
    'current_app_person_id',
    'current_app_organization_id',
    'app_has_permission',
    -- portal reads
    'current_user_context',
    'current_active_tenancy_summary',
    'current_person_application_catalog',
    'current_person_contract_catalog',
    'current_person_upcoming_viewings',
    'current_person_has_active_application',
    -- portal writes
    'record_current_login',
    'toggle_favorite',
    'submit_rental_application',
    'withdraw_rental_application',
    'create_viewing_booking',
    'cancel_viewing_booking',
    'accept_rental_offer',
    'decline_rental_offer',
    'request_contract_termination',
    'verify_signing_challenge',
    -- staff commands issued with the signed-in user's JWT; each one enforces
    -- organization scope and app_has_permission internally
    'send_rental_offer',
    'change_application_status',
    'change_listing_status',
    'complete_unit_listings',
    'change_contract_status',
    'create_contract_version',
    'activate_signed_contract'
  ];
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.proname = ANY (allowed)
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn.signature);
  END LOOP;
END
$$;

-- ---------------------------------------------------------------------------
-- 2. Tables and views
-- ---------------------------------------------------------------------------

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

GRANT SELECT ON public.published_listing_catalog TO anon;
GRANT SELECT ON public.published_listing_cities TO anon;
GRANT SELECT ON public.upcoming_unit_catalog TO anon;
GRANT SELECT ON public.public_property_catalog TO anon;

-- `authenticated` keeps every SELECT it already had; only writes are reset.
DO $$
DECLARE
  rel record;
BEGIN
  FOR rel IN
    SELECT c.oid::regclass AS ident
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'v', 'm', 'p')
  LOOP
    EXECUTE format(
      'REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON %s FROM authenticated',
      rel.ident
    );
  END LOOP;
END
$$;

-- Re-grant the writes that existing RLS policies constrain.
GRANT UPDATE ON public."Person" TO authenticated;            -- person_update_own
GRANT UPDATE ON public."Message" TO authenticated;           -- message_recipient_mark_read
GRANT UPDATE ON public."Notification" TO authenticated;      -- notification_owner_mark_read
GRANT INSERT, DELETE ON public."Favorite" TO authenticated;  -- favorite_own
GRANT INSERT, DELETE ON public."SavedSearch" TO authenticated; -- saved_search_own
GRANT INSERT, UPDATE ON public."Brand" TO authenticated;     -- brand_staff_insert/update

-- The four catalogs are read-only projections; nothing may write through them.
REVOKE ALL ON public.published_listing_catalog FROM authenticated;
REVOKE ALL ON public.published_listing_cities FROM authenticated;
REVOKE ALL ON public.upcoming_unit_catalog FROM authenticated;
REVOKE ALL ON public.public_property_catalog FROM authenticated;
GRANT SELECT ON public.published_listing_catalog TO authenticated;
GRANT SELECT ON public.published_listing_cities TO authenticated;
GRANT SELECT ON public.upcoming_unit_catalog TO authenticated;
GRANT SELECT ON public.public_property_catalog TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Stop the leak at the source
-- ---------------------------------------------------------------------------

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM authenticated;

-- ---------------------------------------------------------------------------
-- 4. Deterministic search_path on the shared trigger function
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

COMMIT;
