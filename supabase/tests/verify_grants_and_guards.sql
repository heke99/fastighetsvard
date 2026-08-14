-- Verifierar behörighetsytan och raderingsskydden mot en installerad databas.
--
-- Körs med:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/verify_grants_and_guards.sql
--
-- Skriptet skriver inget bestående: hela testet körs i en transaktion som
-- rullas tillbaka.

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- 1. anon får inte kunna anropa någon av applikationens funktioner
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_leaked text;
BEGIN
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname)
  INTO v_leaked
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prokind = 'f'
    AND has_function_privilege('anon', p.oid, 'EXECUTE')
    -- btree_gist-stödfunktioner tar interna typer och är inte anropbara via API:t
    AND p.proname !~ '^(gbt|gbtree)'
    AND p.proname !~ '_dist$';

  IF v_leaked IS NOT NULL THEN
    RAISE EXCEPTION 'anon kan exekvera public-funktioner: %', v_leaked;
  END IF;
  RAISE NOTICE 'OK: anon saknar EXECUTE på samtliga applikationsfunktioner';
END
$$;

-- ---------------------------------------------------------------------------
-- 2. authenticated får bara exekvera den avsedda listan
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_unexpected text;
  allowed constant text[] := ARRAY[
    'current_app_user_id','current_app_person_id','current_app_organization_id','app_has_permission',
    'current_user_context','current_active_tenancy_summary','current_person_application_catalog',
    'current_person_contract_catalog','current_person_upcoming_viewings','current_person_has_active_application',
    'record_current_login','toggle_favorite','submit_rental_application','withdraw_rental_application',
    'create_viewing_booking','cancel_viewing_booking','accept_rental_offer','decline_rental_offer',
    'request_contract_termination','verify_signing_challenge','send_rental_offer','change_application_status',
    'change_listing_status','complete_unit_listings','change_contract_status','create_contract_version',
    'activate_signed_contract','note_entity_permission'
  ];
BEGIN
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname)
  INTO v_unexpected
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prokind = 'f'
    AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
    AND p.proname !~ '^(gbt|gbtree)'
    AND p.proname !~ '_dist$'
    AND NOT (p.proname = ANY (allowed));

  IF v_unexpected IS NOT NULL THEN
    RAISE EXCEPTION 'authenticated kan exekvera funktioner utanför listan: %', v_unexpected;
  END IF;
  RAISE NOTICE 'OK: authenticated exekverar endast den avsedda funktionslistan';
END
$$;

-- ---------------------------------------------------------------------------
-- 3. anon når endast de fyra publika katalogvyerna
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_unexpected text;
BEGIN
  SELECT string_agg(DISTINCT table_name || ':' || privilege_type, ', ')
  INTO v_unexpected
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND grantee = 'anon'
    AND NOT (
      privilege_type = 'SELECT'
      AND table_name IN (
        'published_listing_catalog', 'published_listing_cities',
        'upcoming_unit_catalog', 'public_property_catalog'
      )
    );

  IF v_unexpected IS NOT NULL THEN
    RAISE EXCEPTION 'anon har oväntade tabellrättigheter: %', v_unexpected;
  END IF;
  RAISE NOTICE 'OK: anon har endast SELECT på de fyra katalogvyerna';
END
$$;

-- ---------------------------------------------------------------------------
-- 4. authenticated skriver bara där en RLS-policy finns
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_unexpected text;
BEGIN
  SELECT string_agg(DISTINCT table_name || ':' || privilege_type, ', ')
  INTO v_unexpected
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND grantee = 'authenticated'
    AND privilege_type <> 'SELECT'
    AND NOT (
      (table_name = 'Person' AND privilege_type = 'UPDATE')
      OR (table_name = 'Message' AND privilege_type = 'UPDATE')
      OR (table_name = 'Notification' AND privilege_type = 'UPDATE')
      OR (table_name = 'Favorite' AND privilege_type IN ('INSERT', 'DELETE'))
      OR (table_name = 'SavedSearch' AND privilege_type IN ('INSERT', 'DELETE'))
      OR (table_name = 'Brand' AND privilege_type IN ('INSERT', 'UPDATE'))
    );

  IF v_unexpected IS NOT NULL THEN
    RAISE EXCEPTION 'authenticated har oväntade skrivrättigheter: %', v_unexpected;
  END IF;
  RAISE NOTICE 'OK: authenticated skriver endast där en RLS-policy finns';
