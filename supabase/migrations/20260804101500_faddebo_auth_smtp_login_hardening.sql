-- FaddeBo Auth/SMTP/login hardening.
-- - verified public signups are provisioned idempotently;
-- - Supabase SMTP invitations can create pending staff/contractor profiles;
-- - accepting an invite activates the pre-provisioned app profile;
-- - verified users missing an app profile can be reconciled server-side.

BEGIN;
SET LOCAL search_path = public, auth, extensions;

-- Keep legacy installations compatible with Supabase Auth as the sole password
-- store and with inserts that rely on canonical timestamp defaults.
DO $block$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'passwordHash'
  ) THEN
    EXECUTE 'ALTER TABLE public."User" ALTER COLUMN "passwordHash" DROP NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Organization' AND column_name = 'createdAt'
  ) THEN
    EXECUTE 'ALTER TABLE public."Organization" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Organization' AND column_name = 'updatedAt'
  ) THEN
    EXECUTE 'ALTER TABLE public."Organization" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'createdAt'
  ) THEN
    EXECUTE 'ALTER TABLE public."User" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'updatedAt'
  ) THEN
    EXECUTE 'ALTER TABLE public."User" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP';
  END IF;
END
$block$;

CREATE OR REPLACE FUNCTION public.provision_verified_self_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $function$
DECLARE
  v_org_id text;
  v_person_id text := gen_random_uuid()::text;
  v_claim_mode text := COALESCE(NEW.raw_user_meta_data->>'claim_mode', 'self_signup');
  v_person_email text;
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Managed users are provisioned before the SMTP invite is accepted. Once
  -- Supabase confirms the address, activate that existing profile here.
  IF EXISTS (SELECT 1 FROM public."User" WHERE "authUserId" = NEW.id) THEN
    UPDATE public."User"
    SET "emailVerifiedAt" = NEW.email_confirmed_at,
        "isActive" = true,
        "email" = lower(NEW.email),
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "authUserId" = NEW.id;
    RETURN NEW;
  END IF;

  -- A missing managed profile must never be silently downgraded to applicant.
  IF v_claim_mode IN ('invitation', 'staff_invitation', 'contractor_invitation', 'bootstrap') THEN
    RETURN NEW;
  END IF;

  SELECT "id" INTO v_org_id
  FROM public."Organization"
  ORDER BY "createdAt", "id"
  LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'default_organization_missing' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public."User"
    WHERE lower("email") = lower(NEW.email) AND "authUserId" <> NEW.id
  ) THEN
    RAISE EXCEPTION 'application_email_already_registered' USING ERRCODE = '23505';
  END IF;

  -- Do not claim an imported person merely by matching e-mail. If an imported
  -- person already owns the address, the new applicant profile starts without
  -- a Person.email value while User.email remains the login identity.
  v_person_email := CASE
    WHEN EXISTS (
      SELECT 1 FROM public."Person"
      WHERE "organizationId" = v_org_id AND lower("email") = lower(NEW.email)
    ) THEN NULL
    ELSE lower(NEW.email)
  END;

  INSERT INTO public."Person" (
    "id", "organizationId", "firstName", "lastName", "email", "phone"
  ) VALUES (
    v_person_id,
    v_org_id,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'first_name'), ''), 'Okänt'),
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'last_name'), ''), 'namn'),
    v_person_email,
    NULLIF(trim(NEW.raw_user_meta_data->>'phone'), '')
  );

  INSERT INTO public."PersonRole" ("personId", "role")
  VALUES (v_person_id, 'APPLICANT')
  ON CONFLICT DO NOTHING;

  INSERT INTO public."User" (
    "authUserId", "organizationId", "personId", "email", "emailVerifiedAt", "isActive"
  ) VALUES (
    NEW.id, v_org_id, v_person_id, lower(NEW.email), NEW.email_confirmed_at, true
  );

  INSERT INTO public."Notification" (
    "organizationId", "personId", "eventType", "title", "body"
  ) VALUES (
    v_org_id, v_person_id, 'account_verified', 'Kontot är verifierat',
    'Din e-postadress är verifierad och kontot är nu aktivt.'
  );

  INSERT INTO public."AuditEvent" (
    "organizationId", "actorType", "actorId", "action", "entityType", "entityId", "after"
  ) VALUES (
    v_org_id, 'auth_user', NEW.id::text, 'verified_self_signup_provisioned', 'user', NEW.id::text,
    jsonb_build_object('personId', v_person_id, 'emailVerifiedAt', NEW.email_confirmed_at)
  );

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS "auth_user_verified_provision_profile" ON auth.users;
CREATE TRIGGER "auth_user_verified_provision_profile"
AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.provision_verified_self_signup();

