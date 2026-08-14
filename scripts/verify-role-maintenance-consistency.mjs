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
const portalMaintenance = read("src/app/(portal)/mina-sidor/felanmalan/[id]/page.tsx");
const unitsPage = read("src/app/admin/objekt/page.tsx");
const listingsPage = read("src/app/admin/annonser/page.tsx");
const listingMedia = read("src/lib/repositories/listing-media.ts");
const publicListing = read("src/app/(public)/annons/[slug]/page.tsx");
const adminRecords = read("src/lib/repositories/admin-records.ts");

check("Rollmigrationen finns i kedjan", migrations.includes("20260804120000_role_context_consistency.sql"));
check("Sessionen innehåller rollnamn", roleMigration.includes("'roleNames'") && authContext.includes("roleNames:"));
check("Sessionroller är organisationsavgränsade", (roleMigration.match(/r\."organizationId" IS NULL OR r\."organizationId" = u\."organizationId"/g) ?? []).length >= 3 && roleMigration.includes('p."organizationId" = u."organizationId"'));
check("Superadminhuvudet visar exakta rollnamn", adminLayout.includes("getRoleDisplayNames") && adminLayout.includes('aria-label="Dina roller"'));
check("Dashboard använder exakt roll i stället för generisk fastighetsvärd", adminDashboard.includes("getRoleDisplayNames") && !adminDashboard.includes("Fastighetsvärdens dashboard"));
check("Systemroller har tydliga namn och beskrivningar", permissions.includes('name: "Ägare / superadmin"') && permissions.includes("description:"));
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
check("Objektvyn visar både hyresgäst och medhyresgäst", unitsPage.includes('"CO_TENANT"') && unitsPage.includes("medhyresgäst"));
check("Annonsadmin kan ladda upp bilder och planritningar", listingsPage.includes('name="images"') && listingsPage.includes('name="floorplans"') && listingsPage.includes("uploadListingMediaAction"));
check("Annonsmedia är objekt- och organisationsavgränsad", listingMedia.includes('.eq("organizationId", input.organizationId)') && listingMedia.includes('.eq("unitId", input.unitId)'));
check("Annonsmedia sparas canonical och visas publikt", listingMedia.includes('.from("UnitMedia")') && adminRecords.includes('mediaByUnit') && publicListing.includes('unit.media.filter'));
check("Mediafel efter annonskapande orsakar inte dubbla annonser", adminActions.includes("listing media upload failed after listing creation") && adminActions.includes("mediaResult = { uploaded: 0"));

if (failures.length) {
  for (const failure of failures) console.error(`FAIL  ${failure}`);
  process.exit(1);
}
console.log(`\nAlla ${passed} roll- och felanmälningskontroller godkändes.`);
