import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");
const failures = [];
let passed = 0;
function check(label, condition) {
  if (condition) {
    passed += 1;
    console.log(`PASS  ${label}`);
  } else failures.push(label);
}

const migrations = readdirSync(resolve(root, "supabase/migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort();
const roleMigration = read("supabase/migrations/20260804120000_role_context_consistency.sql");
const idempotencyMigration = read("supabase/migrations/20260806143000_idempotency_outcome_hardening.sql");
const seed = read("supabase/seed.sql");
const schemaVerification = read("supabase/tests/verify_schema.sql");
const permissions = read("src/lib/permissions.ts");
const authContext = read("src/lib/repositories/auth-context.ts");
const adminLayout = read("src/app/admin/layout.tsx");
const adminDashboard = read("src/app/admin/page.tsx");
const usersPage = read("src/app/admin/anvandare/page.tsx");
const tenantsPage = read("src/app/admin/hyresgaster/page.tsx");
const adminActions = read("src/app/admin/actions.ts");
const adminOperations = read("src/lib/repositories/admin-operations.ts");
const roleRouting = read("src/lib/role-routing.ts");
const roleRoutingTests = read("tests/role-routing.test.ts");
const adminNav = read("src/app/admin/AdminNav.tsx");
const portalNav = read("src/app/(portal)/mina-sidor/PortalNav.tsx");
const maintenanceAction = read("src/app/(portal)/mina-sidor/felanmalan/ny/actions.ts");
const maintenanceService = read("src/lib/services/maintenance.ts");
const maintenanceFiles = read("src/lib/repositories/maintenance-files.ts");
const adminMaintenance = read("src/app/admin/felanmalan/page.tsx");
const portalMaintenanceList = read("src/app/(portal)/mina-sidor/felanmalan/page.tsx");
const portalMaintenance = read("src/app/(portal)/mina-sidor/felanmalan/[id]/page.tsx");
const statusLabels = read("src/lib/status-labels.ts");
const statusBadges = read("src/components/StatusBadges.tsx");
const email = read("src/lib/email.ts");
const statusLabelTests = read("tests/status-labels.test.ts");
const apiHelpers = read("src/lib/api/helpers.ts");
const idempotencyTests = read("tests/idempotency-hardening.test.ts");
const branding = read("src/lib/branding.ts");
const brandingTests = read("tests/branding.test.ts");
const envExample = read(".env.example");
const unitsPage = read("src/app/admin/objekt/page.tsx");
const listingsPage = read("src/app/admin/annonser/page.tsx");
const listingMedia = read("src/lib/repositories/listing-media.ts");
const publicListing = read("src/app/(public)/annons/[slug]/page.tsx");
const adminRecords = read("src/lib/repositories/admin-records.ts");

check("Canonical rollmigration finns i ordnad historik", migrations.includes("20260804120000_role_context_consistency.sql") && migrations.indexOf("20260804120000_role_context_consistency.sql") < migrations.indexOf("20260806143000_idempotency_outcome_hardening.sql"));
check("Sessionen innehåller rollnamn", roleMigration.includes("'roleNames'") && authContext.includes("roleNames:"));
check("Sessionroller är organisationsavgränsade", (roleMigration.match(/r\."organizationId" IS NULL OR r\."organizationId" = u\."organizationId"/g) ?? []).length >= 3 && roleMigration.includes('p."organizationId" = u."organizationId"'));
check("Superadminhuvudet visar exakta rollnamn", adminLayout.includes("getRoleDisplayNames") && adminLayout.includes('aria-label="Dina roller"'));
check("Dashboard använder exakt roll i stället för generisk fastighetsvärd", adminDashboard.includes("getRoleDisplayNames") && !adminDashboard.includes("Fastighetsvärdens dashboard"));
check("Systemroller har tydliga namn och beskrivningar", permissions.includes('name: "Ägare / superadmin"') && permissions.includes("description:"));
check("Seed använder samma superadminnamn som applikationen", seed.includes("'superadmin', 'Ägare / superadmin'") && !seed.includes("'Superadmin','superadmin'"));
check("Seed synkar exakta rollbehörigheter", seed.includes("DELETE FROM public.\"RolePermission\"") && seed.includes("NOT (rp.\"permission\" = ANY(v_seed.permissions))"));
check("Databastest verifierar rollmetadata och behörigheter", schemaVerification.includes("Canonical system role metadata mismatch") && schemaVerification.includes("Canonical system role permissions mismatch"));
check("Användarsidan skiljer personalroll och personroll", usersPage.includes("Personalroll") && usersPage.includes("Personroll") && usersPage.includes("getPersonRoleLabels"));
check("Personlistor visar personalroller", tenantsPage.includes("p.user?.staffRoles") && tenantsPage.includes("Personalroll"));
check("Egna roller kräver beskrivning och validerade behörigheter", usersPage.includes('name="description"') && adminActions.includes("isValidPermission") && roleMigration.includes("invalid_permission"));
check("Rollskapande verifierar aktiv aktör och roles:create i databasen", roleMigration.includes("role_actor_forbidden") && roleMigration.includes(`rp."permission" IN ('*', 'roles:*', 'roles:create')`) && adminOperations.includes("role_actor_forbidden"));
check("Egna personalroller leds till administration", roleRouting.includes('role !== "contractor" && role !== "tenant"') && roleRoutingTests.includes("organization-specific custom roles"));
check("Fullständig egen roll kräver superadmin", adminActions.includes('permissions.includes("*")') && roleMigration.includes("privileged_role_assignment_denied") && adminOperations.includes("privileged_role_assignment_denied"));
check("Personalrollnamn filtreras till global eller aktuell organisation", adminRecords.includes('select("id,organizationId,name,slug")') && adminRecords.includes("row.organizationId === null || String(row.organizationId) === organizationId"));
check("Hyresgästknappar är behörighetsstyrda", tenantsPage.includes("canImport") && tenantsPage.includes("canCreateTenant") && tenantsPage.includes("canInvite"));
check("Avstängda portalkonton visas korrekt", tenantsPage.includes("Avstängt konto") && tenantsPage.includes("p.user.isActive"));
check("Felanmälan finns i båda sidomenyerna", adminNav.includes('/admin/felanmalan') && portalNav.includes('/mina-sidor/felanmalan'));
check("Felanmälan sparas före bilagehantering", maintenanceAction.indexOf("createMaintenanceRequest(") < maintenanceAction.indexOf("uploadMaintenanceFiles({"));
check("Bilagor valideras och kopplas till felanmälan", maintenanceFiles.includes("validateMaintenanceFiles") && maintenanceFiles.includes("maintenanceRequestId"));
check("Bilagor kräver rätt organisation och anmälare", maintenanceFiles.includes('.eq("organizationId", input.organizationId)') && maintenanceFiles.includes('.eq("personId", input.personId)'));
check("Felanmälan skickar intern och hyresgäst-e-post", maintenanceService.includes("sendMaintenanceInternalAlertEmail") && maintenanceService.includes("sendMaintenanceReceiptEmail"));
check("Eftereffekter kan inte rulla tillbaka portalärendet", maintenanceService.includes("runPostCommitEffects") && maintenanceService.includes("Promise.allSettled") && maintenanceService.includes("created webhook"));
check("Bilagor syns för både personal och hyresgäst", adminMaintenance.includes("r.attachments") && portalMaintenance.includes("request.attachments"));
check("Felanmälans statusnamn har en canonical källa", statusLabels.includes("maintenanceStatusLabels") && statusBadges.includes("getMaintenanceStatusLabel") && email.includes("getMaintenanceStatusLabel"));
check("Personal och hyresgäst får korrekt målgruppstext", statusLabels.includes('WAITING_TENANT: "Väntar på hyresgäst"') && statusLabels.includes('return "Väntar på dig"'));
check("Hyresgästportalens statusytor markerar tenant audience", portalMaintenanceList.includes('audience="tenant"') && (portalMaintenance.match(/audience="tenant"/g) ?? []).length >= 2);
check("Statusnamn har typad regressionstäckning", statusLabelTests.includes("covers every canonical maintenance status") && statusLabelTests.includes('"WAITING_TENANT"'));
check("Osäkra idempotensutfall kan inte köras om automatiskt", idempotencyMigration.includes("operation_outcome_uncertain") && idempotencyMigration.includes("mark_idempotent_operation_uncertain"));
check("API skiljer domänfel från osäkert kvitto", apiHelpers.includes('client.rpc("fail_idempotent_operation"') && apiHelpers.includes('client.rpc("mark_idempotent_operation_uncertain"') && apiHelpers.indexOf('client.rpc("complete_idempotent_operation"') < apiHelpers.indexOf('client.rpc("mark_idempotent_operation_uncertain"'));
check("Idempotenshärdning har regressionstest", idempotencyTests.includes("cannot be claimed for automatic replay") && idempotencyTests.includes("Skicka inte om operationen med en ny nyckel"));
check("Brandingfallback matchar dokumenterad driftkonfiguration", branding.includes('value("BRAND_TAGLINE", "Tryggt boende")') && branding.includes('value("BRAND_PHONE", "070-065 06 90")') && branding.includes('"Vasavägen 19, 595 40 Mjölby"'));
check("Miljöexemplet annonserar inte ignorerade e-postvariabler", !envExample.includes("SUPPORT_EMAIL=") && envExample.includes("Kontaktadresserna är canonical i src/lib/branding.ts"));
check("Brandingens canonical värden är testlåsta", brandingTests.includes('expect(brand.tagline).toBe("Tryggt boende")') && brandingTests.includes("keeps canonical contact addresses"));
check("Objektvyn visar både hyresgäst och medhyresgäst", unitsPage.includes('"CO_TENANT"') && unitsPage.includes("medhyresgäst"));
check("Annonsadmin kan ladda upp bilder och planritningar", listingsPage.includes('name="images"') && listingsPage.includes('name="floorplans"') && listingsPage.includes("uploadListingMediaAction"));
check("Annonsmedia är objekt- och organisationsavgränsad", listingMedia.includes('.eq("organizationId", input.organizationId)') && listingMedia.includes('.eq("unitId", input.unitId)'));
check("Annonsmedia sparas canonical och visas publikt", listingMedia.includes('.from("UnitMedia")') && adminRecords.includes('mediaByUnit') && publicListing.includes('unit.media.filter'));
check("Mediafel efter annonskapande orsakar inte dubbla annonser", adminActions.includes("listing media upload failed after listing creation") && adminActions.includes("mediaResult = { uploaded: 0"));

if (failures.length) {
  for (const failure of failures) console.error(`FAIL  ${failure}`);
  process.exit(1);
}
console.log(`\nAlla ${passed} systemkonsekvenskontroller godkändes.`);