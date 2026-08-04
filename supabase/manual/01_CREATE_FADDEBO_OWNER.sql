-- =============================================================================
-- SKAPA ELLER REPARERA FADDEBOS ÄGARKONTO
-- =============================================================================
-- 1. Kör först 00_REPAIR_FADDEBO_AUTH_SCHEMA.sql i SQL Editor.
-- 2. Skapa ett vanligt konto på https://faddebo.se/skapa-konto och bekräfta
--    e-postadressen. Du kan även använda Authentication -> Users -> Add user
--    efter att fil 00 har körts, med Auto Confirm User aktiverat.
-- 3. Ändra ENDAST värdena i INSERT-raden nedan.
-- 4. Kör hela filen. Samma fil kan köras igen för fler ägare.
-- =============================================================================

BEGIN;
SET LOCAL search_path = public, auth, extensions, pg_temp;

DO $preflight$
BEGIN
  IF to_regprocedure('public.bootstrap_faddebo_owner(text,text,text)') IS NULL THEN
    RAISE EXCEPTION
      'Kör först supabase/manual/00_REPAIR_FADDEBO_AUTH_SCHEMA.sql.';
  END IF;
END
$preflight$;

CREATE TEMP TABLE _faddebo_owner_input (
  email text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL
) ON COMMIT DROP;

-- ÄNDRA ENDAST DESSA TRE VÄRDEN:
INSERT INTO _faddebo_owner_input (email, first_name, last_name)
VALUES ('info@faddebo.se', 'Fadi', 'El-Hessi');

SELECT public.bootstrap_faddebo_owner(email, first_name, last_name) AS owner_result
FROM _faddebo_owner_input;

-- Verifiering: ska visa superadmin och permission = *.
SELECT
  au.email,
  au.email_confirmed_at,
  u."isActive" AS app_user_active,
  p."firstName",
  p."lastName",
  o."email" AS organization_email,
  r."slug" AS role_slug,
  rp."permission"
FROM _faddebo_owner_input input
JOIN auth.users au ON lower(au.email) = lower(input.email)
JOIN public."User" u ON u."authUserId" = au.id
LEFT JOIN public."Person" p ON p."id" = u."personId"
LEFT JOIN public."Organization" o ON o."id" = u."organizationId"
LEFT JOIN public."UserRole" ur ON ur."userId" = u."id"
LEFT JOIN public."Role" r ON r."id" = ur."roleId"
LEFT JOIN public."RolePermission" rp ON rp."roleId" = r."id"
ORDER BY r."slug", rp."permission";

COMMIT;
