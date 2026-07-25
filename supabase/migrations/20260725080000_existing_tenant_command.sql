-- Atomic registration of an already-existing tenant and active imported lease.

BEGIN;
SET LOCAL search_path = public, auth, extensions;

CREATE FUNCTION public.register_existing_tenant(
  p_organization_id text,
  p_unit_id text,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_personal_number text,
  p_address text,
  p_postal_code text,
  p_city text,
  p_contract_number text,
  p_contract_start_date timestamp without time zone,
  p_contract_end_date timestamp without time zone,
  p_rent numeric,
  p_deposit numeric,
  p_notice_period_months integer,
  p_invoice_reference text,
  p_external_system text,
  p_external_customer_id text,
  p_external_contract_id text,
  p_actor_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $function$
DECLARE
  v_unit public."Unit"%ROWTYPE;
  v_person public."Person"%ROWTYPE;
  v_person_id text;
  v_person_created boolean := false;
  v_contract_id text := gen_random_uuid()::text;
  v_contract_number text := NULLIF(trim(p_contract_number), '');
  v_counter integer;
  v_email text := NULLIF(lower(trim(p_email)), '');
  v_personal_number text := NULLIF(regexp_replace(COALESCE(p_personal_number, ''), '[^0-9]', '', 'g'), '');
  v_contract_type public."ContractType";
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service_role_required'; END IF;
  SELECT * INTO v_unit
  FROM public."Unit"
  WHERE "id" = p_unit_id AND "organizationId" = p_organization_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'unit_not_found'; END IF;
  IF EXISTS (
    SELECT 1 FROM public."Contract" c
    WHERE c."unitId" = p_unit_id
      AND c."status" IN ('ACTIVE','SIGNED','SENT_FOR_SIGNING','PARTIALLY_SIGNED')
  ) THEN RAISE EXCEPTION 'unit_has_binding_contract'; END IF;

  IF v_email IS NOT NULL THEN
    SELECT * INTO v_person
    FROM public."Person"
    WHERE "organizationId" = p_organization_id AND lower("email") = v_email
    FOR UPDATE;
  END IF;
  IF v_person."id" IS NULL AND v_personal_number IS NOT NULL THEN
    SELECT * INTO v_person
    FROM public."Person"
    WHERE "organizationId" = p_organization_id
      AND regexp_replace(COALESCE("personalNumber", ''), '[^0-9]', '', 'g') = v_personal_number
    FOR UPDATE;
  END IF;

  IF v_person."id" IS NULL THEN
    v_person_id := gen_random_uuid()::text;
    INSERT INTO public."Person" (
      "id", "organizationId", "firstName", "lastName", "email", "phone",
      "personalNumber", "address", "postalCode", "city"
    ) VALUES (
      v_person_id, p_organization_id, trim(p_first_name), trim(p_last_name),
      v_email, NULLIF(trim(p_phone), ''), v_personal_number,
      NULLIF(trim(p_address), ''), NULLIF(trim(p_postal_code), ''),
      NULLIF(trim(p_city), '')
    )
    RETURNING * INTO v_person;
    v_person_created := true;
  ELSE
    v_person_id := v_person."id";
    UPDATE public."Person"
    SET "phone" = COALESCE("phone", NULLIF(trim(p_phone), '')),
        "address" = COALESCE("address", NULLIF(trim(p_address), '')),
        "postalCode" = COALESCE("postalCode", NULLIF(trim(p_postal_code), '')),
        "city" = COALESCE("city", NULLIF(trim(p_city), '')),
        "personalNumber" = COALESCE("personalNumber", v_personal_number)
    WHERE "id" = v_person_id
    RETURNING * INTO v_person;
  END IF;

  INSERT INTO public."PersonRole" ("personId", "role")
  VALUES (v_person_id, 'TENANT')
  ON CONFLICT ("personId", "role") DO NOTHING;

  IF v_contract_number IS NULL THEN
    INSERT INTO public."Counter" ("organizationId", "key", "value")
    VALUES (p_organization_id, 'contract', 1)
    ON CONFLICT ("organizationId", "key")
    DO UPDATE SET "value" = public."Counter"."value" + 1
    RETURNING "value" INTO v_counter;
    v_contract_number := 'HK-' || extract(year FROM CURRENT_DATE)::integer || '-' || v_counter;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public."Contract"
    WHERE "organizationId" = p_organization_id AND "contractNumber" = v_contract_number
  ) THEN RAISE EXCEPTION 'contract_number_exists'; END IF;

  v_contract_type := CASE v_unit."type"
    WHEN 'PARKING' THEN 'PARKING'::public."ContractType"
    WHEN 'STORAGE' THEN 'STORAGE'::public."ContractType"
    ELSE 'RESIDENTIAL'::public."ContractType"
  END;
  INSERT INTO public."Contract" (
    "id", "organizationId", "unitId", "contractNumber", "type", "status",
    "startDate", "endDate", "noticePeriodMonths", "rent", "deposit",
    "invoiceReference", "isImported", "activatedAt"
  ) VALUES (
    v_contract_id, p_organization_id, p_unit_id, v_contract_number,
    v_contract_type, 'ACTIVE', p_contract_start_date, p_contract_end_date,
    COALESCE(p_notice_period_months, 3), p_rent, p_deposit,
    p_invoice_reference, true, p_contract_start_date
  );
  INSERT INTO public."ContractParty" (
    "contractId", "personId", "role", "signedAt", "signatureMethod"
  ) VALUES (
    v_contract_id, v_person_id, 'TENANT', p_contract_start_date, 'manual'
  );
  INSERT INTO public."ContractVersion" (
    "contractId", "versionNumber", "content", "createdByUserId"
  ) VALUES (
    v_contract_id, 1,
    jsonb_build_object(
      'rent', p_rent,
      'startDate', p_contract_start_date,
      'imported', true
    ),
    p_actor_user_id
  );
  INSERT INTO public."ContractStatusEvent" (
    "contractId", "toStatus", "comment", "changedByUserId"
  ) VALUES (
    v_contract_id, 'ACTIVE', 'Importerat befintligt avtal', p_actor_user_id
  );
  UPDATE public."Unit" SET "status" = 'RENTED' WHERE "id" = p_unit_id;

  IF p_external_system IS NOT NULL AND p_external_customer_id IS NOT NULL THEN
    INSERT INTO public."ExternalReference" (
      "organizationId", "externalSystem", "entityType", "externalId", "personId"
    ) VALUES (
      p_organization_id, p_external_system, 'customer', p_external_customer_id, v_person_id
    )
    ON CONFLICT ("organizationId", "externalSystem", "entityType", "externalId")
    DO UPDATE SET "personId" = EXCLUDED."personId", "updatedAt" = CURRENT_TIMESTAMP;
  END IF;
  IF p_external_system IS NOT NULL AND p_external_contract_id IS NOT NULL THEN
    INSERT INTO public."ExternalReference" (
      "organizationId", "externalSystem", "entityType", "externalId", "contractId"
    ) VALUES (
      p_organization_id, p_external_system, 'contract', p_external_contract_id, v_contract_id
    )
    ON CONFLICT ("organizationId", "externalSystem", "entityType", "externalId")
    DO UPDATE SET "contractId" = EXCLUDED."contractId", "updatedAt" = CURRENT_TIMESTAMP;
  END IF;

  INSERT INTO public."AuditEvent" (
    "organizationId", "userId", "actorType", "actorId", "action",
    "entityType", "entityId", "after"
  ) VALUES (
    p_organization_id, p_actor_user_id, 'user', p_actor_user_id,
    'register_existing_tenant', 'contract', v_contract_id,
    jsonb_build_object(
      'personId', v_person_id,
      'personCreated', v_person_created,
      'unitId', p_unit_id,
      'contractNumber', v_contract_number
    )
  );
  RETURN jsonb_build_object(
    'person', jsonb_build_object(
      'id', v_person_id,
      'firstName', v_person."firstName",
      'lastName', v_person."lastName",
      'email', v_person."email"
    ),
    'contract', jsonb_build_object(
      'id', v_contract_id,
      'contractNumber', v_contract_number,
      'status', 'ACTIVE'
    ),
    'personCreated', v_person_created
  );
END
$function$;

REVOKE ALL ON FUNCTION public.register_existing_tenant(
  text,text,text,text,text,text,text,text,text,text,text,
  timestamp without time zone,timestamp without time zone,numeric,numeric,integer,
  text,text,text,text,text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_existing_tenant(
  text,text,text,text,text,text,text,text,text,text,text,
  timestamp without time zone,timestamp without time zone,numeric,numeric,integer,
  text,text,text,text,text
) TO service_role;

COMMIT;
