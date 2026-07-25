-- Safe, database-filterable public read models and authenticated viewer helpers.

BEGIN;
SET LOCAL search_path = public, extensions;

DROP VIEW IF EXISTS public.published_listing_catalog;
CREATE VIEW public.published_listing_catalog
WITH (security_barrier = true) AS
SELECT
  l."id",
  l."slug",
  l."title",
  l."description",
  l."category",
  l."publishedAt",
  l."applicationDeadline",
  l."moveInDate",
  l."rent",
  l."price",
  l."contactName",
  l."contactEmail",
  l."contactPhone",
  l."seoTitle",
  l."seoDescription",
  l."featured",
  b."slug" AS "brandSlug",
  u."id" AS "unitId",
  u."unitNumber",
  u."apartmentNumber",
  u."type" AS "unitType",
  u."address",
  u."postalCode",
  u."city",
  u."area",
  u."floorLevel",
  u."rooms",
  u."livingArea",
  u."secondaryArea",
  u."rent" AS "unitRent",
  u."price" AS "unitPrice",
  u."operatingCost",
  u."deposit",
  u."availableFrom",
  u."noticePeriodMonths",
  u."hasElevator",
  u."hasBalcony",
  u."hasPatio",
  u."hasStorage",
  u."hasParking",
  u."furnished",
  u."accessible",
  u."petsAllowed",
  u."internetIncluded",
  u."tvIncluded",
  u."heatingIncluded",
  u."waterIncluded",
  u."electricityIncluded",
  u."shortTermAllowed",
  u."seniorHousing",
  u."studentHousing",
  p."name" AS "propertyName",
  p."energyClass",
  p."yearBuilt",
  media."items" AS "media",
  viewings."items" AS "viewings",
  lower(concat_ws(' ', l."title", u."address", u."area", u."city")) AS "searchText"
FROM public."Listing" l
JOIN public."Brand" b
  ON b."id" = l."brandId" AND b."status" = 'ACTIVE'
JOIN public."Unit" u ON u."id" = l."unitId"
JOIN public."Property" p ON p."id" = u."propertyId"
LEFT JOIN LATERAL (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', um."id",
        'kind', um."kind",
        'url', um."url",
        'caption', um."caption",
        'sortOrder', um."sortOrder"
      )
      ORDER BY um."sortOrder", um."createdAt", um."id"
    ),
    '[]'::jsonb
  ) AS "items"
  FROM public."UnitMedia" um
  WHERE um."unitId" = u."id"
) media ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', v."id",
        'kind', v."kind",
        'startsAt', v."startsAt",
        'endsAt', v."endsAt",
        'location', v."location",
        'maxAttendees', v."maxAttendees"
      )
      ORDER BY v."startsAt", v."id"
    ),
    '[]'::jsonb
  ) AS "items"
  FROM public."Viewing" v
  WHERE v."listingId" = l."id"
    AND v."startsAt" >= CURRENT_TIMESTAMP
) viewings ON true
WHERE l."status" = 'PUBLISHED'
  AND (l."publishAt" IS NULL OR l."publishAt" <= CURRENT_TIMESTAMP)
  AND (l."applicationDeadline" IS NULL OR l."applicationDeadline" >= CURRENT_TIMESTAMP);

REVOKE ALL ON public.published_listing_catalog FROM PUBLIC;
GRANT SELECT ON public.published_listing_catalog TO anon, authenticated;

CREATE VIEW public.published_listing_cities
WITH (security_barrier = true) AS
SELECT DISTINCT "brandSlug", "category", "city"
FROM public.published_listing_catalog;

REVOKE ALL ON public.published_listing_cities FROM PUBLIC;
GRANT SELECT ON public.published_listing_cities TO anon, authenticated;

CREATE VIEW public.upcoming_unit_catalog
WITH (security_barrier = true) AS
SELECT
  u."id",
  b."slug" AS "brandSlug",
  u."unitNumber",
  u."type" AS "unitType",
  u."address",
  u."postalCode",
  u."city",
  u."area",
  u."rooms",
  u."livingArea",
  u."availableFrom"
FROM public."Unit" u
JOIN public."Property" p
  ON p."id" = u."propertyId"
  AND p."status" IN ('ACTIVE', 'UNDER_RENOVATION')
JOIN public."Brand" b
  ON b."organizationId" = u."organizationId"
  AND b."isPrimary" = true
  AND b."status" = 'ACTIVE'
WHERE u."status" = 'UPCOMING';

