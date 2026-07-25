BEGIN;

CREATE OR REPLACE VIEW public.api_customer_catalog
WITH (security_barrier = true)
AS
SELECT
  p.id,
  p."organizationId",
  p."firstName",
  p."lastName",
  p.email,
  p.phone,
  p."isCompany",
  p."companyName",
  p.address,
  p."postalCode",
  p.city,
  p.country,
  p."protectedIdentity",
  p."createdAt",
  p."updatedAt",
  lower(concat_ws(' ', p."firstName", p."lastName", p.email)) AS "searchText"
FROM public."Person" p;

REVOKE ALL ON public.api_customer_catalog FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.api_customer_catalog TO service_role;

CREATE OR REPLACE FUNCTION public.upsert_external_customer(
  p_organization_id text,
  p_first_name text,
  p_last_name text,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_is_company boolean DEFAULT false,
  p_company_name text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_postal_code text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_external_system text DEFAULT NULL,
  p_external_customer_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_person_id text;
  v_deduplicated boolean := false;
  v_email text := nullif(lower(trim(p_email)), '');
BEGIN
  PERFORM public.assert_service_role();

  IF p_organization_id IS NULL OR nullif(trim(p_first_name), '') IS NULL
     OR nullif(trim(p_last_name), '') IS NULL THEN
    RAISE EXCEPTION 'invalid_customer';
  END IF;

  IF nullif(trim(p_external_system), '') IS NOT NULL
     AND nullif(trim(p_external_customer_id), '') IS NOT NULL THEN
    SELECT er."personId"
      INTO v_person_id
    FROM public."ExternalReference" er
    WHERE er."organizationId" = p_organization_id
      AND er."externalSystem" = trim(p_external_system)
      AND er."entityType" = 'customer'
      AND er."externalId" = trim(p_external_customer_id)
    FOR UPDATE;
  END IF;

  IF v_person_id IS NULL AND v_email IS NOT NULL THEN
    SELECT p.id
      INTO v_person_id
    FROM public."Person" p
    WHERE p."organizationId" = p_organization_id
      AND lower(p.email) = v_email
    ORDER BY p."createdAt", p.id
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_person_id IS NULL THEN
    v_person_id := gen_random_uuid()::text;
    INSERT INTO public."Person" (
      id, "organizationId", "firstName", "lastName", email, phone,
      "isCompany", "companyName", address, "postalCode", city
    )
    VALUES (
      v_person_id, p_organization_id, trim(p_first_name), trim(p_last_name),
      v_email, nullif(trim(p_phone), ''), coalesce(p_is_company, false),
      nullif(trim(p_company_name), ''), nullif(trim(p_address), ''),
      nullif(trim(p_postal_code), ''), nullif(trim(p_city), '')
    );
  ELSE
    v_deduplicated := true;
  END IF;

  IF nullif(trim(p_external_system), '') IS NOT NULL
     AND nullif(trim(p_external_customer_id), '') IS NOT NULL THEN
    INSERT INTO public."ExternalReference" (
      id, "organizationId", "externalSystem", "entityType", "externalId",
      "personId", "syncStatus"
    )
    VALUES (
      gen_random_uuid()::text, p_organization_id, trim(p_external_system), 'customer',
      trim(p_external_customer_id), v_person_id, 'synced'
    )
    ON CONFLICT ("organizationId", "externalSystem", "entityType", "externalId")
    DO UPDATE SET
      "personId" = EXCLUDED."personId",
      "syncStatus" = 'synced',
      "updatedAt" = now();
  END IF;

  RETURN jsonb_build_object(
    'personId', v_person_id,
    'deduplicated', v_deduplicated
  );
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_external_customer(
  text, text, text, text, text, boolean, text, text, text, text, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_external_customer(
  text, text, text, text, text, boolean, text, text, text, text, text, text
) TO service_role;

COMMIT;
