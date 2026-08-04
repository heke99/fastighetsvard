-- FaddeBo owner/auth schema repair.
-- Repairs legacy Prisma columns that conflict with Supabase Auth and restores
-- timestamp defaults required by every account provisioning path.

BEGIN;
SET LOCAL search_path = public, auth, extensions, pg_temp;

-- A legacy database may still require public."User"."passwordHash" even though
-- authentication is now exclusively managed by Supabase Auth. Keeping that
-- column NOT NULL breaks owner bootstrap, verified signup, invitations and
-- staff provisioning. Preserve existing values, but make the column optional.
DO $legacy_user$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'User'
      AND column_name = 'passwordHash'
  ) THEN
    ALTER TABLE public."User" ALTER COLUMN "passwordHash" DROP NOT NULL;
    ALTER TABLE public."User" ALTER COLUMN "passwordHash" DROP DEFAULT;
    COMMENT ON COLUMN public."User"."passwordHash" IS
      'Legacy only. Passwords are managed by Supabase Auth; application code must not read or write this value.';
  END IF;
END
$legacy_user$;

-- Some older installations lost Prisma timestamp defaults. Restore them for
-- every public table that has canonical createdAt/updatedAt columns.
DO $timestamp_defaults$
DECLARE
  column_record record;
BEGIN
  FOR column_record IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name = c.table_name
     AND t.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public'
      AND c.column_name IN ('createdAt', 'updatedAt')
      AND c.data_type IN ('timestamp without time zone', 'timestamp with time zone')
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN %I SET DEFAULT CURRENT_TIMESTAMP',
      column_record.table_name,
      column_record.column_name
    );
  END LOOP;
END
$timestamp_defaults$;

-- Ensure a default organization exists before an Auto Confirm Auth user is
-- created. The verified-signup trigger requires this row.
DO $default_organization$
DECLARE
  v_organization_id text;
BEGIN
  SELECT "id"
  INTO v_organization_id
  FROM public."Organization"
  WHERE "orgNumber" = '559350-5620'
  ORDER BY "createdAt", "id"
  LIMIT 1
  FOR UPDATE;

  IF v_organization_id IS NULL THEN
    SELECT "id"
    INTO v_organization_id
    FROM public."Organization"
    ORDER BY "createdAt", "id"
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_organization_id IS NULL THEN
    INSERT INTO public."Organization" (
      "id", "name", "legalName", "orgNumber", "email",
      "dataProtectionEmail", "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid()::text,
      'Östgöta El Teknik',
      'Östgöta El Teknik AB',
      '559350-5620',
      'info@faddebo.se',
      'info@faddebo.se',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
  END IF;
END
$default_organization$;

-- Canonical FaddeBo contact details. Legal company information remains intact.
UPDATE public."Organization"
SET
  "email" = 'info@faddebo.se',
  "dataProtectionEmail" = 'info@faddebo.se',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "orgNumber" = '559350-5620'
   OR "legalName" = 'Östgöta El Teknik AB'
   OR lower(COALESCE("email", '')) IN (
     ('info@' || 'ostgotaelteknik.se'),
     ('admin@' || 'ostgotaelteknik.se'),
     ('dataskydd@' || 'ostgotaelteknik.se')
   );

UPDATE public."Brand"
SET
  "supportEmail" = 'info@faddebo.se',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'faddebo'
   OR lower(COALESCE("supportEmail", '')) LIKE '%@ostgotaelteknik.se';

UPDATE public."Listing"
SET
  "contactEmail" = 'info@faddebo.se',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE lower(COALESCE("contactEmail", '')) IN (
  ('info@' || 'ostgotaelteknik.se'),
  ('admin@' || 'ostgotaelteknik.se'),
  ('dataskydd@' || 'ostgotaelteknik.se')
);

COMMIT;
