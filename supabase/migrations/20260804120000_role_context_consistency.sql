-- Keep role identity consistent between the database, superadmin UI and
-- authenticated session context.

BEGIN;
SET LOCAL search_path = public, auth, extensions, pg_temp;

UPDATE public."Role"
SET
  "name" = CASE "slug"
    WHEN 'superadmin' THEN 'Ägare / superadmin'
    WHEN 'org-admin' THEN 'Bolagsadmin'
    WHEN 'property-owner' THEN 'Fastighetsägare'
    WHEN 'property-manager' THEN 'Fastighetsvärd / förvaltare'
    WHEN 'caretaker' THEN 'Kvartersvärd'
    WHEN 'leasing-agent' THEN 'Uthyrare'
    WHEN 'sales-manager' THEN 'Försäljningsansvarig'
    WHEN 'finance' THEN 'Ekonom'
    WHEN 'customer-service' THEN 'Kundtjänst'
    WHEN 'facility-worker' THEN 'Fastighetsskötare'
    WHEN 'inspector' THEN 'Besiktningsman'
    WHEN 'contractor' THEN 'Entreprenör'
    WHEN 'report-viewer' THEN 'Rapportläsare'
    ELSE "name"
  END,
  "description" = CASE "slug"
    WHEN 'superadmin' THEN 'Full ägarbehörighet i hela FaddeBo, inklusive personal och roller.'
    WHEN 'org-admin' THEN 'Administrerar bolagets användare och samtliga verksamhetsflöden.'
    WHEN 'property-owner' THEN 'Läs- och rapportbehörighet för fastighetsägare.'
    WHEN 'property-manager' THEN 'Operativ helhetsbehörighet för uthyrning, hyresgäster och förvaltning.'
    WHEN 'caretaker' THEN 'Boendeservice, felanmälningar och arbetsorder.'
    WHEN 'leasing-agent' THEN 'Annonser, ansökningar, visningar, erbjudanden och avtal.'
    WHEN 'sales-manager' THEN 'Försäljning och kommersiella objekt.'
    WHEN 'finance' THEN 'Fakturor, betalningar, integrationer och ekonomirapporter.'
    WHEN 'customer-service' THEN 'Kundservice, ärenden, meddelanden och relevanta läsvyer.'
    WHEN 'facility-worker' THEN 'Utför och uppdaterar felanmälningar och arbetsorder.'
    WHEN 'inspector' THEN 'Besiktningar och tillhörande dokument.'
    WHEN 'contractor' THEN 'Ser och uppdaterar endast leverantörens egna arbetsorder.'
    WHEN 'report-viewer' THEN 'Läsbehörighet till rapporter.'
    ELSE "description"
  END,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "organizationId" IS NULL
  AND "slug" IN (
    'superadmin','org-admin','property-owner','property-manager','caretaker',
    'leasing-agent','sales-manager','finance','customer-service','facility-worker',
    'inspector','contractor','report-viewer'
  );

-- Synchronize the exact canonical permission set. Earlier migrations used
-- ON CONFLICT DO NOTHING, which installed missing permissions but could leave
-- obsolete grants behind after a role definition changed.
CREATE TEMP TABLE _faddebo_role_permission_sync (
  slug text PRIMARY KEY,
  permissions text[] NOT NULL
) ON COMMIT DROP;