CREATE OR REPLACE FUNCTION public.reconcile_verified_auth_user(p_auth_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $function$
DECLARE
  v_auth auth.users%ROWTYPE;
  v_org_id text;
  v_person_id text := gen_random_uuid()::text;
  v_claim_mode text;
  v_user_id text;
  v_person_email text;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_auth FROM auth.users WHERE id = p_auth_user_id FOR UPDATE;
  IF NOT FOUND OR v_auth.email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'verified_auth_user_not_found';
  END IF;

  SELECT "id" INTO v_user_id
  FROM public."User"
  WHERE "authUserId" = p_auth_user_id
  FOR UPDATE;

  IF v_user_id IS NOT NULL THEN
    UPDATE public."User"
    SET "email" = lower(v_auth.email),
        "emailVerifiedAt" = v_auth.email_confirmed_at,
        "isActive" = true,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = v_user_id;
    RETURN jsonb_build_object('ok', true, 'userId', v_user_id, 'reconciled', 'activated');
  END IF;

  v_claim_mode := COALESCE(v_auth.raw_user_meta_data->>'claim_mode', 'self_signup');
  IF v_claim_mode IN ('invitation', 'staff_invitation', 'contractor_invitation', 'bootstrap') THEN
    RAISE EXCEPTION 'managed_application_profile_missing';
  END IF;

  IF EXISTS (SELECT 1 FROM public."User" WHERE lower("email") = lower(v_auth.email)) THEN
    RAISE EXCEPTION 'application_email_already_registered';
  END IF;

  SELECT "id" INTO v_org_id
  FROM public."Organization"
  ORDER BY "createdAt", "id"
  LIMIT 1;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'default_organization_missing'; END IF;

  v_person_email := CASE
    WHEN EXISTS (
      SELECT 1 FROM public."Person"
      WHERE "organizationId" = v_org_id AND lower("email") = lower(v_auth.email)
    ) THEN NULL
    ELSE lower(v_auth.email)
  END;

  INSERT INTO public."Person" (
    "id", "organizationId", "firstName", "lastName", "email", "phone"
  ) VALUES (
    v_person_id,
    v_org_id,
    COALESCE(NULLIF(trim(v_auth.raw_user_meta_data->>'first_name'), ''), 'Okänt'),
    COALESCE(NULLIF(trim(v_auth.raw_user_meta_data->>'last_name'), ''), 'namn'),
    v_person_email,
    NULLIF(trim(v_auth.raw_user_meta_data->>'phone'), '')
  );

  INSERT INTO public."PersonRole" ("personId", "role")
  VALUES (v_person_id, 'APPLICANT') ON CONFLICT DO NOTHING;

  INSERT INTO public."User" (
    "authUserId", "organizationId", "personId", "email", "emailVerifiedAt", "isActive"
  ) VALUES (
    v_auth.id, v_org_id, v_person_id, lower(v_auth.email), v_auth.email_confirmed_at, true
  ) RETURNING "id" INTO v_user_id;

  RETURN jsonb_build_object('ok', true, 'userId', v_user_id, 'personId', v_person_id, 'reconciled', 'created');
END
$function$;

REVOKE ALL ON FUNCTION public.reconcile_verified_auth_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_verified_auth_user(uuid) TO service_role;

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
SET search_path = public, auth, pg_temp
AS $function$
DECLARE
  v_auth auth.users%ROWTYPE;
  v_role public."Role"%ROWTYPE;
  v_person_id text := gen_random_uuid()::text;
  v_user_id text := gen_random_uuid()::text;
  v_email text := lower(trim(p_email));
  v_actor_is_superadmin boolean := false;
  v_actor_can_create_users boolean := false;
  v_claim_mode text;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service_role_required'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public."User" u
    WHERE u."id" = p_actor_user_id
      AND u."organizationId" = p_organization_id
      AND u."isActive" = true
  ) THEN RAISE EXCEPTION 'actor_not_found'; END IF;

  SELECT
    COALESCE(bool_or(r."slug" = 'superadmin'), false),
    COALESCE(bool_or(rp."permission" IN ('*', 'users:*', 'users:create')), false)
  INTO v_actor_is_superadmin, v_actor_can_create_users
  FROM public."UserRole" ur
  JOIN public."Role" r ON r."id" = ur."roleId"
  LEFT JOIN public."RolePermission" rp ON rp."roleId" = r."id"
  WHERE ur."userId" = p_actor_user_id;

  IF NOT v_actor_can_create_users THEN RAISE EXCEPTION 'permission_denied'; END IF;

  SELECT * INTO v_auth FROM auth.users WHERE id = p_auth_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'auth_user_not_found'; END IF;
  IF lower(v_auth.email) <> v_email THEN RAISE EXCEPTION 'auth_email_mismatch'; END IF;

  v_claim_mode := COALESCE(v_auth.raw_user_meta_data->>'claim_mode', '');
  IF v_auth.email_confirmed_at IS NULL
     AND v_claim_mode NOT IN ('staff_invitation', 'bootstrap') THEN
    RAISE EXCEPTION 'managed_auth_invitation_required';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public."User"
    WHERE "authUserId" = p_auth_user_id OR lower("email") = v_email
  ) THEN RAISE EXCEPTION 'user_already_exists'; END IF;

  SELECT * INTO v_role
  FROM public."Role"
  WHERE "id" = p_role_id
    AND ("organizationId" = p_organization_id OR "organizationId" IS NULL)
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'role_not_found'; END IF;

  IF v_role."slug" IN ('superadmin', 'org-admin') AND NOT v_actor_is_superadmin THEN
    RAISE EXCEPTION 'privileged_role_assignment_denied';
  END IF;

  INSERT INTO public."Person" (
    "id", "organizationId", "firstName", "lastName", "email"
  ) VALUES (
    v_person_id, p_organization_id, trim(p_first_name), trim(p_last_name), v_email
  );

  INSERT INTO public."User" (
    "id", "authUserId", "organizationId", "personId", "email",
    "emailVerifiedAt", "isActive"
  ) VALUES (
    v_user_id, p_auth_user_id, p_organization_id, v_person_id, v_email,
    v_auth.email_confirmed_at, v_auth.email_confirmed_at IS NOT NULL
  );

  INSERT INTO public."UserRole" ("userId", "roleId") VALUES (v_user_id, v_role."id");

  INSERT INTO public."AuditEvent" (
    "organizationId", "userId", "actorType", "actorId", "action",
    "entityType", "entityId", "after"
  ) VALUES (
    p_organization_id, p_actor_user_id, 'user', p_actor_user_id, 'create',
    'user', v_user_id,
    jsonb_build_object(
      'email', v_email,
      'role', v_role."slug",
      'activationPending', v_auth.email_confirmed_at IS NULL
    )
  );

  RETURN jsonb_build_object(
    'userId', v_user_id,
    'personId', v_person_id,
    'roleSlug', v_role."slug",
    'roleName', v_role."name",
    'activationPending', v_auth.email_confirmed_at IS NULL
  );
