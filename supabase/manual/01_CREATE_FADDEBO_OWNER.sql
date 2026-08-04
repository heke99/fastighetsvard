-- =============================================================================
-- STEG 2 AV 2: SKAPA ELLER REPARERA FADDEBO-ÄGAREN
-- =============================================================================
-- FÖRST:
-- 1. Kör 00_REPAIR_FADDEBO_AUTH_SCHEMA.sql i SQL Editor.
-- 2. Gå till Authentication -> Users -> Add user.
-- 3. Skapa användaren med samma e-post som v_owner_email nedan.
-- 4. Ange lösenord och välj "Auto Confirm User".
-- 5. Ändra v_owner_email, v_owner_first_name och v_owner_last_name nedan.
-- 6. Kör hela denna fil i SQL Editor.
--
-- Filen kräver inte `supabase link` och kan köras igen för fler ägare genom
-- att du skapar en ny Auth-användare och ändrar v_owner_*-värdena.
-- =============================================================================

BEGIN;
SET LOCAL search_path = public, auth, extensions, pg_temp;

DO $preflight$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'User'
      AND column_name = 'passwordHash'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'Kör först supabase/manual/00_REPAIR_FADDEBO_AUTH_SCHEMA.sql.';
  END IF;
END
$preflight$;

DO $create_owner$
DECLARE
  -- ÄNDRA DESSA FYRA VÄRDEN:
  v_owner_email text := lower(trim('info@faddebo.se'));
  v_owner_first_name text := 'Fadi';
  v_owner_last_name text := 'El-Hessi';
  v_expected_org_number text := '559350-5620';

  v_auth_user_id uuid;
  v_email_confirmed_at timestamptz;
  v_organization_id text;
  v_person_id text;
  v_user_id text;
  v_role_id text;
  v_brand_id text;
BEGIN
  IF v_owner_email = '' OR position('@' IN v_owner_email) = 0 THEN
    RAISE EXCEPTION 'Ogiltig v_owner_email.';
  END IF;

  SELECT id, email_confirmed_at
  INTO v_auth_user_id, v_email_confirmed_at
  FROM auth.users
  WHERE lower(email) = v_owner_email
  ORDER BY created_at
  LIMIT 1;

  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION
      'Auth-användaren % finns inte. Skapa den först under Authentication -> Users -> Add user och välj Auto Confirm User.',
      v_owner_email;
  END IF;

  IF v_email_confirmed_at IS NULL THEN
    RAISE EXCEPTION
      'Auth-användaren % är inte bekräftad. Bekräfta användaren i Authentication innan SQL-filen körs igen.',
      v_owner_email;
  END IF;

  SELECT "id"
  INTO v_organization_id
  FROM public."Organization"
  WHERE "orgNumber" = v_expected_org_number
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
      v_expected_org_number,
      'info@faddebo.se',
      'info@faddebo.se',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
  ELSE
    UPDATE public."Organization"
    SET
      "name" = COALESCE(NULLIF("name", ''), 'Östgöta El Teknik'),
      "legalName" = COALESCE(NULLIF("legalName", ''), 'Östgöta El Teknik AB'),
      "orgNumber" = COALESCE(NULLIF("orgNumber", ''), v_expected_org_number),
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
    v_brand_id := gen_random_uuid()::text;
    INSERT INTO public."Brand" (
      "id", "organizationId", "name", "slug", "legalDisplayName",
      "supportEmail", "privacyPolicyUrl", "termsUrl", "isPrimary",
      "status", "createdAt", "updatedAt"
    ) VALUES (
      v_brand_id,
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
      "supportEmail" = 'info@faddebo.se',
      "isPrimary" = true,
      "status" = 'ACTIVE',
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = v_brand_id;
  END IF;

  SELECT "id", "personId"
  INTO v_user_id, v_person_id
  FROM public."User"
  WHERE "authUserId" = v_auth_user_id
     OR lower("email") = v_owner_email
  ORDER BY CASE WHEN "authUserId" = v_auth_user_id THEN 0 ELSE 1 END, "createdAt"
  LIMIT 1
  FOR UPDATE;

  IF v_person_id IS NULL THEN
    SELECT "id"
    INTO v_person_id
    FROM public."Person"
    WHERE "organizationId" = v_organization_id
      AND lower(COALESCE("email", '')) = v_owner_email
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
      trim(v_owner_first_name),
      trim(v_owner_last_name),
      v_owner_email,
      'SE',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
  ELSE
    UPDATE public."Person"
    SET
      "organizationId" = v_organization_id,
      "firstName" = trim(v_owner_first_name),
      "lastName" = trim(v_owner_last_name),
      "email" = v_owner_email,
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
      v_owner_email,
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
      "email" = v_owner_email,
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
  ORDER BY "createdAt", "id"
  LIMIT 1
  FOR UPDATE;

  IF v_role_id IS NULL THEN
    v_role_id := gen_random_uuid()::text;
    INSERT INTO public."Role" (
      "id", "organizationId", "name", "slug", "description",
      "isSystem", "createdAt", "updatedAt"
    ) VALUES (
      v_role_id,
      NULL,
      'Ägare / superadmin',
      'superadmin',
      'Full ägarbehörighet i hela FaddeBo.',
      true,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
  ELSE
    UPDATE public."Role"
    SET
      "name" = 'Ägare / superadmin',
      "isSystem" = true,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = v_role_id;
  END IF;

  INSERT INTO public."RolePermission" ("id", "roleId", "permission")
  SELECT gen_random_uuid()::text, v_role_id, '*'
  WHERE NOT EXISTS (
    SELECT 1
    FROM public."RolePermission"
    WHERE "roleId" = v_role_id
      AND "permission" = '*'
  );

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

  RAISE NOTICE 'FaddeBo owner skapad/reparerad: % (auth id %, app user id %)',
    v_owner_email, v_auth_user_id, v_user_id;
END
$create_owner$;

-- Canonical kontaktuppgifter i databasens publika innehåll.
UPDATE public."Organization"
SET
  "email" = 'info@faddebo.se',
  "dataProtectionEmail" = 'info@faddebo.se',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "orgNumber" = '559350-5620'
   OR "legalName" = 'Östgöta El Teknik AB';

UPDATE public."Brand"
SET
  "supportEmail" = 'info@faddebo.se',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'faddebo';

UPDATE public."Listing"
SET
  "contactEmail" = 'info@faddebo.se',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE lower(COALESCE("contactEmail", '')) IN (
  ('info@' || 'ostgotaelteknik.se'),
  ('admin@' || 'ostgotaelteknik.se'),
  ('dataskydd@' || 'ostgotaelteknik.se')
);

COMMIT;

-- VERIFIERING: raden ska visa role_slug=superadmin och permission=*.
SELECT
  au.email,
  au.email_confirmed_at,
  u."isActive" AS app_user_active,
  o."name" AS organization_name,
  o."email" AS organization_email,
  r."slug" AS role_slug,
  rp."permission"
FROM auth.users au
JOIN public."User" u ON u."authUserId" = au.id
LEFT JOIN public."Organization" o ON o."id" = u."organizationId"
LEFT JOIN public."UserRole" ur ON ur."userId" = u."id"
LEFT JOIN public."Role" r ON r."id" = ur."roleId"
LEFT JOIN public."RolePermission" rp ON rp."roleId" = r."id"
WHERE r."slug" = 'superadmin'
ORDER BY lower(au.email), rp."permission";