INSERT INTO _faddebo_role_permission_sync (slug, permissions) VALUES
  ('superadmin', ARRAY['*']),
  ('org-admin', ARRAY[
    'persons:*','users:*','roles:*','properties:*','buildings:*','units:*','listings:*',
    'applications:*','viewings:*','offers:*','contracts:*','terminations:*','inspections:*',
    'invoices:*','payments:*','maintenance:*','workorders:*','suppliers:*','documents:*',
    'messages:*','notifications:*','integrations:*','webhooks:*','apikeys:*','imports:*',
    'reports:*','audit:read','settings:*'
  ]),
  ('property-owner', ARRAY[
    'properties:read','buildings:read','units:read','listings:read','contracts:read',
    'invoices:read','payments:read','reports:*','maintenance:read','workorders:read','audit:read'
  ]),
  ('property-manager', ARRAY[
    'persons:*','properties:*','buildings:*','units:*','listings:*','applications:*',
    'viewings:*','offers:*','contracts:*','terminations:*','inspections:*','maintenance:*',
    'workorders:*','suppliers:*','documents:*','messages:*','invoices:read','payments:read',
    'imports:*','reports:read'
  ]),
  ('caretaker', ARRAY[
    'properties:read','buildings:read','units:read','maintenance:*','workorders:*',
    'messages:*','persons:read','documents:read'
  ]),
  ('leasing-agent', ARRAY[
    'persons:*','units:read','units:update','listings:*','applications:*','viewings:*',
    'offers:*','contracts:*','documents:*','messages:*','reports:read'
  ]),
  ('sales-manager', ARRAY[
    'persons:read','units:read','units:update','listings:*','viewings:*','offers:*',
    'contracts:*','documents:*','messages:*','reports:read'
  ]),
  ('finance', ARRAY[
    'persons:read','contracts:read','invoices:*','payments:*','integrations:*','reports:*','audit:read'
  ]),
  ('customer-service', ARRAY[
    'persons:read','persons:update','units:read','listings:read','applications:read',
    'applications:update','contracts:read','invoices:read','maintenance:*','messages:*','documents:read'
  ]),
  ('facility-worker', ARRAY[
    'maintenance:read','maintenance:update','workorders:read','workorders:update','units:read'
  ]),
  ('inspector', ARRAY[
    'inspections:*','units:read','contracts:read','documents:create','documents:read'
  ]),
  ('contractor', ARRAY['workorders:read','workorders:update']),
  ('report-viewer', ARRAY['reports:read']);

DELETE FROM public."RolePermission" rp
USING public."Role" r, _faddebo_role_permission_sync canonical
WHERE rp."roleId" = r."id"
  AND r."organizationId" IS NULL
  AND r."slug" = canonical.slug
  AND NOT (rp."permission" = ANY(canonical.permissions));

INSERT INTO public."RolePermission" ("id", "roleId", "permission")
SELECT gen_random_uuid()::text, r."id", permission
FROM public."Role" r
JOIN _faddebo_role_permission_sync canonical ON canonical.slug = r."slug"
CROSS JOIN LATERAL unnest(canonical.permissions) AS permission
WHERE r."organizationId" IS NULL
ON CONFLICT ("roleId", "permission") DO NOTHING;

