-- FaddeBo: database-level guards for destructive deletes.
--
-- Property -> Unit -> Contract are chained with ON DELETE CASCADE. Deleting a
-- single property therefore removed every unit below it and, with them, signed
-- and active lease contracts, their versions, signatures and move-in/move-out
-- cases. No amount of care in the application layer can make that safe, because
-- the cascade happens inside PostgreSQL.
--
-- These triggers make the invariant part of the schema: a lease that has left
-- DRAFT is legal history and cannot be deleted, directly or through a cascade.
-- Ending a tenancy is done through the termination and move-out flow, which
-- keeps the record.

BEGIN;
SET LOCAL search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.reject_legal_contract_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF OLD."status" <> 'DRAFT' THEN
    RAISE EXCEPTION 'contract_delete_forbidden'
      USING ERRCODE = '42501',
            DETAIL = format('Contract %s has status %s and is legal history.', OLD."id", OLD."status");
  END IF;
  RETURN OLD;
END;
$fn$;

DROP TRIGGER IF EXISTS "Contract_reject_legal_delete" ON public."Contract";
CREATE TRIGGER "Contract_reject_legal_delete"
  BEFORE DELETE ON public."Contract"
  FOR EACH ROW EXECUTE FUNCTION public.reject_legal_contract_delete();

-- A unit that has ever carried a contract keeps its history. The clear error
-- here is preferable to the cascade failing several levels down.
CREATE OR REPLACE FUNCTION public.reject_occupied_unit_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public."Contract" c
    WHERE c."unitId" = OLD."id" AND c."status" <> 'DRAFT'
  ) THEN
    RAISE EXCEPTION 'unit_delete_forbidden_contract_history'
      USING ERRCODE = '42501',
            DETAIL = format('Unit %s has contract history.', OLD."id");
  END IF;
  RETURN OLD;
END;
$fn$;

DROP TRIGGER IF EXISTS "Unit_reject_occupied_delete" ON public."Unit";
CREATE TRIGGER "Unit_reject_occupied_delete"
  BEFORE DELETE ON public."Unit"
  FOR EACH ROW EXECUTE FUNCTION public.reject_occupied_unit_delete();

REVOKE ALL ON FUNCTION public.reject_legal_contract_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_occupied_unit_delete() FROM PUBLIC, anon, authenticated;

COMMIT;
