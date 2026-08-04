-- Bakåtkompatibelt filnamn.
-- Använd i första hand 01_CREATE_FADDEBO_OWNER.sql.
-- Kör först 00_REPAIR_FADDEBO_AUTH_SCHEMA.sql och skapa/bekräfta Auth-kontot.

SELECT public.bootstrap_faddebo_owner(
  'info@faddebo.se',
  'Fadi',
  'El-Hessi'
) AS owner_result;
