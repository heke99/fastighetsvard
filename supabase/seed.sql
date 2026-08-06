-- Safe canonical baseline data. No demo users or passwords are created.
-- The role catalogue must stay aligned with src/lib/permissions.ts and the
-- production migration 20260804090000_faddebo_account_lifecycle.sql.

INSERT INTO public."Organization" (
  "id", "name", "legalName", "orgNumber", "email", "dataProtectionEmail", "updatedAt"
)
VALUES (
  '11111111-1111-4111-8111-111111111111',
  'Östgöta El Teknik',
  'Östgöta El Teknik AB',
  '559350-5620',
  'info@faddebo.se',
  'info@faddebo.se',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "legalName" = EXCLUDED."legalName",
  "orgNumber" = EXCLUDED."orgNumber",
  "email" = EXCLUDED."email",
  "dataProtectionEmail" = EXCLUDED."dataProtectionEmail",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO public."Brand" (
  "id", "organizationId", "name", "slug", "legalDisplayName", "supportEmail",
  "privacyPolicyUrl", "termsUrl", "isPrimary", "status", "updatedAt"
)
VALUES (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'FaddeBo',
  'faddebo',
  'FaddeBo – ett varumärke inom Östgöta El Teknik AB, org.nr 559350-5620',
  'info@faddebo.se',
  '/integritetspolicy',
  '/allmanna-villkor',
  true,
  'ACTIVE',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
  "organizationId" = EXCLUDED."organizationId",
  "name" = EXCLUDED."name",
  "slug" = EXCLUDED."slug",
  "legalDisplayName" = EXCLUDED."legalDisplayName",
  "supportEmail" = EXCLUDED."supportEmail",
  "privacyPolicyUrl" = EXCLUDED."privacyPolicyUrl",
  "termsUrl" = EXCLUDED."termsUrl",
  "isPrimary" = true,
  "status" = 'ACTIVE',
  "updatedAt" = CURRENT_TIMESTAMP;

-- Keep the catalogue inside the same DO statement. Supabase CLI may execute
-- seed statements in separate batches, so a temporary table is not reliable.
DO $seed_roles$
DECLARE
  v_seed record;
  v_role_id text;
BEGIN
  FOR v_seed IN
    SELECT *
    FROM (VALUES
      ('superadmin', 'Ägare / superadmin', 'Full ägarbehörighet i hela FaddeBo.', ARRAY['*']::text[]),
      ('org-admin', 'Bolagsadmin', 'Administrerar bolagets användare och samtliga verksamhetsflöden.', ARRAY[
        'persons:*','users:*','roles:*','properties:*','buildings:*','units:*','listings:*',
        'applications:*','viewings:*','offers:*','contracts:*','terminations:*','inspections:*',
        'invoices:*','payments:*','maintenance:*','workorders:*','suppliers:*','documents:*',
        'messages:*','notifications:*','integrations:*','webhooks:*','apikeys:*','imports:*',
        'reports:*','audit:read','settings:*'
      ]::text[]),
      ('property-owner', 'Fastighetsägare', 'Läs- och rapportbehörighet för fastighetsägare.', ARRAY[
        'properties:read','buildings:read','units:read','listings:read','contracts:read',
        'invoices:read','payments:read','reports:*','maintenance:read','workorders:read','audit:read'
      ]::text[]),
      ('property-manager', 'Fastighetsvärd / förvaltare', 'Operativ helhetsbehörighet för uthyrning och förvaltning.', ARRAY[
        'persons:*','properties:*','buildings:*','units:*','listings:*','applications:*',
        'viewings:*','offers:*','contracts:*','terminations:*','inspections:*','maintenance:*',
        'workorders:*','suppliers:*','documents:*','messages:*','invoices:read','payments:read',
        'imports:*','reports:read'
      ]::text[]),
      ('caretaker', 'Kvartersvärd', 'Boendeservice, felanmälningar och arbetsorder.', ARRAY[
        'properties:read','buildings:read','units:read','maintenance:*','workorders:*',
        'messages:*','persons:read','documents:read'
      ]::text[]),
      ('leasing-agent', 'Uthyrare', 'Annonser, ansökningar, visningar, erbjudanden och avtal.', ARRAY[
        'persons:*','units:read','units:update','listings:*','applications:*','viewings:*',
        'offers:*','contracts:*','documents:*','messages:*','reports:read'
      ]::text[]),
      ('sales-manager', 'Försäljningsansvarig', 'Försäljning och kommersiella objekt.', ARRAY[
        'persons:read','units:read','units:update','listings:*','viewings:*','offers:*',
        'contracts:*','documents:*','messages:*','reports:read'
      ]::text[]),
      ('finance', 'Ekonom', 'Fakturor, betalningar, integrationer och ekonomirapporter.', ARRAY[
        'persons:read','contracts:read','invoices:*','payments:*','integrations:*','reports:*','audit:read'
      ]::text[]),
      ('customer-service', 'Kundtjänst', 'Kundservice, ärenden, meddelanden och läsbehörighet.', ARRAY[
        'persons:read','persons:update','units:read','listings:read','applications:read',
        'applications:update','contracts:read','invoices:read','maintenance:*','messages:*','documents:read'
      ]::text[]),
      ('facility-worker', 'Fastighetsskötare', 'Utför och uppdaterar felanmälningar och arbetsorder.', ARRAY[
        'maintenance:read','maintenance:update','workorders:read','workorders:update','units:read'
      ]::text[]),
      ('inspector', 'Besiktningsman', 'Besiktningar och tillhörande dokument.', ARRAY[
        'inspections:*','units:read','contracts:read','documents:create','documents:read'
      ]::text[]),
      ('contractor', 'Entreprenör', 'Ser och uppdaterar endast leverantörens egna arbetsorder.', ARRAY[
        'workorders:read','workorders:update'
      ]::text[]),
      ('report-viewer', 'Rapportläsare', 'Läsbehörighet till rapporter.', ARRAY['reports:read']::text[])
    ) AS seed(slug, name, description, permissions)
    ORDER BY slug
  LOOP
    INSERT INTO public."Role" (
      "id", "organizationId", "name", "slug", "description", "isSystem", "updatedAt"
    ) VALUES (
      gen_random_uuid()::text,
      NULL,
      v_seed.name,
      v_seed.slug,
      v_seed.description,
      true,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("slug") WHERE "organizationId" IS NULL
    DO UPDATE SET
      "name" = EXCLUDED."name",
      "description" = EXCLUDED."description",
      "isSystem" = true,
      "updatedAt" = CURRENT_TIMESTAMP;

    SELECT "id"
    INTO v_role_id
    FROM public."Role"
    WHERE "organizationId" IS NULL
      AND "slug" = v_seed.slug;

    DELETE FROM public."RolePermission" rp
    WHERE rp."roleId" = v_role_id
      AND NOT (rp."permission" = ANY(v_seed.permissions));

    INSERT INTO public."RolePermission" ("roleId", "permission")
    SELECT v_role_id, permission
    FROM unnest(v_seed.permissions) AS permission
    ON CONFLICT ("roleId", "permission") DO NOTHING;
  END LOOP;
END
$seed_roles$;