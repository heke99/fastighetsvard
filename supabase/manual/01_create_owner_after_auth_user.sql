-- MANUELL RESERVVÄG FÖR FADDEBO-ÄGARKONTO
-- 1. Skapa först användaren i Supabase Dashboard:
--    Authentication -> Users -> Add user -> markera Auto Confirm User.
-- 2. Ändra de tre värdena nedan.
-- 3. Kör hela filen i Supabase SQL Editor.
--
-- Filen skapar INTE något lösenord och skriver inte direkt till auth.users.
-- Den kopplar den redan skapade Auth-användaren till FaddeBos app-profil
-- och tilldelar den globala rollen superadmin med behörigheten *.

DO $owner$
DECLARE
  v_email text := lower(trim('BYT_TILL_DIN_EPOST@EXEMPEL.SE'));
  v_first_name text := 'BYT_TILL_FÖRNAMN';
  v_last_name text := 'BYT_TILL_EFTERNAMN';

  v_now timestamp(3) := CURRENT_TIMESTAMP;
  v_auth_id uuid;
  v_email_confirmed_at timestamptz;
  v_org_id text;
  v_person_id text;
  v_user_id text;
  v_role_id text;
BEGIN
  IF v_email LIKE 'byt_till_%' OR position('@' IN v_email) = 0 THEN
    RAISE EXCEPTION 'Ändra v_email, v_first_name och v_last_name innan SQL-filen körs.';
  END IF;

  SELECT au.id, au.email_confirmed_at
    INTO v_auth_id, v_email_confirmed_at
  FROM auth.users au
  WHERE lower(au.email) = v_email
  ORDER BY au.created_at DESC
  LIMIT 1;

  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'Ingen Auth-användare hittades för %. Skapa den först under Authentication -> Users.', v_email;
  END IF;

  IF v_email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'Auth-användaren % är inte e-postbekräftad. Bekräfta användaren först.', v_email;
  END IF;

  SELECT o."id"
    INTO v_org_id
  FROM public."Organization" o
  WHERE o."orgNumber" = '559350-5620'
     OR o."legalName" = 'Östgöta El Teknik AB'
  ORDER BY o."createdAt", o."id"
  LIMIT 1;

  IF v_org_id IS NULL THEN
    v_org_id := gen_random_uuid()::text;
    INSERT INTO public."Organization" (
      "id", "name", "legalName", "orgNumber", "email",
      "dataProtectionEmail", "createdAt", "updatedAt"
    ) VALUES (
      v_org_id, 'Östgöta El Teknik', 'Östgöta El Teknik AB', '559350-5620',
      'info@faddebo.se', 'info@faddebo.se', v_now, v_now
    );
  ELSE
    UPDATE public."Organization"
    SET "name" = 'Östgöta El Teknik',
        "legalName" = 'Östgöta El Teknik AB',
        "orgNumber" = '559350-5620',
        "email" = 'info@faddebo.se',
        "dataProtectionEmail" = 'info@faddebo.se',
        "updatedAt" = v_now
    WHERE "id" = v_org_id;
  END IF;

  UPDATE public."Brand"
  SET "isPrimary" = false,
      "updatedAt" = v_now
  WHERE "organizationId" = v_org_id
    AND "slug" <> 'faddebo'
    AND "isPrimary" = true;

  INSERT INTO public."Brand" (
    "id", "organizationId", "name", "slug", "legalDisplayName",
    "supportEmail", "privacyPolicyUrl", "termsUrl", "isPrimary", "status",
    "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid()::text, v_org_id, 'FaddeBo', 'faddebo',
    'FaddeBo – ett varumärke inom Östgöta El Teknik AB, org.nr 559350-5620',
    'info@faddebo.se', '/integritetspolicy', '/allmanna-villkor', true, 'ACTIVE',
    v_now, v_now
  )
  ON CONFLICT ("organizationId", "slug") DO UPDATE SET
    "name" = EXCLUDED."name",
    "legalDisplayName" = EXCLUDED."legalDisplayName",
    "supportEmail" = EXCLUDED."supportEmail",
    "privacyPolicyUrl" = EXCLUDED."privacyPolicyUrl",
    "termsUrl" = EXCLUDED."termsUrl",
    "isPrimary" = true,
    "status" = 'ACTIVE',
    "updatedAt" = v_now;

  -- Återanvänd en profil som auth-triggern kan ha skapat när Dashboard-användaren bekräftades.
  SELECT u."id", u."personId"
    INTO v_user_id, v_person_id
  FROM public."User" u
  WHERE u."authUserId" = v_auth_id
     OR lower(u."email") = v_email
  ORDER BY (u."authUserId" = v_auth_id) DESC, u."createdAt"
  LIMIT 1;

  IF v_person_id IS NULL THEN
    SELECT p."id"
      INTO v_person_id
    FROM public."Person" p
    WHERE p."organizationId" = v_org_id
      AND lower(p."email") = v_email
    ORDER BY p."createdAt"
    LIMIT 1;
  END IF;

  IF v_person_id IS NULL THEN
    v_person_id := gen_random_uuid()::text;
    INSERT INTO public."Person" (
      "id", "organizationId", "firstName", "lastName", "email", "country",
      "createdAt", "updatedAt"
    ) VALUES (
      v_person_id, v_org_id, v_first_name, v_last_name, v_email, 'SE', v_now, v_now
    );
  ELSE
    UPDATE public."Person"
    SET "organizationId" = v_org_id,
        "firstName" = v_first_name,
        "lastName" = v_last_name,
        "email" = v_email,
        "country" = COALESCE("country", 'SE'),
        "updatedAt" = v_now
    WHERE "id" = v_person_id;
  END IF;

  -- Ett ägarkonto ska inte ligga kvar som publik bostadssökande efter manuell uppgradering.
  DELETE FROM public."PersonRole"
  WHERE "personId" = v_person_id
    AND "role" = 'APPLICANT';

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid()::text;
    INSERT INTO public."User" (
      "id", "authUserId", "organizationId", "personId", "email",
      "emailVerifiedAt", "isActive", "createdAt", "updatedAt"
    ) VALUES (
      v_user_id, v_auth_id, v_org_id, v_person_id, v_email,
      v_email_confirmed_at, true, v_now, v_now
    );
  ELSE
    UPDATE public."User"
    SET "authUserId" = v_auth_id,
        "organizationId" = v_org_id,
        "personId" = v_person_id,
        "email" = v_email,
        "emailVerifiedAt" = v_email_confirmed_at,
        "isActive" = true,
        "updatedAt" = v_now
    WHERE "id" = v_user_id;
  END IF;

  SELECT r."id"
    INTO v_role_id
  FROM public."Role" r
  WHERE r."organizationId" IS NULL
    AND r."slug" = 'superadmin'
  LIMIT 1;

  IF v_role_id IS NULL THEN
    v_role_id := gen_random_uuid()::text;
    INSERT INTO public."Role" (
      "id", "organizationId", "name", "slug", "description", "isSystem",
      "createdAt", "updatedAt"
    ) VALUES (
      v_role_id, NULL, 'Ägare / superadmin', 'superadmin',
      'Fullständig systembehörighet för FaddeBos ägare.', true, v_now, v_now
    );
  ELSE
    UPDATE public."Role"
    SET "name" = 'Ägare / superadmin',
        "isSystem" = true,
        "updatedAt" = v_now
    WHERE "id" = v_role_id;
  END IF;

  INSERT INTO public."RolePermission" ("id", "roleId", "permission")
  VALUES (gen_random_uuid()::text, v_role_id, '*')
  ON CONFLICT ("roleId", "permission") DO NOTHING;

  INSERT INTO public."UserRole" (
    "id", "userId", "roleId", "propertyId", "createdAt"
  ) VALUES (
    gen_random_uuid()::text, v_user_id, v_role_id, NULL, v_now
  )
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'FaddeBo owner skapad/uppdaterad: %, auth-id: %, app-user-id: %',
    v_email, v_auth_id, v_user_id;
END
$owner$;

-- Verifiering: visar samtliga aktiva ägarkonton.
SELECT
  u."email",
  u."isActive",
  r."slug" AS role_slug,
  rp."permission"
FROM public."User" u
JOIN public."UserRole" ur ON ur."userId" = u."id"
JOIN public."Role" r ON r."id" = ur."roleId"
LEFT JOIN public."RolePermission" rp ON rp."roleId" = r."id"
WHERE r."organizationId" IS NULL
  AND r."slug" = 'superadmin'
ORDER BY u."email";
