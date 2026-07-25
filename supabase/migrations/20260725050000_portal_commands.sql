-- Atomic authenticated portal commands.

BEGIN;
SET LOCAL search_path = public, extensions;

CREATE FUNCTION public.toggle_favorite(p_listing_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_person_id text := public.current_app_person_id();
  v_organization_id text := public.current_app_organization_id();
  v_deleted_id text;
BEGIN
  IF v_person_id IS NULL OR v_organization_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public."Listing" l
    WHERE l."id" = p_listing_id AND l."organizationId" = v_organization_id
  ) THEN
    RAISE EXCEPTION 'listing_not_found';
  END IF;

  DELETE FROM public."Favorite"
  WHERE "personId" = v_person_id AND "listingId" = p_listing_id
  RETURNING "id" INTO v_deleted_id;
  IF v_deleted_id IS NOT NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public."Favorite" ("organizationId", "personId", "listingId")
  VALUES (v_organization_id, v_person_id, p_listing_id)
  ON CONFLICT ("personId", "listingId") DO NOTHING;
  RETURN true;
END
$function$;

CREATE FUNCTION public.current_user_context()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT jsonb_build_object(
    'id', u."id",
    'email', u."email",
    'organizationId', u."organizationId",
    'personId', u."personId",
    'supplierId', u."supplierId",
    'permissions', COALESCE((
      SELECT jsonb_agg(DISTINCT rp."permission" ORDER BY rp."permission")
      FROM public."UserRole" ur
      JOIN public."RolePermission" rp ON rp."roleId" = ur."roleId"
      WHERE ur."userId" = u."id"
    ), '[]'::jsonb),
    'roleSlugs', COALESCE((
      SELECT jsonb_agg(DISTINCT r."slug" ORDER BY r."slug")
      FROM public."UserRole" ur
      JOIN public."Role" r ON r."id" = ur."roleId"
      WHERE ur."userId" = u."id"
    ), '[]'::jsonb),
    'person', CASE WHEN p."id" IS NULL THEN NULL ELSE jsonb_build_object(
      'id', p."id",
      'firstName', p."firstName",
      'lastName', p."lastName",
      'roles', COALESCE((
        SELECT jsonb_agg(pr."role" ORDER BY pr."role")
        FROM public."PersonRole" pr
        WHERE pr."personId" = p."id"
      ), '[]'::jsonb)
    ) END
  )
  FROM public."User" u
  LEFT JOIN public."Person" p ON p."id" = u."personId"
  WHERE u."authUserId" = auth.uid() AND u."isActive" = true
$function$;

CREATE FUNCTION public.record_current_login(p_ip text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user public."User"%ROWTYPE;
BEGIN
  SELECT * INTO v_user
  FROM public."User"
  WHERE "authUserId" = auth.uid() AND "isActive" = true
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'inactive_user'; END IF;

  UPDATE public."User"
  SET "lastLoginAt" = CURRENT_TIMESTAMP
  WHERE "id" = v_user."id";

  INSERT INTO public."AuditEvent" (
    "organizationId", "userId", "actorType", "actorId", "action",
    "entityType", "entityId", "ip"
  ) VALUES (
    v_user."organizationId", v_user."id", 'user', v_user."id", 'login',
    'user', v_user."id", p_ip
  );
END
$function$;

REVOKE UPDATE ON TABLE public."User" FROM authenticated;
REVOKE ALL ON FUNCTION public.toggle_favorite(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_user_context() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_current_login(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_favorite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_current_login(text) TO authenticated;

COMMIT;
