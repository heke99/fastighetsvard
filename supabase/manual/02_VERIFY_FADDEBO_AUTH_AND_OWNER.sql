-- =============================================================================
-- VERIFIERA FADDEBOS KONTO-, OWNER- OCH ADMINFLÖDE
-- Ändra owner-e-post i den sista CTE:n om du använder en annan adress.
-- =============================================================================

WITH checks AS (
  SELECT
    'legacy_password_hash_nullable'::text AS check_name,
    CASE
      WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'User'
          AND column_name = 'passwordHash'
      ) THEN 'PASS_NOT_PRESENT'
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'User'
          AND column_name = 'passwordHash' AND is_nullable = 'YES'
      ) THEN 'PASS_NULLABLE'
      ELSE 'FAIL_NOT_NULL'
    END AS status

  UNION ALL

  SELECT
    'identity_timestamp_defaults',
    CASE WHEN NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('Organization', 'Person', 'User', 'Role')
        AND column_name IN ('createdAt', 'updatedAt')
        AND column_default IS NULL
    ) THEN 'PASS' ELSE 'FAIL' END

  UNION ALL

  SELECT
    'verified_signup_trigger',
    CASE WHEN EXISTS (
      SELECT 1
      FROM information_schema.triggers
      WHERE event_object_schema = 'auth'
        AND event_object_table = 'users'
        AND trigger_name = 'auth_user_verified_provision_profile'
    ) THEN 'PASS' ELSE 'FAIL' END

  UNION ALL

  SELECT
    'no_legacy_auth_user_triggers',
    CASE WHEN NOT EXISTS (
      SELECT 1
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
    ) THEN 'PASS' ELSE 'FAIL_LEGACY_TRIGGER' END

  UNION ALL

  SELECT
    'owner_bootstrap_function',
    CASE WHEN to_regprocedure('public.bootstrap_faddebo_owner(text,text,text)') IS NOT NULL
      THEN 'PASS' ELSE 'FAIL' END

  UNION ALL

  SELECT
    'required_system_roles',
    CASE WHEN (
      SELECT count(*)
      FROM public."Role"
      WHERE "organizationId" IS NULL
        AND "slug" IN ('superadmin', 'org-admin', 'property-manager', 'contractor')
    ) = 4 THEN 'PASS' ELSE 'FAIL' END

  UNION ALL

  SELECT
    'canonical_contact_addresses',
    CASE WHEN EXISTS (
      SELECT 1 FROM public."Organization"
      WHERE "orgNumber" = '559350-5620'
        AND lower("email") = 'info@faddebo.se'
        AND lower("dataProtectionEmail") = 'info@faddebo.se'
    ) AND EXISTS (
      SELECT 1 FROM public."Brand"
      WHERE "slug" = 'faddebo'
        AND lower("supportEmail") = 'info@faddebo.se'
    ) THEN 'PASS' ELSE 'FAIL' END

  UNION ALL

  SELECT
    'owner_access',
    CASE WHEN EXISTS (
      SELECT 1
      FROM auth.users au
      JOIN public."User" u ON u."authUserId" = au.id AND u."isActive" = true
      JOIN public."UserRole" ur ON ur."userId" = u."id"
      JOIN public."Role" r ON r."id" = ur."roleId" AND r."slug" = 'superadmin'
      JOIN public."RolePermission" rp ON rp."roleId" = r."id" AND rp."permission" = '*'
      WHERE lower(au.email) = lower('info@faddebo.se')
        AND au.email_confirmed_at IS NOT NULL
    ) THEN 'PASS' ELSE 'FAIL' END
)
SELECT * FROM checks ORDER BY check_name;

-- Visar alla ägare och deras status.
SELECT
  au.email,
  au.email_confirmed_at,
  u."isActive",
  p."firstName",
  p."lastName",
  o."name" AS organization_name,
  r."name" AS role_name,
  rp."permission"
FROM auth.users au
JOIN public."User" u ON u."authUserId" = au.id
LEFT JOIN public."Person" p ON p."id" = u."personId"
LEFT JOIN public."Organization" o ON o."id" = u."organizationId"
JOIN public."UserRole" ur ON ur."userId" = u."id"
JOIN public."Role" r ON r."id" = ur."roleId" AND r."slug" = 'superadmin'
JOIN public."RolePermission" rp ON rp."roleId" = r."id" AND rp."permission" = '*'
ORDER BY lower(au.email);