-- Custom roles must be explainable in the UI and may only contain canonical
-- permission identifiers. Replacing the old five-argument command prevents
-- service-side callers from writing arbitrary permission strings.
DROP FUNCTION IF EXISTS public.create_custom_role(text,text,text,text,text[]);
CREATE FUNCTION public.create_custom_role(
  p_organization_id text,
  p_actor_user_id text,
  p_name text,
  p_slug text,
  p_description text,
  p_permissions text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_role_id text := gen_random_uuid()::text;
  v_permission text;
  v_resource text;
  v_action text;
  v_resources constant text[] := ARRAY[
    'organizations','persons','users','roles','properties','buildings','units',
    'listings','applications','viewings','offers','contracts','terminations',
    'inspections','invoices','payments','maintenance','workorders','suppliers',
    'documents','messages','notifications','integrations','webhooks','apikeys',
    'imports','reports','audit','settings'
  ];
  v_actions constant text[] := ARRAY['read','create','update','delete','approve','export','*'];
BEGIN
  PERFORM public.assert_service_role();
  IF nullif(trim(p_name), '') IS NULL
     OR nullif(trim(p_slug), '') IS NULL
     OR nullif(trim(p_description), '') IS NULL
     OR coalesce(array_length(p_permissions, 1), 0) = 0 THEN
    RAISE EXCEPTION 'invalid_role';
  END IF;
  -- The service-role caller is not sufficient authorization on its own. The
  -- named actor must still be an active user in the same organization and hold
  -- the canonical permission to create roles through an organization-scoped or
  -- global system role.
  IF NOT EXISTS (
    SELECT 1
    FROM public."User" u
    JOIN public."UserRole" ur ON ur."userId" = u."id"
    JOIN public."Role" r ON r."id" = ur."roleId"
    JOIN public."RolePermission" rp ON rp."roleId" = r."id"
    WHERE u."id" = p_actor_user_id
      AND u."organizationId" = p_organization_id
      AND u."isActive" = true
      AND (r."organizationId" IS NULL OR r."organizationId" = p_organization_id)
      AND rp."permission" IN ('*', 'roles:*', 'roles:create')
  ) THEN
    RAISE EXCEPTION 'role_actor_forbidden';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public."Role"
    WHERE "organizationId" = p_organization_id AND "slug" = p_slug
  ) THEN
    RAISE EXCEPTION 'role_slug_exists';
  END IF;

  IF '*' = ANY(p_permissions) AND NOT EXISTS (
    SELECT 1
    FROM public."User" u
    JOIN public."UserRole" ur ON ur."userId" = u."id"
    JOIN public."Role" r ON r."id" = ur."roleId"
    WHERE u."id" = p_actor_user_id
      AND u."organizationId" = p_organization_id
      AND u."isActive" = true
      AND (r."organizationId" IS NULL OR r."organizationId" = p_organization_id)
      AND r."slug" = 'superadmin'
  ) THEN
    RAISE EXCEPTION 'privileged_role_assignment_denied';
  END IF;

  FOREACH v_permission IN ARRAY p_permissions LOOP
    v_permission := trim(v_permission);
    IF v_permission = '*' THEN CONTINUE; END IF;
    IF v_permission !~ '^[a-z]+:[a-z*]+$' THEN
      RAISE EXCEPTION 'invalid_permission:%', v_permission;
    END IF;
    v_resource := split_part(v_permission, ':', 1);
    v_action := split_part(v_permission, ':', 2);
    IF NOT (v_resource = ANY(v_resources)) OR NOT (v_action = ANY(v_actions)) THEN
      RAISE EXCEPTION 'invalid_permission:%', v_permission;
    END IF;
  END LOOP;

  INSERT INTO public."Role" (
    "id", "organizationId", "name", "slug", "description", "isSystem"
  ) VALUES (
    v_role_id, p_organization_id, trim(p_name), trim(p_slug), trim(p_description), false
  );

  FOREACH v_permission IN ARRAY p_permissions LOOP
    INSERT INTO public."RolePermission" ("id", "roleId", "permission")
    VALUES (gen_random_uuid()::text, v_role_id, trim(v_permission))
    ON CONFLICT ("roleId", "permission") DO NOTHING;
  END LOOP;

  INSERT INTO public."AuditEvent" (
    "id", "organizationId", "userId", "actorType", "actorId", "action",
    "entityType", "entityId", "after"
  ) VALUES (
    gen_random_uuid()::text, p_organization_id, p_actor_user_id, 'user',
    p_actor_user_id, 'create', 'role', v_role_id,
    jsonb_build_object(
      'name', trim(p_name),
      'description', trim(p_description),
      'permissions', to_jsonb(p_permissions)
    )
  );
  RETURN jsonb_build_object('roleId', v_role_id);
END
$function$;

REVOKE ALL ON FUNCTION public.create_custom_role(text,text,text,text,text,text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_custom_role(text,text,text,text,text,text[]) TO service_role;

CREATE OR REPLACE FUNCTION public.current_user_context()
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
      JOIN public."Role" r ON r."id" = ur."roleId"
      JOIN public."RolePermission" rp ON rp."roleId" = r."id"
      WHERE ur."userId" = u."id"
        AND (r."organizationId" IS NULL OR r."organizationId" = u."organizationId")
    ), '[]'::jsonb),
    'roleSlugs', COALESCE((
      SELECT jsonb_agg(DISTINCT r."slug" ORDER BY r."slug")
      FROM public."UserRole" ur
      JOIN public."Role" r ON r."id" = ur."roleId"
      WHERE ur."userId" = u."id"
        AND (r."organizationId" IS NULL OR r."organizationId" = u."organizationId")
    ), '[]'::jsonb),
    'roleNames', COALESCE((
      SELECT jsonb_agg(DISTINCT r."name" ORDER BY r."name")
      FROM public."UserRole" ur
      JOIN public."Role" r ON r."id" = ur."roleId"
      WHERE ur."userId" = u."id"
        AND (r."organizationId" IS NULL OR r."organizationId" = u."organizationId")
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
  LEFT JOIN public."Person" p
    ON p."id" = u."personId"
   AND p."organizationId" = u."organizationId"
  WHERE u."authUserId" = auth.uid()
    AND u."isActive" = true
$function$;

REVOKE ALL ON FUNCTION public.current_user_context() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_context() TO authenticated;

COMMIT;
