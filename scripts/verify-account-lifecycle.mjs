import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");
const failures = [];
const passes = [];

function check(name, condition, details = "") {
  if (condition) passes.push(name);
  else failures.push(`${name}${details ? `: ${details}` : ""}`);
}

function containsAll(path, values) {
  const source = read(path);
  return values.every((value) => source.includes(value));
}

const requiredRoutes = [
  "src/app/(public)/skapa-konto/page.tsx",
  "src/app/(public)/logga-in/page.tsx",
  "src/app/(public)/glomt-losenord/page.tsx",
  "src/app/(public)/aterstall-losenord/page.tsx",
  "src/app/(public)/auth/callback/route.ts",
  "src/app/(portal)/mina-sidor/page.tsx",
  "src/app/admin/page.tsx",
  "src/app/admin/anvandare/page.tsx",
];
check("Konto- och dashboardroutes finns", requiredRoutes.every((path) => existsSync(resolve(root, path))));

const migrationPath = "supabase/migrations/20260804090000_faddebo_account_lifecycle.sql";
check("Canonical kontomigration finns", existsSync(resolve(root, migrationPath)));
check(
  "Canonical migration innehåller hela kontolivscykeln",
  containsAll(migrationPath, [
    'ALTER COLUMN "passwordHash" DROP NOT NULL',
    "drop_legacy_auth_user_triggers",
    "FUNCTION public.provision_verified_self_signup",
    "FUNCTION public.provision_staff_user",
    "FUNCTION public.bootstrap_faddebo_owner",
    "'superadmin', 'Ägare / superadmin'",
    "'org-admin', 'Bolagsadmin'",
    "'property-manager', 'Fastighetsvärd / förvaltare'",
    "info@faddebo.se",
  ])
);

check(
  "Manuell SQL-installation finns",
  [
    "supabase/manual/00_REPAIR_FADDEBO_AUTH_SCHEMA.sql",
    "supabase/manual/01_CREATE_FADDEBO_OWNER.sql",
    "supabase/manual/02_VERIFY_FADDEBO_AUTH_AND_OWNER.sql",
  ].every((path) => existsSync(resolve(root, path)))
);
check(
  "Owner-SQL använder canonical RPC",
  containsAll("supabase/manual/01_CREATE_FADDEBO_OWNER.sql", [
    "bootstrap_faddebo_owner",
    "permission = *",
  ])
);
check(
  "Verifierings-SQL kontrollerar konto, trigger, roller och owner",
  containsAll("supabase/manual/02_VERIFY_FADDEBO_AUTH_AND_OWNER.sql", [
    "legacy_password_hash_nullable",
    "no_legacy_auth_user_triggers",
    "verified_signup_trigger",
    "required_system_roles",
    "owner_access",
    "canonical_contact_addresses",
  ])
);

check(
  "Publik registrering kräver e-postverifiering",
  containsAll("src/lib/services/accounts.ts", ["auth.signUp", 'claim_mode: "self_signup"', "verificationPending"])
);
check(
  "Glömt lösenord använder Supabase Auth och konfigurerad SMTP",
  containsAll("src/app/(public)/auth-actions.ts", [
    "resetPasswordForEmail",
    "redirectTo",
    "password_reset_requested",
  ])
);
check(
  "Auth-callback stöder PKCE och OTP-länkar",
  containsAll("src/app/(public)/auth/callback/route.ts", [
    "exchangeCodeForSession",
    "token_hash",
    "verifyOtp",
  ])
);
check(
  "Admin kan skapa personal med roll och Supabase SMTP-inbjudan",
  containsAll("src/app/admin/actions.ts", [
    "createStaffUserAction",
    "inviteManagedAuthUser",
    "provisionStaffUser",
    "staff_invitation",
  ]) && containsAll("src/lib/supabase/users.ts", [
    "inviteUserByEmail",
    "redirectTo",
    "claim_mode",
  ]) && containsAll("src/app/admin/anvandare/page.tsx", [
    "canAssignAdminRoles",
    '!["superadmin", "org-admin"].includes(role.slug)',
    "Skapa och skicka aktiveringsmejl",
  ])
);
check(
  "Bootstrap använder owner-RPC i stället för direkta tabellinsert",
  containsAll("scripts/bootstrap-admin.mjs", [
    'rpc("bootstrap_faddebo_owner"',
    "listUsers",
    "updateUserById",
  ]) && !read("scripts/bootstrap-admin.mjs").includes('.from("Organization")')
);

const visibleRoots = ["src", "docs", ".env.example", "README.md"];
const visibleFiles = [];
function walk(path) {
  const absolute = resolve(root, path);
  if (!existsSync(absolute)) return;
  const statEntries = readdirSync(absolute, { withFileTypes: true });
  for (const entry of statEntries) {
    const child = `${path}/${entry.name}`;
    if (entry.isDirectory()) walk(child);
    else if (/\.(ts|tsx|js|mjs|md|env|example|txt)$/i.test(entry.name)) visibleFiles.push(child);
  }
}
for (const item of visibleRoots) {
  const absolute = resolve(root, item);
  if (!existsSync(absolute)) continue;
  try {
    if (readdirSync(absolute, { withFileTypes: true })) walk(item);
  } catch {
    visibleFiles.push(item);
  }
}
const legacyEmailFiles = visibleFiles.filter((path) => read(path).toLowerCase().includes("info@ostgotaelteknik.se"));
check("Gammal kontaktadress saknas i aktiv kod och dokumentation", legacyEmailFiles.length === 0, legacyEmailFiles.join(", "));

const loginDashboardMigration = "supabase/migrations/20260804113000_login_dashboard_repair.sql";
check("Login- och dashboardreparation finns", existsSync(resolve(root, loginDashboardMigration)));
check(
  "Login- och dashboardreparation innehåller service-role-skydd och feltålig audit",
  containsAll(loginDashboardMigration, [
    "FUNCTION public.assert_service_role",
    "FUNCTION public.record_current_login",
    "FaddeBo login audit insert skipped",
    "FUNCTION public.admin_dashboard_metrics",
  ])
);
check(
  "Admin-dashboard har exakt fallback om metrics-RPC fallerar",
  containsAll("src/lib/repositories/admin-records.ts", [
    "getAdminDashboardMetricsFallback",
    "sumPaidInvoiceAmount",
    "using canonical query fallback",
  ])
);

const migrationFiles = readdirSync(resolve(root, "supabase/migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort();
const accountMigrationName = "20260804090000_faddebo_account_lifecycle.sql";
const roleMigrationName = "20260804120000_role_context_consistency.sql";
const idempotencyMigrationName = "20260806143000_idempotency_outcome_hardening.sql";
check(
  "Migrationskedjan innehåller canonical konto-, roll- och idempotensmigration i ordning",
  migrationFiles.includes(accountMigrationName)
    && migrationFiles.includes(roleMigrationName)
    && migrationFiles.includes(idempotencyMigrationName)
    && migrationFiles.indexOf(accountMigrationName) < migrationFiles.indexOf(roleMigrationName)
    && migrationFiles.indexOf(roleMigrationName) < migrationFiles.indexOf(idempotencyMigrationName)
);

for (const name of passes) console.log(`PASS  ${name}`);
if (failures.length) {
  for (const failure of failures) console.error(`FAIL  ${failure}`);
  console.error(`\n${failures.length} konto-verifiering(ar) misslyckades.`);
  process.exit(1);
}
console.log(`\nAlla ${passes.length} konto-verifieringar godkändes.`);