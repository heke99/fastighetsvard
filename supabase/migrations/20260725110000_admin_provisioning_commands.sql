BEGIN;

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
AS $$
DECLARE
  v_supplier_id text := gen_random_uuid()::text;
  v_user_id text;
  v_role_id text;
BEGIN
  PERFORM public.assert_service_role();
  IF nullif(trim(p_name), '') IS NULL THEN RAISE EXCEPTION 'supplier_name_required'; END IF;

  IF p_auth_user_id IS NOT NULL THEN
    IF nullif(lower(trim(p_contractor_email)), '') IS NULL THEN
      RAISE EXCEPTION 'contractor_email_required';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = p_auth_user_id
        AND email_confirmed_at IS NOT NULL
        AND lower(email) = lower(trim(p_contractor_email))
    ) THEN
      RAISE EXCEPTION 'verified_auth_user_not_found';
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
    nullif(lower(trim(p_email)), ''), nullif(trim(p_phone), ''),
    nullif(trim(p_specialty), '')
  );

  IF p_auth_user_id IS NOT NULL THEN
    v_user_id := gen_random_uuid()::text;
    INSERT INTO public."User" (
      id, "authUserId", "organizationId", email, "supplierId",
      "emailVerifiedAt", "isActive"
    )
    SELECT
      v_user_id, au.id, p_organization_id, lower(au.email), v_supplier_id,
      au.email_confirmed_at, true
    FROM auth.users au
    WHERE au.id = p_auth_user_id;

    INSERT INTO public."UserRole" (id, "userId", "roleId")
    VALUES (gen_random_uuid()::text, v_user_id, v_role_id);
  END IF;

  INSERT INTO public."AuditEvent" (
    id, "organizationId", "userId", "actorType", "actorId", action,
    "entityType", "entityId", after
  ) VALUES (
    gen_random_uuid()::text, p_organization_id, p_actor_user_id, 'user',
    p_actor_user_id, 'create', 'supplier', v_supplier_id,
    jsonb_build_object('name', trim(p_name), 'contractorUserId', v_user_id)
  );

  RETURN jsonb_build_object('supplierId', v_supplier_id, 'userId', v_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_custom_role(
  p_organization_id text,
  p_actor_user_id text,
  p_name text,
  p_slug text,
  p_permissions text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role_id text := gen_random_uuid()::text;
  v_permission text;
BEGIN
  PERFORM public.assert_service_role();
  IF nullif(trim(p_name), '') IS NULL OR nullif(trim(p_slug), '') IS NULL
     OR coalesce(array_length(p_permissions, 1), 0) = 0 THEN
    RAISE EXCEPTION 'invalid_role';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public."Role"
    WHERE "organizationId" = p_organization_id AND slug = p_slug
  ) THEN
    RAISE EXCEPTION 'role_slug_exists';
  END IF;

  INSERT INTO public."Role" (id, "organizationId", name, slug, "isSystem")
  VALUES (v_role_id, p_organization_id, trim(p_name), trim(p_slug), false);

  FOREACH v_permission IN ARRAY p_permissions LOOP
    IF nullif(trim(v_permission), '') IS NOT NULL THEN
      INSERT INTO public."RolePermission" (id, "roleId", permission)
      VALUES (gen_random_uuid()::text, v_role_id, trim(v_permission));
    END IF;
  END LOOP;

  INSERT INTO public."AuditEvent" (
    id, "organizationId", "userId", "actorType", "actorId", action,
    "entityType", "entityId", after
  ) VALUES (
    gen_random_uuid()::text, p_organization_id, p_actor_user_id, 'user',
    p_actor_user_id, 'create', 'role', v_role_id,
    jsonb_build_object('name', trim(p_name), 'permissions', to_jsonb(p_permissions))
  );
  RETURN jsonb_build_object('roleId', v_role_id);
END;
$$;

REVOKE ALL ON FUNCTION public.provision_supplier(text,text,text,text,text,text,text,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_custom_role(text,text,text,text,text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_supplier(text,text,text,text,text,text,text,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_custom_role(text,text,text,text,text[]) TO service_role;

COMMIT;