END
$$;

-- ---------------------------------------------------------------------------
-- 5. Raderingsskydd och anteckningar
-- ---------------------------------------------------------------------------

BEGIN;

DO $$
DECLARE
  v_org text;
  v_brand text;
  v_prop text := 'verify-prop-' || gen_random_uuid()::text;
  v_unit text := 'verify-unit-' || gen_random_uuid()::text;
  v_contract text := 'verify-contract-' || gen_random_uuid()::text;
  v_note text;
  v_deleted boolean;
BEGIN
  SELECT "id" INTO v_org FROM public."Organization" LIMIT 1;
  IF v_org IS NULL THEN
    RAISE NOTICE 'HOPPAR ÖVER: ingen organisation installerad';
    RETURN;
  END IF;
  SELECT "id" INTO v_brand FROM public."Brand" WHERE "organizationId" = v_org LIMIT 1;

  INSERT INTO public."Property"("id","organizationId","brandId","name","address","city")
  VALUES (v_prop, v_org, v_brand, 'VERIFY', 'Testgatan 1', 'Mjölby');
  INSERT INTO public."Unit"("id","organizationId","propertyId","unitNumber","type","address","city")
  VALUES (v_unit, v_org, v_prop, 'VERIFY-1', 'APARTMENT', 'Testgatan 1', 'Mjölby');
  INSERT INTO public."Contract"("id","organizationId","unitId","contractNumber","status","startDate","rent")
  VALUES (v_contract, v_org, v_unit, 'VERIFY-1', 'ACTIVE', CURRENT_TIMESTAMP, 1000);

  v_deleted := true;
  BEGIN
    DELETE FROM public."Contract" WHERE "id" = v_contract;
  EXCEPTION WHEN OTHERS THEN
    v_deleted := false;
  END;
  IF v_deleted THEN RAISE EXCEPTION 'Aktivt avtal kunde raderas'; END IF;

  v_deleted := true;
  BEGIN
    DELETE FROM public."Unit" WHERE "id" = v_unit;
  EXCEPTION WHEN OTHERS THEN
    v_deleted := false;
  END;
  IF v_deleted THEN RAISE EXCEPTION 'Objekt med avtalshistorik kunde raderas'; END IF;

  v_deleted := true;
  BEGIN
    DELETE FROM public."Property" WHERE "id" = v_prop;
  EXCEPTION WHEN OTHERS THEN
    v_deleted := false;
  END;
  IF v_deleted THEN RAISE EXCEPTION 'Fastighet med aktivt avtal kunde kaskadraderas'; END IF;

  UPDATE public."Contract" SET "status" = 'DRAFT' WHERE "id" = v_contract;
  DELETE FROM public."Contract" WHERE "id" = v_contract;

  INSERT INTO public."Note"("organizationId","entityType","entityId","body")
  VALUES (v_org, 'PROPERTY', v_prop, 'Verifieringsanteckning')
  RETURNING "id" INTO v_note;

  v_deleted := true;
  BEGIN
    INSERT INTO public."Note"("organizationId","entityType","entityId","body")
    VALUES (v_org, 'PROPERTY', v_prop, '   ');
  EXCEPTION WHEN OTHERS THEN
    v_deleted := false;
  END;
  IF v_deleted THEN RAISE EXCEPTION 'Tom anteckning accepterades'; END IF;

  RAISE NOTICE 'OK: raderingsskydd och anteckningar beter sig korrekt';
END
$$;

ROLLBACK;
