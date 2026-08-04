-- FaddeBo canonical account lifecycle.
-- Repairs legacy identity columns, makes verified self-signup idempotent,
-- installs the system role catalogue, and provides one canonical owner promotion RPC.

BEGIN;
SET LOCAL search_path = public, auth, extensions, pg_temp;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Legacy schema repair
-- ---------------------------------------------------------------------------
DO $legacy_user$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'User'
      AND column_name = 'passwordHash'
  ) THEN
    ALTER TABLE public."User" ALTER COLUMN "passwordHash" DROP NOT NULL;
    ALTER TABLE public."User" ALTER COLUMN "passwordHash" DROP DEFAULT;
    COMMENT ON COLUMN public."User"."passwordHash" IS
      'Legacy only. Passwords are managed exclusively by Supabase Auth.';
  END IF;
END
$legacy_user$;

DO $timestamp_defaults$
DECLARE
  v_column record;
BEGIN
  FOR v_column IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name = c.table_name
     AND t.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public'
      AND c.column_name IN ('createdAt', 'updatedAt')
      AND c.data_type IN ('timestamp without time zone', 'timestamp with time zone')
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN %I SET DEFAULT CURRENT_TIMESTAMP',
      v_column.table_name,
      v_column.column_name
    );
  END LOOP;
END
$timestamp_defaults$;

-- ---------------------------------------------------------------------------
-- 2. Canonical organization and brand
-- ---------------------------------------------------------------------------
DO $organization_and_brand$
DECLARE
  v_organization_id text;
  v_brand_id text;
