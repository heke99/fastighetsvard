-- FaddeBo brand separation and legal organization hardening.
-- Additive forward migration: do not fold this into an already-applied migration.

BEGIN;
SET LOCAL search_path = public, extensions;

CREATE TYPE public."BrandStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

ALTER TABLE public."Organization"
  ADD COLUMN "legalName" TEXT,
  ADD COLUMN "invoiceAddress" TEXT,
  ADD COLUMN "vatNumber" TEXT,
  ADD COLUMN "bankgiro" TEXT,
  ADD COLUMN "dataProtectionEmail" TEXT;

UPDATE public."Organization"
SET
  "legalName" = CASE
    WHEN "id" = '11111111-1111-4111-8111-111111111111'
      OR lower(trim("name")) IN ('östgöta el teknik', 'östgöta el teknik ab')
      THEN 'Östgöta El Teknik AB'
    ELSE "name"
  END,
  "orgNumber" = CASE
    WHEN "id" = '11111111-1111-4111-8111-111111111111'
      OR lower(trim("name")) IN ('östgöta el teknik', 'östgöta el teknik ab')
      THEN '559350-5620'
    ELSE "orgNumber"
  END,
  "dataProtectionEmail" = CASE
    WHEN "id" = '11111111-1111-4111-8111-111111111111'
      OR lower(trim("name")) IN ('östgöta el teknik', 'östgöta el teknik ab')
      THEN COALESCE("dataProtectionEmail", 'dataskydd@ostgotaelteknik.se')
    ELSE "dataProtectionEmail"
  END;

ALTER TABLE public."Organization"
  ALTER COLUMN "legalName" SET NOT NULL;