REVOKE ALL ON public.upcoming_unit_catalog FROM PUBLIC;
GRANT SELECT ON public.upcoming_unit_catalog TO anon, authenticated;

CREATE VIEW public.public_property_catalog
WITH (security_barrier = true) AS
SELECT
  p."id",
  b."slug" AS "brandSlug",
  p."name",
  p."address",
  p."postalCode",
  p."city",
  p."municipality",
  p."yearBuilt",
  p."yearRenovated",
  p."energyClass",
  p."status",
  (
    SELECT count(*)::integer
    FROM public."Unit" u
    WHERE u."propertyId" = p."id" AND u."status" <> 'ARCHIVED'
  ) AS "unitCount"
FROM public."Property" p
JOIN public."Brand" b
  ON b."id" = p."brandId" AND b."status" = 'ACTIVE'
WHERE p."status" IN ('ACTIVE', 'UNDER_RENOVATION');

REVOKE ALL ON public.public_property_catalog FROM PUBLIC;
GRANT SELECT ON public.public_property_catalog TO anon, authenticated;

CREATE FUNCTION public.current_active_tenancy_summary()
RETURNS TABLE ("address" text, "city" text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT u."address", u."city"
  FROM public."ContractParty" cp
  JOIN public."Contract" c ON c."id" = cp."contractId"
  JOIN public."Unit" u ON u."id" = c."unitId"
  WHERE cp."personId" = public.current_app_person_id()
    AND cp."role" IN ('TENANT', 'CO_TENANT')
    AND c."status" = 'ACTIVE'
  ORDER BY c."activatedAt" DESC NULLS LAST, c."createdAt" DESC
  LIMIT 1
$function$;

CREATE FUNCTION public.current_person_has_active_application(p_listing_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public."ApplicationMember" am
    JOIN public."Application" a ON a."id" = am."applicationId"
    WHERE am."personId" = public.current_app_person_id()
      AND am."role" = 'MAIN_APPLICANT'
      AND a."listingId" = p_listing_id
      AND a."status" NOT IN ('CLOSED', 'WITHDRAWN', 'DECLINED')
  )
$function$;

CREATE FUNCTION public.current_person_contract_catalog(
  p_contract_id text DEFAULT NULL,
  p_statuses public."ContractStatus"[] DEFAULT NULL,
  p_roles public."ContractPartyRole"[] DEFAULT NULL
)
RETURNS TABLE ("payload" jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT jsonb_build_object(
    'id', c."id",
    'contractNumber', c."contractNumber",
    'type', c."type",
    'status', c."status",
    'startDate', c."startDate",
    'endDate', c."endDate",
    'noticePeriodMonths', c."noticePeriodMonths",
    'rent', c."rent",
    'deposit', c."deposit",
    'invoiceReference', c."invoiceReference",
    'terminationEffectiveDate', c."terminationEffectiveDate",
    'activatedAt', c."activatedAt",
    'createdAt', c."createdAt",
    'unit', jsonb_build_object(
      'id', u."id",
      'propertyId', u."propertyId",
      'unitNumber', u."unitNumber",
      'address', u."address",
      'postalCode', u."postalCode",
      'city', u."city",
      'rooms', u."rooms",
      'livingArea', u."livingArea",
      'property', jsonb_build_object('id', p."id", 'name', p."name")
    ),
    'parties', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', cp."id",
          'personId', cp."personId",
          'role', cp."role",
          'signedAt', cp."signedAt",
          'signatureMethod', cp."signatureMethod",
          'person', jsonb_build_object(
            'firstName', person."firstName",
            'lastName', person."lastName"
          )
        )
        ORDER BY cp."createdAt", cp."id"
      )
      FROM public."ContractParty" cp
      JOIN public."Person" person ON person."id" = cp."personId"
      WHERE cp."contractId" = c."id"
    ), '[]'::jsonb),
    'documents', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', d."id",
          'title', d."title",
          'type', d."type",
          'version', d."version",
          'signStatus', d."signStatus"
        )
        ORDER BY d."createdAt" DESC, d."id"
      )
      FROM public."Document" d
      WHERE d."contractId" = c."id" AND d."archivedAt" IS NULL
    ), '[]'::jsonb),
    'terminations', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', t."id",
          'status', t."status",
          'requestedAt', t."requestedAt",
          'effectiveEndDate', t."effectiveEndDate",
          'isInternalTransfer', t."isInternalTransfer"
        )
        ORDER BY t."requestedAt" DESC, t."id"
      )
      FROM public."Termination" t
      WHERE t."contractId" = c."id" AND t."status" <> 'CANCELLED'
    ), '[]'::jsonb)
  )
  FROM public."Contract" c
  JOIN public."Unit" u ON u."id" = c."unitId"
  JOIN public."Property" p ON p."id" = u."propertyId"
  WHERE (p_contract_id IS NULL OR c."id" = p_contract_id)
    AND (p_statuses IS NULL OR c."status" = ANY(p_statuses))
    AND EXISTS (
      SELECT 1
      FROM public."ContractParty" mine
      WHERE mine."contractId" = c."id"
        AND mine."personId" = public.current_app_person_id()
        AND (p_roles IS NULL OR mine."role" = ANY(p_roles))
    )
  ORDER BY c."createdAt" DESC, c."id"