BEGIN
  SELECT "id"
  INTO v_organization_id
  FROM public."Organization"
  WHERE "orgNumber" = '559350-5620'
  ORDER BY "createdAt", "id"
  LIMIT 1
  FOR UPDATE;

  IF v_organization_id IS NULL THEN
    SELECT "id"
    INTO v_organization_id
    FROM public."Organization"
    ORDER BY "createdAt", "id"
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_organization_id IS NULL THEN
    v_organization_id := gen_random_uuid()::text;
    INSERT INTO public."Organization" (
      "id", "name", "legalName", "orgNumber", "email",
      "dataProtectionEmail", "createdAt", "updatedAt"
    ) VALUES (
      v_organization_id,
      'Östgöta El Teknik',
      'Östgöta El Teknik AB',
      '559350-5620',
      'info@faddebo.se',
      'info@faddebo.se',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
  ELSE
    UPDATE public."Organization"
    SET
      "name" = COALESCE(NULLIF(trim("name"), ''), 'Östgöta El Teknik'),
      "legalName" = COALESCE(NULLIF(trim("legalName"), ''), 'Östgöta El Teknik AB'),
      "orgNumber" = COALESCE(NULLIF(trim("orgNumber"), ''), '559350-5620'),
      "email" = 'info@faddebo.se',
      "dataProtectionEmail" = 'info@faddebo.se',
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = v_organization_id;
  END IF;

  UPDATE public."Brand"
  SET "isPrimary" = false, "updatedAt" = CURRENT_TIMESTAMP
  WHERE "organizationId" = v_organization_id
    AND "slug" <> 'faddebo'
    AND "isPrimary" = true;

  SELECT "id"
  INTO v_brand_id
  FROM public."Brand"
  WHERE "organizationId" = v_organization_id
    AND "slug" = 'faddebo'
  LIMIT 1
  FOR UPDATE;

  IF v_brand_id IS NULL THEN
    INSERT INTO public."Brand" (
      "id", "organizationId", "name", "slug", "legalDisplayName",
      "supportEmail", "privacyPolicyUrl", "termsUrl", "isPrimary",
      "status", "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid()::text,
      v_organization_id,
      'FaddeBo',
      'faddebo',
      'FaddeBo – ett varumärke inom Östgöta El Teknik AB, org.nr 559350-5620',
      'info@faddebo.se',
      '/integritetspolicy',
      '/allmanna-villkor',
      true,
      'ACTIVE',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
  ELSE
    UPDATE public."Brand"
    SET
      "name" = 'FaddeBo',
      "legalDisplayName" = 'FaddeBo – ett varumärke inom Östgöta El Teknik AB, org.nr 559350-5620',
      "supportEmail" = 'info@faddebo.se',
      "privacyPolicyUrl" = '/integritetspolicy',
      "termsUrl" = '/allmanna-villkor',
      "isPrimary" = true,
      "status" = 'ACTIVE',
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = v_brand_id;
  END IF;
END
$organization_and_brand$;

UPDATE public."Listing"
SET "contactEmail" = 'info@faddebo.se', "updatedAt" = CURRENT_TIMESTAMP
WHERE lower(COALESCE("contactEmail", '')) IN (
  ('info@' || 'ostgotaelteknik.se'),
  ('admin@' || 'ostgotaelteknik.se'),
  ('dataskydd@' || 'ostgotaelteknik.se')
);

-- ---------------------------------------------------------------------------
-- 3. System roles. Production db push does not run seed.sql, so roles required
--    by the owner dashboard must be installed by a migration.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _faddebo_role_seed (
  slug text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  permissions text[] NOT NULL
) ON COMMIT DROP;

INSERT INTO _faddebo_role_seed (slug, name, description, permissions) VALUES
  ('superadmin', 'Ägare / superadmin', 'Full ägarbehörighet i hela FaddeBo.', ARRAY['*']),
  ('org-admin', 'Bolagsadmin', 'Administrerar bolagets användare och samtliga verksamhetsflöden.', ARRAY[
    'persons:*','users:*','roles:*','properties:*','buildings:*','units:*','listings:*',
    'applications:*','viewings:*','offers:*','contracts:*','terminations:*','inspections:*',
    'invoices:*','payments:*','maintenance:*','workorders:*','suppliers:*','documents:*',
    'messages:*','notifications:*','integrations:*','webhooks:*','apikeys:*','imports:*',
    'reports:*','audit:read','settings:*'
  ]),
  ('property-owner', 'Fastighetsägare', 'Läs- och rapportbehörighet för fastighetsägare.', ARRAY[
    'properties:read','buildings:read','units:read','listings:read','contracts:read',
    'invoices:read','payments:read','reports:*','maintenance:read','workorders:read','audit:read'
  ]),
  ('property-manager', 'Fastighetsvärd / förvaltare', 'Operativ helhetsbehörighet för uthyrning och förvaltning.', ARRAY[
    'persons:*','properties:*','buildings:*','units:*','listings:*','applications:*',
    'viewings:*','offers:*','contracts:*','terminations:*','inspections:*','maintenance:*',
    'workorders:*','suppliers:*','documents:*','messages:*','invoices:read','payments:read',
    'imports:*','reports:read'
  ]),
  ('caretaker', 'Kvartersvärd', 'Boendeservice, felanmälningar och arbetsorder.', ARRAY[
    'properties:read','buildings:read','units:read','maintenance:*','workorders:*',
    'messages:*','persons:read','documents:read'
  ]),
  ('leasing-agent', 'Uthyrare', 'Annonser, ansökningar, visningar, erbjudanden och avtal.', ARRAY[
    'persons:*','units:read','units:update','listings:*','applications:*','viewings:*',
    'offers:*','contracts:*','documents:*','messages:*','reports:read'
  ]),
  ('sales-manager', 'Försäljningsansvarig', 'Försäljning och kommersiella objekt.', ARRAY[
    'persons:read','units:read','units:update','listings:*','viewings:*','offers:*',
    'contracts:*','documents:*','messages:*','reports:read'
  ]),
  ('finance', 'Ekonom', 'Fakturor, betalningar, integrationer och ekonomirapporter.', ARRAY[
    'persons:read','contracts:read','invoices:*','payments:*','integrations:*','reports:*','audit:read'
  ]),
  ('customer-service', 'Kundtjänst', 'Kundservice, ärenden, meddelanden och läsbehörighet.', ARRAY[
    'persons:read','persons:update','units:read','listings:read','applications:read',
    'applications:update','contracts:read','invoices:read','maintenance:*','messages:*','documents:read'
  ]),
  ('facility-worker', 'Fastighetsskötare', 'Utför och uppdaterar felanmälningar och arbetsorder.', ARRAY[
    'maintenance:read','maintenance:update','workorders:read','workorders:update','units:read'
  ]),
  ('inspector', 'Besiktningsman', 'Besiktningar och tillhörande dokument.', ARRAY[
    'inspections:*','units:read','contracts:read','documents:create','documents:read'
  ]),
  ('contractor', 'Entreprenör', 'Ser och uppdaterar endast leverantörens egna arbetsorder.', ARRAY[
    'workorders:read','workorders:update'
  ]),
  ('report-viewer', 'Rapportläsare', 'Läsbehörighet till rapporter.', ARRAY['reports:read']);

DO $install_roles$
DECLARE
  v_seed record;
  v_role_id text;
  v_permission text;
BEGIN
  FOR v_seed IN SELECT * FROM _faddebo_role_seed ORDER BY slug LOOP
    INSERT INTO public."Role" (
      "id", "organizationId", "name", "slug", "description",
      "isSystem", "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid()::text,
      NULL,
      v_seed.name,
      v_seed.slug,
      v_seed.description,
      true,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("slug") WHERE "organizationId" IS NULL
    DO UPDATE SET
      "name" = EXCLUDED."name",
      "description" = EXCLUDED."description",
      "isSystem" = true,
      "updatedAt" = CURRENT_TIMESTAMP;

    SELECT "id"
    INTO v_role_id
    FROM public."Role"
    WHERE "organizationId" IS NULL
      AND "slug" = v_seed.slug;

    FOREACH v_permission IN ARRAY v_seed.permissions LOOP
      INSERT INTO public."RolePermission" ("id", "roleId", "permission")
      VALUES (gen_random_uuid()::text, v_role_id, v_permission)
      ON CONFLICT ("roleId", "permission") DO NOTHING;
    END LOOP;
  END LOOP;
END
$install_roles$;

-- ---------------------------------------------------------------------------
-- 4. Remove legacy application triggers from auth.users.
--    A stale Bovaro/Fastighetsvärd trigger can make Supabase Dashboard show
--    "Failed to create user" before the canonical FaddeBo trigger runs.
--    Internal Supabase triggers are never touched; only user-defined triggers
--    backed by functions in the public schema are replaced.
-- ---------------------------------------------------------------------------
DO $drop_legacy_auth_user_triggers$
DECLARE
  v_trigger record;
BEGIN
  FOR v_trigger IN
    SELECT t.tgname
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace table_ns ON table_ns.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace function_ns ON function_ns.oid = p.pronamespace
    WHERE table_ns.nspname = 'auth'
      AND c.relname = 'users'
      AND NOT t.tgisinternal
      AND function_ns.nspname = 'public'
      AND t.tgname <> 'auth_user_verified_provision_profile'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON auth.users', v_trigger.tgname);
  END LOOP;
END
$drop_legacy_auth_user_triggers$;

-- ---------------------------------------------------------------------------
-- 5. Verified public self-signup
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.provision_verified_self_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $function$
DECLARE
  v_org_id text;
  v_person_id text := gen_random_uuid()::text;
  v_email text := lower(trim(COALESCE(NEW.email, '')));
  v_claim_mode text := lower(COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'claim_mode'), ''), 'self_signup'));