CREATE TABLE public."Brand" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "legalDisplayName" TEXT NOT NULL,
  "logoDocumentId" TEXT,
  "faviconDocumentId" TEXT,
  "primaryColor" TEXT NOT NULL DEFAULT '#1f4d3a',
  "secondaryColor" TEXT NOT NULL DEFAULT '#d7a84b',
  "supportEmail" TEXT,
  "supportPhone" TEXT,
  "websiteUrl" TEXT,
  "privacyPolicyUrl" TEXT,
  "termsUrl" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "status" public."BrandStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Brand_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Brand_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES public."Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Brand_logoDocumentId_fkey"
    FOREIGN KEY ("logoDocumentId") REFERENCES public."Document"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Brand_faviconDocumentId_fkey"
    FOREIGN KEY ("faviconDocumentId") REFERENCES public."Document"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Brand_slug_format_check"
    CHECK ("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT "Brand_primary_color_check"
    CHECK ("primaryColor" ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT "Brand_secondary_color_check"
    CHECK ("secondaryColor" ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE UNIQUE INDEX "Brand_organizationId_slug_key"
  ON public."Brand" ("organizationId", "slug");
CREATE UNIQUE INDEX "Brand_one_primary_per_organization_key"
  ON public."Brand" ("organizationId")
  WHERE "isPrimary" = true AND "status" = 'ACTIVE';
CREATE INDEX "Brand_organizationId_status_idx"
  ON public."Brand" ("organizationId", "status");

CREATE TRIGGER "Brand_set_updated_at"
BEFORE UPDATE ON public."Brand"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public."Brand" (
  "id", "organizationId", "name", "slug", "legalDisplayName",
  "supportEmail", "supportPhone", "privacyPolicyUrl", "termsUrl",
  "isPrimary", "status"
)
SELECT
  '22222222-2222-4222-8222-222222222222',
  o."id",
  'FaddeBo',
  'faddebo',
  'FaddeBo – ett varumärke inom Östgöta El Teknik AB, org.nr 559350-5620',
  COALESCE(o."email", 'info@faddebo.se'),
  o."phone",
  '/integritetspolicy',
  '/allmanna-villkor',
  true,
  'ACTIVE'
FROM public."Organization" o
WHERE (
    o."id" = '11111111-1111-4111-8111-111111111111'
    OR o."orgNumber" = '559350-5620'
    OR lower(trim(o."name")) IN ('östgöta el teknik', 'östgöta el teknik ab')
  )
  AND NOT EXISTS (
    SELECT 1 FROM public."Brand" b
    WHERE b."organizationId" = o."id" AND b."slug" = 'faddebo'
  )
ORDER BY (o."id" = '11111111-1111-4111-8111-111111111111') DESC
LIMIT 1;

-- Keep legacy/staging organizations valid without branding them as FaddeBo.
INSERT INTO public."Brand" (
  "organizationId", "name", "slug", "legalDisplayName",
  "supportEmail", "supportPhone", "isPrimary", "status"
)
SELECT
  o."id",
  o."name",
  'default-' || left(replace(o."id", '-', ''), 12),
  o."legalName",
  o."email",
  o."phone",
  true,
  'ACTIVE'
FROM public."Organization" o
WHERE NOT EXISTS (
  SELECT 1 FROM public."Brand" b
  WHERE b."organizationId" = o."id" AND b."isPrimary" = true AND b."status" = 'ACTIVE'
);

ALTER TABLE public."Property" ADD COLUMN "brandId" TEXT;
ALTER TABLE public."Listing" ADD COLUMN "brandId" TEXT;
ALTER TABLE public."Contract" ADD COLUMN "brandId" TEXT;
ALTER TABLE public."Invoice" ADD COLUMN "brandId" TEXT;
ALTER TABLE public."Document" ADD COLUMN "brandId" TEXT;
ALTER TABLE public."Message" ADD COLUMN "brandId" TEXT;
ALTER TABLE public."Notification" ADD COLUMN "brandId" TEXT;

UPDATE public."Property" x SET "brandId" = b."id"
FROM public."Brand" b
WHERE b."organizationId" = x."organizationId" AND b."isPrimary" AND b."status" = 'ACTIVE';
UPDATE public."Listing" x SET "brandId" = b."id"
FROM public."Brand" b
WHERE b."organizationId" = x."organizationId" AND b."isPrimary" AND b."status" = 'ACTIVE';
UPDATE public."Contract" x SET "brandId" = b."id"
FROM public."Brand" b
WHERE b."organizationId" = x."organizationId" AND b."isPrimary" AND b."status" = 'ACTIVE';
UPDATE public."Invoice" x SET "brandId" = b."id"
FROM public."Brand" b
WHERE b."organizationId" = x."organizationId" AND b."isPrimary" AND b."status" = 'ACTIVE';
UPDATE public."Document" x SET "brandId" = b."id"
FROM public."Brand" b
WHERE b."organizationId" = x."organizationId" AND b."isPrimary" AND b."status" = 'ACTIVE';
UPDATE public."Message" x SET "brandId" = b."id"
FROM public."Brand" b
WHERE b."organizationId" = x."organizationId" AND b."isPrimary" AND b."status" = 'ACTIVE';
UPDATE public."Notification" x SET "brandId" = b."id"
FROM public."Brand" b
WHERE b."organizationId" = x."organizationId" AND b."isPrimary" AND b."status" = 'ACTIVE';

CREATE FUNCTION public.assign_primary_brand()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NEW."brandId" IS NULL THEN
    SELECT b."id"
    INTO NEW."brandId"
    FROM public."Brand" b
    WHERE b."organizationId" = NEW."organizationId"
      AND b."isPrimary" = true
      AND b."status" = 'ACTIVE';
  ELSE
    PERFORM 1
    FROM public."Brand" b
    WHERE b."id" = NEW."brandId"
      AND b."organizationId" = NEW."organizationId"
      AND b."status" = 'ACTIVE';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'brand_organization_mismatch';
    END IF;
  END IF;

  IF NEW."brandId" IS NULL THEN
    RAISE EXCEPTION 'primary_brand_missing';
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.assign_primary_brand() FROM PUBLIC;

CREATE TRIGGER "Property_assign_primary_brand"
BEFORE INSERT ON public."Property"
FOR EACH ROW EXECUTE FUNCTION public.assign_primary_brand();
CREATE TRIGGER "Listing_assign_primary_brand"
BEFORE INSERT ON public."Listing"
FOR EACH ROW EXECUTE FUNCTION public.assign_primary_brand();
CREATE TRIGGER "Contract_assign_primary_brand"
BEFORE INSERT ON public."Contract"
FOR EACH ROW EXECUTE FUNCTION public.assign_primary_brand();
CREATE TRIGGER "Invoice_assign_primary_brand"
BEFORE INSERT ON public."Invoice"
FOR EACH ROW EXECUTE FUNCTION public.assign_primary_brand();
CREATE TRIGGER "Document_assign_primary_brand"
BEFORE INSERT ON public."Document"
FOR EACH ROW EXECUTE FUNCTION public.assign_primary_brand();
CREATE TRIGGER "Message_assign_primary_brand"
BEFORE INSERT ON public."Message"
FOR EACH ROW EXECUTE FUNCTION public.assign_primary_brand();
CREATE TRIGGER "Notification_assign_primary_brand"
BEFORE INSERT ON public."Notification"
FOR EACH ROW EXECUTE FUNCTION public.assign_primary_brand();

ALTER TABLE public."Property" ALTER COLUMN "brandId" SET NOT NULL;
ALTER TABLE public."Listing" ALTER COLUMN "brandId" SET NOT NULL;
ALTER TABLE public."Contract" ALTER COLUMN "brandId" SET NOT NULL;
ALTER TABLE public."Invoice" ALTER COLUMN "brandId" SET NOT NULL;
ALTER TABLE public."Document" ALTER COLUMN "brandId" SET NOT NULL;
ALTER TABLE public."Message" ALTER COLUMN "brandId" SET NOT NULL;
ALTER TABLE public."Notification" ALTER COLUMN "brandId" SET NOT NULL;

ALTER TABLE public."Property" ADD CONSTRAINT "Property_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES public."Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE public."Listing" ADD CONSTRAINT "Listing_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES public."Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE public."Contract" ADD CONSTRAINT "Contract_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES public."Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE public."Invoice" ADD CONSTRAINT "Invoice_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES public."Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE public."Document" ADD CONSTRAINT "Document_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES public."Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE public."Message" ADD CONSTRAINT "Message_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES public."Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE public."Notification" ADD CONSTRAINT "Notification_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES public."Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Property_brandId_idx" ON public."Property" ("brandId");
CREATE INDEX "Listing_brandId_status_idx" ON public."Listing" ("brandId", "status");
CREATE INDEX "Contract_brandId_status_idx" ON public."Contract" ("brandId", "status");
CREATE INDEX "Invoice_brandId_status_idx" ON public."Invoice" ("brandId", "status");
CREATE INDEX "Document_brandId_type_idx" ON public."Document" ("brandId", "type");

ALTER TABLE public."Brand" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_public_active_read" ON public."Brand"
FOR SELECT TO anon
USING ("status" = 'ACTIVE' AND "isPrimary" = true);

CREATE POLICY "brand_authenticated_read" ON public."Brand"
FOR SELECT TO authenticated
USING (
  ("status" = 'ACTIVE' AND "isPrimary" = true)
  OR "organizationId" = public.current_app_organization_id()
);

CREATE POLICY "brand_staff_insert" ON public."Brand"
FOR INSERT TO authenticated
WITH CHECK (
  "organizationId" = public.current_app_organization_id()
  AND public.app_has_permission('settings:create')
);

CREATE POLICY "brand_staff_update" ON public."Brand"
FOR UPDATE TO authenticated
USING (
  "organizationId" = public.current_app_organization_id()
  AND public.app_has_permission('settings:update')
)
WITH CHECK (
  "organizationId" = public.current_app_organization_id()
  AND public.app_has_permission('settings:update')
);

GRANT SELECT ON public."Brand" TO anon, authenticated;
GRANT INSERT, UPDATE ON public."Brand" TO authenticated;

COMMIT;