END
$function$;

REVOKE ALL ON FUNCTION public.provision_staff_user(uuid,text,text,text,text,text,text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_staff_user(uuid,text,text,text,text,text,text)
TO service_role;

CREATE OR REPLACE FUNCTION public.provision_supplier(
  p_organization_id text,
  p_actor_user_id text,
  p_name text,
  p_org_number text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_specialty text DEFAULT NULL,
  p_auth_user_id uuid DEFAULT NULL,
  p_contractor_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $function$
DECLARE
  v_supplier_id text := gen_random_uuid()::text;
  v_user_id text;
  v_role_id text;
  v_auth auth.users%ROWTYPE;
  v_claim_mode text;
BEGIN
  PERFORM public.assert_service_role();
  IF nullif(trim(p_name), '') IS NULL THEN RAISE EXCEPTION 'supplier_name_required'; END IF;

  IF p_auth_user_id IS NOT NULL THEN
    IF nullif(lower(trim(p_contractor_email)), '') IS NULL THEN
      RAISE EXCEPTION 'contractor_email_required';
    END IF;

    SELECT * INTO v_auth FROM auth.users WHERE id = p_auth_user_id FOR UPDATE;
    IF NOT FOUND OR lower(v_auth.email) <> lower(trim(p_contractor_email)) THEN
      RAISE EXCEPTION 'auth_user_not_found_or_email_mismatch';
    END IF;
    v_claim_mode := COALESCE(v_auth.raw_user_meta_data->>'claim_mode', '');
    IF v_auth.email_confirmed_at IS NULL AND v_claim_mode <> 'contractor_invitation' THEN
      RAISE EXCEPTION 'contractor_invitation_required';
    END IF;

    SELECT id INTO v_role_id
    FROM public."Role"
    WHERE slug = 'contractor' AND "organizationId" IS NULL
    FOR SHARE;
    IF v_role_id IS NULL THEN RAISE EXCEPTION 'contractor_role_not_found'; END IF;
  END IF;

  INSERT INTO public."Supplier" (
    id, "organizationId", name, "orgNumber", email, phone, specialty
  ) VALUES (
    v_supplier_id, p_organization_id, trim(p_name), nullif(trim(p_org_number), ''),
    nullif(lower(trim(p_email)), ''), nullif(trim(p_phone), ''), nullif(trim(p_specialty), '')
  );

  IF p_auth_user_id IS NOT NULL THEN
    v_user_id := gen_random_uuid()::text;
    INSERT INTO public."User" (
      id, "authUserId", "organizationId", email, "supplierId",
      "emailVerifiedAt", "isActive"
    ) VALUES (
      v_user_id, v_auth.id, p_organization_id, lower(v_auth.email), v_supplier_id,
      v_auth.email_confirmed_at, v_auth.email_confirmed_at IS NOT NULL
    );

    INSERT INTO public."UserRole" (id, "userId", "roleId")
    VALUES (gen_random_uuid()::text, v_user_id, v_role_id);
  END IF;

  INSERT INTO public."AuditEvent" (
    id, "organizationId", "userId", "actorType", "actorId", action,
    "entityType", "entityId", after
  ) VALUES (
    gen_random_uuid()::text, p_organization_id, p_actor_user_id, 'user',
    p_actor_user_id, 'create', 'supplier', v_supplier_id,
    jsonb_build_object(
      'name', trim(p_name),
      'contractorUserId', v_user_id,
      'activationPending', p_auth_user_id IS NOT NULL AND v_auth.email_confirmed_at IS NULL
    )
  );

  RETURN jsonb_build_object('supplierId', v_supplier_id, 'userId', v_user_id);
END
$function$;

REVOKE ALL ON FUNCTION public.provision_supplier(text,text,text,text,text,text,text,uuid,text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_supplier(text,text,text,text,text,text,text,uuid,text)
TO service_role;

COMMIT;
