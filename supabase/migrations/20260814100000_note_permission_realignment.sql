-- FaddeBo: återställ authenticated-grant för anteckningarnas RLS-hjälpfunktion.
--
-- `20260806190000_lock_function_grants.sql` låser funktionsytan genom att
-- återkalla EXECUTE från samtliga public-funktioner och därefter ge tillbaka
-- exakt de signaturer som fanns när den skrevs. `note_entity_permission`
-- tillkom senare, i `20260814094000_notes_and_media_lifecycle.sql`, och kan
-- därför inte stå i låsmigrationens lista – dess `to_regprocedure`-slinga
-- skulle fela på en ren databas eftersom funktionen inte finns ännu.
--
-- På en ren databas kör kedjan i versionsordning och grantet från
-- notes-migrationen står kvar; den här migrationen blir då en no-op. På den
-- befintliga databasen kördes låsmigrationen sist och tog bort grantet, och då
-- återställer den här migrationen det. Utan grantet kan `authenticated` inte
-- utvärdera policyn `note_staff_read`.

BEGIN;
SET LOCAL search_path = public, extensions;

DO $$
BEGIN
  IF to_regprocedure('public.note_entity_permission(public."NoteEntityType",text)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.note_entity_permission(public."NoteEntityType", text) FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.note_entity_permission(public."NoteEntityType", text) TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.note_entity_permission(public."NoteEntityType", text) TO service_role';
  END IF;
END
$$;

COMMIT;
