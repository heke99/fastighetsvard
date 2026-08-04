-- Kör efter 03_APPLY_FADDEBO_AUTH_SMTP_LOGIN_HARDENING.sql.
-- Alla rader ska visa PASS eller ett förväntat informationsvärde.

WITH checks AS (
  SELECT
    'required_tables' AS check_name,
    CASE WHEN
      to_regclass('public."Organization"') IS NOT NULL AND
      to_regclass('public."User"') IS NOT NULL AND
      to_regclass('public."Role"') IS NOT NULL
    THEN 'PASS' ELSE 'FAIL' END AS result
  UNION ALL
  SELECT
    'verified_signup_trigger',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'auth_user_verified_provision_profile' AND NOT tgisinternal
    ) THEN 'PASS' ELSE 'FAIL' END
  UNION ALL
  SELECT
    'reconcile_rpc',
    CASE WHEN to_regprocedure('public.reconcile_verified_auth_user(uuid)') IS NOT NULL
      THEN 'PASS' ELSE 'FAIL' END
  UNION ALL
  SELECT
    'staff_provisioning_rpc',
    CASE WHEN to_regprocedure('public.provision_staff_user(uuid,text,text,text,text,text,text)') IS NOT NULL
      THEN 'PASS' ELSE 'FAIL' END
  UNION ALL
  SELECT
    'supplier_provisioning_rpc',
    CASE WHEN to_regprocedure('public.provision_supplier(text,text,text,text,text,text,text,uuid,text)') IS NOT NULL
      THEN 'PASS' ELSE 'FAIL' END
  UNION ALL
  SELECT
    'legacy_password_hash_nullable',
    CASE
      WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'passwordHash'
      ) THEN 'PASS_NOT_PRESENT'
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'User'
          AND column_name = 'passwordHash' AND is_nullable = 'YES'
      ) THEN 'PASS'
      ELSE 'FAIL'
    END
  UNION ALL
  SELECT
    'organization_timestamp_defaults',
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Organization'
        AND column_name IN ('createdAt', 'updatedAt')
        AND column_default IS NULL
    ) THEN 'PASS' ELSE 'FAIL' END
  UNION ALL
  SELECT
    'user_timestamp_defaults',
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'User'
        AND column_name IN ('createdAt', 'updatedAt')
        AND column_default IS NULL
    ) THEN 'PASS' ELSE 'FAIL' END
  UNION ALL
  SELECT
    'canonical_contact_email',
    CASE WHEN EXISTS (
      SELECT 1 FROM public."Organization"
      WHERE lower(coalesce("email", '')) = 'info@faddebo.se'
    ) THEN 'PASS' ELSE 'FAIL' END
)
SELECT * FROM checks ORDER BY check_name;

-- Visar om ägarkontot är komplett. Byt e-post vid behov.
SELECT
  au.email AS auth_email,
  au.email_confirmed_at,
  u."id" AS app_user_id,
  u."isActive" AS app_user_active,
  r."slug" AS role_slug,
  rp."permission"
FROM auth.users au
LEFT JOIN public."User" u ON u."authUserId" = au.id
LEFT JOIN public."UserRole" ur ON ur."userId" = u."id"
LEFT JOIN public."Role" r ON r."id" = ur."roleId"
LEFT JOIN public."RolePermission" rp ON rp."roleId" = r."id"
WHERE lower(au.email) = lower('info@faddebo.se')
ORDER BY r."slug", rp."permission";

-- Pending personalinbjudningar ska vara inaktiva tills mottagaren klickar mejlet.
SELECT
  u."email",
  u."isActive",
  u."emailVerifiedAt",
  au.invited_at,
  au.email_confirmed_at,
  au.raw_user_meta_data->>'claim_mode' AS claim_mode
FROM public."User" u
JOIN auth.users au ON au.id = u."authUserId"
WHERE au.raw_user_meta_data->>'claim_mode' IN ('staff_invitation', 'contractor_invitation')
ORDER BY u."createdAt" DESC
LIMIT 20;
