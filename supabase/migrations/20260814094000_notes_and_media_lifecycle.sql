-- FaddeBo: internal notes and a complete media lifecycle.
--
-- 1. `Note` is the canonical place for internal administrative annotations on
--    the domain objects staff actually work with. It is intentionally a single
--    table with a constrained entity enum rather than one note table per
--    domain: the write path is identical everywhere, and the enum keeps the
--    polymorphic reference readable in RLS.
--    Notes are internal by default and are never exposed on any tenant or
--    applicant surface.
--
-- 2. `UnitMedia."storageKey"` records the object path inside the
--    `listing-media` bucket. Media rows previously stored only the public URL,
--    so deleting an image could not reliably delete the stored object, and
--    every deletion would have leaked a file in Storage.

BEGIN;
SET LOCAL search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Media lifecycle
-- ---------------------------------------------------------------------------

ALTER TABLE public."UnitMedia" ADD COLUMN IF NOT EXISTS "storageKey" TEXT;

-- Existing rows were written as `<publicUrl>/storage/v1/object/public/listing-media/<key>`.
UPDATE public."UnitMedia"
SET "storageKey" = split_part("url", '/storage/v1/object/public/listing-media/', 2)
WHERE "storageKey" IS NULL
  AND "url" LIKE '%/storage/v1/object/public/listing-media/%';

CREATE UNIQUE INDEX IF NOT EXISTS "UnitMedia_storageKey_key"
  ON public."UnitMedia"("storageKey")
  WHERE "storageKey" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Notes
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'NoteEntityType') THEN
    CREATE TYPE public."NoteEntityType" AS ENUM (
      'PROPERTY', 'UNIT', 'LISTING', 'PERSON', 'APPLICATION',
      'CONTRACT', 'MAINTENANCE_REQUEST', 'WORK_ORDER'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public."Note" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "organizationId" TEXT NOT NULL,
  "entityType" public."NoteEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "isInternal" BOOLEAN NOT NULL DEFAULT true,
  "authorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "Note_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Note_body_not_blank" CHECK (btrim("body") <> '' AND length("body") <= 8000),
  CONSTRAINT "Note_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES public."Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "Note_authorUserId_fkey" FOREIGN KEY ("authorUserId")
    REFERENCES public."User"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "Note_entity_idx"
  ON public."Note"("organizationId", "entityType", "entityId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Note_authorUserId_idx" ON public."Note"("authorUserId");

DROP TRIGGER IF EXISTS "Note_set_updated_at" ON public."Note";
CREATE TRIGGER "Note_set_updated_at"
  BEFORE UPDATE ON public."Note"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public."Note" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Note" FORCE ROW LEVEL SECURITY;

-- A note is readable by staff who may read the annotated object. Tenants and
-- applicants hold none of these permissions, so an internal note can never
-- surface in the portal even if a future query forgets to filter.
CREATE OR REPLACE FUNCTION public.note_entity_permission(p_entity public."NoteEntityType", p_action text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $fn$
  SELECT public.app_has_permission(
    CASE p_entity
      WHEN 'PROPERTY' THEN 'properties:'
      WHEN 'UNIT' THEN 'units:'
      WHEN 'LISTING' THEN 'listings:'
      WHEN 'PERSON' THEN 'persons:'
      WHEN 'APPLICATION' THEN 'applications:'
      WHEN 'CONTRACT' THEN 'contracts:'
      WHEN 'MAINTENANCE_REQUEST' THEN 'maintenance:'
      WHEN 'WORK_ORDER' THEN 'workorders:'
    END || p_action
  );
$fn$;

REVOKE ALL ON FUNCTION public.note_entity_permission(public."NoteEntityType", text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.note_entity_permission(public."NoteEntityType", text) TO authenticated;

CREATE POLICY "note_staff_read" ON public."Note"
  FOR SELECT TO authenticated
  USING (
    "deletedAt" IS NULL
    AND "organizationId" = public.current_app_organization_id()
    AND public.note_entity_permission("entityType", 'read')
  );

GRANT SELECT ON public."Note" TO authenticated;

COMMIT;