BEGIN
  IF NEW.email_confirmed_at IS NULL OR v_email = '' THEN
    RETURN NEW;
  END IF;

  -- Managed accounts are completed by a purpose-bound server operation.
  IF v_claim_mode IN ('invitation', 'staff_invitation', 'contractor_invitation', 'bootstrap') THEN
    UPDATE public."User"
    SET
      "email" = v_email,
      "emailVerifiedAt" = NEW.email_confirmed_at,
      "isActive" = true,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "authUserId" = NEW.id;
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public."User" WHERE "authUserId" = NEW.id) THEN
    UPDATE public."User"
    SET
      "email" = v_email,
      "emailVerifiedAt" = NEW.email_confirmed_at,
      "isActive" = true,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "authUserId" = NEW.id;
    RETURN NEW;
  END IF;

  SELECT "id"
  INTO v_org_id
  FROM public."Organization"
  WHERE "orgNumber" = '559350-5620'
  ORDER BY "createdAt", "id"
  LIMIT 1;

  IF v_org_id IS NULL THEN
    SELECT "id"
    INTO v_org_id
    FROM public."Organization"
    ORDER BY "createdAt", "id"
    LIMIT 1;
  END IF;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'default_organization_missing' USING ERRCODE = 'P0002';
  END IF;

  -- Never claim an imported person or a different application account only by
  -- matching e-mail. The Auth user remains valid and can later be linked by an
  -- explicit invitation or owner operation instead of making Auth user creation fail.
  IF EXISTS (
    SELECT 1 FROM public."User"
    WHERE lower("email") = v_email AND "authUserId" <> NEW.id
  ) OR EXISTS (
    SELECT 1 FROM public."Person"
    WHERE "organizationId" = v_org_id AND lower(COALESCE("email", '')) = v_email
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public."Person" (
    "id", "organizationId", "firstName", "lastName", "email", "phone",
    "country", "createdAt", "updatedAt"
  ) VALUES (
    v_person_id,
    v_org_id,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'first_name'), ''), 'Okänt'),
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'last_name'), ''), 'namn'),
    v_email,
    NULLIF(trim(NEW.raw_user_meta_data->>'phone'), ''),
    'SE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  );

  INSERT INTO public."PersonRole" ("id", "personId", "role", "createdAt")
  VALUES (gen_random_uuid()::text, v_person_id, 'APPLICANT', CURRENT_TIMESTAMP)
  ON CONFLICT ("personId", "role") DO NOTHING;

  INSERT INTO public."User" (
    "id", "authUserId", "organizationId", "personId", "email",
    "emailVerifiedAt", "isActive", "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid()::text,
    NEW.id,
    v_org_id,
    v_person_id,
    v_email,
    NEW.email_confirmed_at,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  );

  -- Notifications and audit are useful but must not block Auth provisioning if
  -- a legacy installation has drift in a non-identity table.
  BEGIN
    INSERT INTO public."Notification" (
      "id", "organizationId", "personId", "eventType", "title", "body", "createdAt"
    ) VALUES (
      gen_random_uuid()::text,
      v_org_id,
      v_person_id,
      'account_verified',
      'Kontot är verifierat',
      'Din e-postadress är verifierad och kontot är nu aktivt.',
      CURRENT_TIMESTAMP
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'account notification skipped: %', SQLERRM;
  END;

  BEGIN
    INSERT INTO public."AuditEvent" (
      "id", "organizationId", "actorType", "actorId", "action",
      "entityType", "entityId", "after", "createdAt"
    ) VALUES (
      gen_random_uuid()::text,
      v_org_id,
      'auth_user',
      NEW.id::text,
      'verified_self_signup_provisioned',
      'user',
      NEW.id::text,
      jsonb_build_object('personId', v_person_id, 'emailVerifiedAt', NEW.email_confirmed_at),
      CURRENT_TIMESTAMP
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'account audit skipped: %', SQLERRM;
  END;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS "auth_user_verified_provision_profile" ON auth.users;
CREATE TRIGGER "auth_user_verified_provision_profile"
AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.provision_verified_self_signup();

-- ---------------------------------------------------------------------------
-- 6. Managed staff/admin provisioning used by Admin -> Användare & roller
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.provision_staff_user(
  p_auth_user_id uuid,
  p_organization_id text,
  p_email text,
  p_first_name text,
  p_last_name text,
  p_role_id text,
  p_actor_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $function$
DECLARE
  v_auth auth.users%ROWTYPE;
  v_role public."Role"%ROWTYPE;
  v_person_id text := gen_random_uuid()::text;
  v_user_id text := gen_random_uuid()::text;
  v_email text := lower(trim(COALESCE(p_email, '')));
  v_actor_is_superadmin boolean := false;
  v_actor_can_create_users boolean := false;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required';
  END IF;
  IF v_email = '' OR position('@' IN v_email) = 0 THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;
  IF NULLIF(trim(p_first_name), '') IS NULL OR NULLIF(trim(p_last_name), '') IS NULL THEN
    RAISE EXCEPTION 'name_required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public."User" u
    WHERE u."id" = p_actor_user_id
      AND u."organizationId" = p_organization_id
      AND u."isActive" = true
  ) THEN
    RAISE EXCEPTION 'actor_not_found';
  END IF;

  SELECT
    COALESCE(bool_or(r."slug" = 'superadmin'), false),
    COALESCE(bool_or(rp."permission" IN ('*', 'users:*', 'users:create')), false)
  INTO v_actor_is_superadmin, v_actor_can_create_users
  FROM public."UserRole" ur
  JOIN public."Role" r ON r."id" = ur."roleId"
  LEFT JOIN public."RolePermission" rp ON rp."roleId" = r."id"
  WHERE ur."userId" = p_actor_user_id;

  IF NOT v_actor_can_create_users THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  SELECT *
  INTO v_auth
  FROM auth.users
  WHERE id = p_auth_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_auth.email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'verified_auth_user_not_found';
  END IF;
  IF lower(COALESCE(v_auth.email, '')) <> v_email THEN
    RAISE EXCEPTION 'auth_email_mismatch';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public."User"
    WHERE "authUserId" = p_auth_user_id OR lower("email") = v_email
  ) THEN
    RAISE EXCEPTION 'user_already_exists';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public."Person"
    WHERE "organizationId" = p_organization_id
      AND lower(COALESCE("email", '')) = v_email
  ) THEN
    RAISE EXCEPTION 'person_already_exists';
  END IF;

  SELECT *
  INTO v_role
  FROM public."Role"
  WHERE "id" = p_role_id
    AND ("organizationId" = p_organization_id OR "organizationId" IS NULL)
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'role_not_found';
  END IF;
  IF v_role."slug" IN ('superadmin', 'org-admin') AND NOT v_actor_is_superadmin THEN
    RAISE EXCEPTION 'privileged_role_assignment_denied';
  END IF;

  INSERT INTO public."Person" (
    "id", "organizationId", "firstName", "lastName", "email",
    "country", "createdAt", "updatedAt"
  ) VALUES (
    v_person_id,
    p_organization_id,
    trim(p_first_name),
    trim(p_last_name),
    v_email,
    'SE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  );

  INSERT INTO public."User" (
    "id", "authUserId", "organizationId", "personId", "email",
    "emailVerifiedAt", "isActive", "createdAt", "updatedAt"
  ) VALUES (
    v_user_id,
    p_auth_user_id,
    p_organization_id,
    v_person_id,
    v_email,
    v_auth.email_confirmed_at,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  );

  INSERT INTO public."UserRole" (
    "id", "userId", "roleId", "propertyId", "createdAt"
  ) VALUES (
    gen_random_uuid()::text,
    v_user_id,
    v_role."id",
    NULL,
    CURRENT_TIMESTAMP
  );

  BEGIN
    INSERT INTO public."AuditEvent" (
      "id", "organizationId", "userId", "actorType", "actorId", "action",
      "entityType", "entityId", "after", "createdAt"
    ) VALUES (
      gen_random_uuid()::text,
      p_organization_id,
      p_actor_user_id,
      'user',
      p_actor_user_id,
      'create',
      'user',
      v_user_id,
      jsonb_build_object('email', v_email, 'role', v_role."slug"),
      CURRENT_TIMESTAMP
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'staff audit skipped: %', SQLERRM;
  END;

  RETURN jsonb_build_object(
    'userId', v_user_id,
    'personId', v_person_id,
    'roleSlug', v_role."slug",
    'roleName', v_role."name"
  );
END
$function$;

REVOKE ALL ON FUNCTION public.provision_staff_user(
  uuid, text, text, text, text, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_staff_user(
  uuid, text, text, text, text, text, text
) TO service_role;

-- ---------------------------------------------------------------------------
-- 7. Canonical first/additional owner promotion
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bootstrap_faddebo_owner(
  p_email text,
  p_first_name text DEFAULT 'System',
  p_last_name text DEFAULT 'Ägare'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $function$
DECLARE
  v_email text := lower(trim(COALESCE(p_email, '')));
  v_first_name text := COALESCE(NULLIF(trim(p_first_name), ''), 'System');
  v_last_name text := COALESCE(NULLIF(trim(p_last_name), ''), 'Ägare');
  v_auth_user_id uuid;
  v_email_confirmed_at timestamptz;
  v_organization_id text;
  v_brand_id text;
  v_user_id text;
  v_person_id text;
  v_role_id text;
  v_candidate_count integer;
BEGIN
  IF v_email = '' OR position('@' IN v_email) = 0 THEN
    RAISE EXCEPTION 'invalid_owner_email';
  END IF;

  SELECT id, email_confirmed_at
  INTO v_auth_user_id, v_email_confirmed_at
  FROM auth.users
  WHERE lower(email) = v_email
  ORDER BY created_at, id
  LIMIT 1
  FOR UPDATE;

  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_user_not_found';
  END IF;
  IF v_email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'auth_email_not_confirmed';
  END IF;

  SELECT "id"
  INTO v_organization_id
  FROM public."Organization"
  WHERE "orgNumber" = '559350-5620'
  ORDER BY "createdAt", "id"
  LIMIT 1
  FOR UPDATE;

  IF v_organization_id IS NULL THEN
    SELECT "id"
    INTO v_organization_id
    FROM public."Organization"
    ORDER BY "createdAt", "id"
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'default_organization_missing';
  END IF;

  UPDATE public."Organization"
  SET
    "email" = 'info@faddebo.se',
    "dataProtectionEmail" = 'info@faddebo.se',
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = v_organization_id;

  SELECT "id"
  INTO v_brand_id
  FROM public."Brand"
  WHERE "organizationId" = v_organization_id
    AND "slug" = 'faddebo'
  LIMIT 1;

  IF v_brand_id IS NULL THEN
    RAISE EXCEPTION 'faddebo_brand_missing';
  END IF;

  SELECT count(*)
  INTO v_candidate_count
  FROM public."User"
  WHERE "authUserId" = v_auth_user_id OR lower("email") = v_email;

  IF v_candidate_count > 1 THEN
    RAISE EXCEPTION 'duplicate_owner_profiles';
  END IF;

  SELECT "id", "personId"
  INTO v_user_id, v_person_id
  FROM public."User"
  WHERE "authUserId" = v_auth_user_id OR lower("email") = v_email
  ORDER BY CASE WHEN "authUserId" = v_auth_user_id THEN 0 ELSE 1 END, "createdAt", "id"
  LIMIT 1
  FOR UPDATE;

  IF v_person_id IS NULL THEN
    SELECT "id"
    INTO v_person_id
    FROM public."Person"
    WHERE "organizationId" = v_organization_id
      AND lower(COALESCE("email", '')) = v_email
    ORDER BY "createdAt", "id"
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_person_id IS NULL THEN
    v_person_id := gen_random_uuid()::text;
    INSERT INTO public."Person" (
      "id", "organizationId", "firstName", "lastName", "email",
      "country", "createdAt", "updatedAt"
    ) VALUES (
      v_person_id,
      v_organization_id,
      v_first_name,
      v_last_name,
      v_email,
      'SE',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
  ELSE
    UPDATE public."Person"
    SET
      "organizationId" = v_organization_id,
      "firstName" = v_first_name,
      "lastName" = v_last_name,
      "email" = v_email,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = v_person_id;
  END IF;

  DELETE FROM public."PersonRole"
  WHERE "personId" = v_person_id
    AND "role" = 'APPLICANT';

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid()::text;
    INSERT INTO public."User" (
      "id", "authUserId", "organizationId", "personId", "email",
      "emailVerifiedAt", "isActive", "createdAt", "updatedAt"
    ) VALUES (
      v_user_id,
      v_auth_user_id,
      v_organization_id,
      v_person_id,
      v_email,
      v_email_confirmed_at,
      true,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
  ELSE
    UPDATE public."User"
    SET
      "authUserId" = v_auth_user_id,
      "organizationId" = v_organization_id,
      "personId" = v_person_id,
      "email" = v_email,
      "emailVerifiedAt" = v_email_confirmed_at,
      "isActive" = true,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = v_user_id;
  END IF;

  SELECT "id"
  INTO v_role_id
  FROM public."Role"
  WHERE "organizationId" IS NULL
    AND "slug" = 'superadmin'
  LIMIT 1;

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'superadmin_role_missing';
  END IF;

  INSERT INTO public."RolePermission" ("id", "roleId", "permission")
  VALUES (gen_random_uuid()::text, v_role_id, '*')
  ON CONFLICT ("roleId", "permission") DO NOTHING;

  INSERT INTO public."UserRole" (
    "id", "userId", "roleId", "propertyId", "createdAt"
  )
  SELECT
    gen_random_uuid()::text,
    v_user_id,
    v_role_id,
    NULL,
    CURRENT_TIMESTAMP
  WHERE NOT EXISTS (
    SELECT 1
    FROM public."UserRole"
    WHERE "userId" = v_user_id
      AND "roleId" = v_role_id
      AND "propertyId" IS NULL
  );

  BEGIN
    INSERT INTO public."AuditEvent" (
      "id", "organizationId", "userId", "actorType", "actorId", "action",
      "entityType", "entityId", "after", "createdAt"
    ) VALUES (
      gen_random_uuid()::text,
      v_organization_id,
      v_user_id,
      'system',
      'owner-bootstrap',
      'owner_promoted',
      'user',
      v_user_id,
      jsonb_build_object('email', v_email, 'role', 'superadmin'),
      CURRENT_TIMESTAMP
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'owner audit skipped: %', SQLERRM;
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'email', v_email,
    'authUserId', v_auth_user_id,
    'userId', v_user_id,
    'personId', v_person_id,
    'organizationId', v_organization_id,
    'role', 'superadmin'
  );
END
$function$;

REVOKE ALL ON FUNCTION public.bootstrap_faddebo_owner(text, text, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_faddebo_owner(text, text, text)
TO service_role;

COMMIT;