$function$;

CREATE FUNCTION public.current_person_application_catalog(
  p_statuses public."ApplicationStatus"[] DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS TABLE ("payload" jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT jsonb_build_object(
    'id', a."id",
    'status', a."status",
    'submittedAt', a."submittedAt",
    'isInternalTransfer', a."isInternalTransfer",
    'createdAt', a."createdAt",
    'listing', jsonb_build_object(
      'id', l."id",
      'slug', l."slug",
      'title', l."title",
      'unit', jsonb_build_object(
        'address', u."address",
        'city', u."city"
      )
    ),
    'members', jsonb_build_array(
      jsonb_build_object(
        'personId', mine."personId",
        'role', mine."role"
      )
    ),
    'offers', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', o."id",
          'personId', o."personId",
          'status', o."status",
          'expiresAt', o."expiresAt",
          'respondedAt', o."respondedAt"
        )
        ORDER BY o."createdAt" DESC, o."id"
      )
      FROM public."Offer" o
      WHERE o."applicationId" = a."id"
        AND o."personId" = public.current_app_person_id()
    ), '[]'::jsonb)
  )
  FROM public."Application" a
  JOIN public."ApplicationMember" mine
    ON mine."applicationId" = a."id"
    AND mine."personId" = public.current_app_person_id()
  JOIN public."Listing" l ON l."id" = a."listingId"
  JOIN public."Unit" u ON u."id" = l."unitId"
  WHERE p_statuses IS NULL OR a."status" = ANY(p_statuses)
  ORDER BY a."createdAt" DESC, a."id"
  LIMIT LEAST(GREATEST(p_limit, 1), 200)
$function$;

CREATE FUNCTION public.current_person_upcoming_viewings(p_limit integer DEFAULT 3)
RETURNS TABLE (
  "id" text,
  "listingTitle" text,
  "startsAt" timestamp without time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT va."id", l."title", v."startsAt"
  FROM public."ViewingAttendee" va
  JOIN public."Viewing" v ON v."id" = va."viewingId"
  JOIN public."Listing" l ON l."id" = v."listingId"
  WHERE va."personId" = public.current_app_person_id()
    AND va."status" = 'BOOKED'
    AND v."startsAt" >= CURRENT_TIMESTAMP
  ORDER BY v."startsAt", va."id"
  LIMIT LEAST(GREATEST(p_limit, 1), 20)
$function$;

REVOKE ALL ON FUNCTION public.current_active_tenancy_summary() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_person_has_active_application(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_person_contract_catalog(text, public."ContractStatus"[], public."ContractPartyRole"[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_person_application_catalog(public."ApplicationStatus"[], integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_person_upcoming_viewings(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_active_tenancy_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_person_has_active_application(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_person_contract_catalog(text, public."ContractStatus"[], public."ContractPartyRole"[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_person_application_catalog(public."ApplicationStatus"[], integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_person_upcoming_viewings(integer) TO authenticated;

CREATE POLICY "invoice_status_event_owner_read"
ON public."InvoiceStatusEvent" FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."Invoice" i
    WHERE i."id" = "InvoiceStatusEvent"."invoiceId"
      AND i."personId" = public.current_app_person_id()
  )
);

CREATE POLICY "payment_allocation_owner_read"
ON public."PaymentAllocation" FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."Invoice" i
    WHERE i."id" = "PaymentAllocation"."invoiceId"
      AND i."personId" = public.current_app_person_id()
  )
);

CREATE POLICY "maintenance_status_event_owner_read"
ON public."MaintenanceStatusEvent" FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public."MaintenanceRequest" mr
    WHERE mr."id" = "MaintenanceStatusEvent"."requestId"
      AND mr."personId" = public.current_app_person_id()
  )
);

COMMIT;
