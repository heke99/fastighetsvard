import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const migrationDir = resolve(root, "supabase/migrations");
const migrationFiles = readdirSync(migrationDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();
const sql = migrationFiles
  .map((name) => readFileSync(resolve(migrationDir, name), "utf8"))
  .join("\n");

const failures = [];
let passCount = 0;
function check(label, condition) {
  if (!condition) failures.push(label);
  else {
    passCount += 1;
    console.log(`PASS  ${label}`);
  }
}

const definitions = new Set(
  [...sql.matchAll(/CREATE(?: OR REPLACE)? FUNCTION\s+public\.([A-Za-z0-9_]+)\s*\(/gi)]
    .map((match) => match[1].toLowerCase())
);
const calls = new Set(
  [...sql.matchAll(/public\.([A-Za-z0-9_]+)\s*\(/gi)]
    .map((match) => match[1].toLowerCase())
);
const missingFunctions = [...calls].filter((name) => !definitions.has(name)).sort();
check("Alla public-funktionsanrop i migrationskedjan har en definition", missingFunctions.length === 0);
if (missingFunctions.length) console.error(`Saknade funktioner: ${missingFunctions.join(", ")}`);

const accountMigrationName = "20260804090000_faddebo_account_lifecycle.sql";
const loginMigrationName = "20260804113000_login_dashboard_repair.sql";
const roleMigrationName = "20260804120000_role_context_consistency.sql";
check(
  "Canonical konto-, login- och rollkontextmigration finns i rätt ordning",
  migrationFiles.includes(accountMigrationName)
    && migrationFiles.includes(loginMigrationName)
    && migrationFiles.includes(roleMigrationName)
    && migrationFiles.indexOf(accountMigrationName) < migrationFiles.indexOf(loginMigrationName)
    && migrationFiles.indexOf(loginMigrationName) < migrationFiles.indexOf(roleMigrationName)
);
check("assert_service_role finns", definitions.has("assert_service_role"));
check("record_current_login finns", definitions.has("record_current_login"));
check("admin_dashboard_metrics finns", definitions.has("admin_dashboard_metrics"));
check("current_user_context finns", definitions.has("current_user_context"));

const authSource = readFileSync(resolve(root, "src/lib/auth.ts"), "utf8");
check(
  "Login-audit kan inte fälla en giltig session",
  authSource.includes("FaddeBo login audit update failed") && authSource.includes("return { user: profile, session: data.session }")
);

const adminSource = readFileSync(resolve(root, "src/lib/repositories/admin-records.ts"), "utf8");
check(
  "Admin-dashboard har query-fallback",
  adminSource.includes("getAdminDashboardMetricsFallback") && adminSource.includes("sumPaidInvoiceAmount")
);

const routingSource = readFileSync(resolve(root, "src/lib/role-routing.ts"), "utf8");
check(
  "Superadmin och fastighetsvärd går till admin",
  routingSource.includes('"superadmin"') && routingSource.includes('"property-manager"') && routingSource.includes('return "/admin"')
);
check(
  "Sökande och hyresgäster går till Mina sidor",
  routingSource.includes('return "/mina-sidor"') && routingSource.includes('role === "TENANT"')
);

if (failures.length) {
  for (const failure of failures) console.error(`FAIL  ${failure}`);
  process.exit(1);
}
console.log(`\nAlla ${passCount} login- och dashboardkontroller godkändes.`);