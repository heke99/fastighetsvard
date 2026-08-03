-- FaddeBo account, role and contact hardening.
-- Keeps public self-signup applicant-only, restricts privileged role assignment,
-- and aligns canonical contact addresses with faddebo.se.

BEGIN;
SET LOCAL search_path = public, auth, extensions;

UPDATE public."Organization"
SET
  "email" = 'info@faddebo.se',
  "dataProtectionEmail" = 'info@faddebo.se',
  "updatedAt" = now()
WHERE "legalName" = 'Östgöta El Teknik AB'
   OR "orgNumber" = '559350-5620';

UPDATE public."Brand"
SET
  "supportEmail" = 'info@faddebo.se',
  "updatedAt" = now()
WHERE "slug" = 'faddebo';

UPDATE public."Role"
SET "name" = 'Fastighetsvärd / förvaltare', "updatedAt" = now()
WHERE "organizationId" IS NULL AND "slug" = 'property-manager';

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
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required';
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
    COALESCE(bool_or(
      rp."permission" IN ('*', 'users:*', 'users:create')
    ), false)
  INTO v_actor_is_superadmin, v_actor_can_create_users
  FROM public."UserRole" ur
  JOIN public."Role" r ON r."id" = ur."roleId"
  LEFT JOIN public."RolePermission" rp ON rp."roleId" = r."id"
  WHERE ur."userId" = p_actor_user_id;

  IF NOT v_actor_can_create_users THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  SELECT * INTO v_auth FROM auth.users WHERE id = p_auth_user_id FOR UPDATE;
  IF NOT FOUND OR v_auth.email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'verified_auth_user_not_found';
  END IF;
  IF lower(v_auth.email) <> v_email THEN
    RAISE EXCEPTION 'auth_email_mismatch';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public."User"
    WHERE "authUserId" = p_auth_user_id OR lower("email") = v_email
  ) THEN
    RAISE EXCEPTION 'user_already_exists';
  END IF;

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
    v_auth.email_confirmed_at, true
  );
  INSERT INTO public."UserRole" ("userId", "roleId")
  VALUES (v_user_id, v_role."id");
  INSERT INTO public."AuditEvent" (
    "organizationId", "userId", "actorType", "actorId", "action",
    "entityType", "entityId", "after"
  ) VALUES (
    p_organization_id, p_actor_user_id, 'user', p_actor_user_id, 'create',
    'user', v_user_id, jsonb_build_object('email', v_email, 'role', v_role."slug")
  );

  RETURN jsonb_build_object(
    'userId', v_user_id,
    'personId', v_person_id,
    'roleSlug', v_role."slug",
    'roleName', v_role."name"
  );
END
$function$;

REVOKE ALL ON FUNCTION public.provision_staff_user(
  uuid,text,text,text,text,text,text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_staff_user(
  uuid,text,text,text,text,text,text
) TO service_role;

COMMIT;
