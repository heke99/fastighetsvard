import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const errors = [];
const warnings = [];
const read = (path) => readFileSync(resolve(path), "utf8");

const migrationFiles = readdirSync(resolve("supabase/migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort();

for (const forbidden of [
  "20260719192014_initial.sql",
  "20260720000600_repair_identity_properties.sql",
  "20260720000700_repair_applications_contracts.sql",
  "20260720000800_repair_billing_integrations.sql",
  "20260720000900_repair_maintenance_platform.sql",
]) {
  if (migrationFiles.includes(forbidden)) errors.push(`Förbjuden duplicerad migration finns kvar: ${forbidden}`);
}

const migrationContents = migrationFiles.map((name) => ({ name, sql: read(`supabase/migrations/${name}`) }));
for (const { name, sql } of migrationContents) {
  if (!/^\s*(?:--[^\n]*\n\s*)*BEGIN;/i.test(sql)) errors.push(`${name} saknar explicit BEGIN.`);
  if (!/COMMIT;\s*$/i.test(sql)) errors.push(`${name} saknar avslutande COMMIT.`);
  const dollarTags = [...sql.matchAll(/\$[A-Za-z_0-9]*\$/g)].map((match) => match[0]);
  const tagCounts = new Map();
  for (const tag of dollarTags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  for (const [tag, count] of tagCounts) {
    if (count % 2 !== 0) errors.push(`${name} har obalanserad dollar-quote ${tag}.`);
  }
}

for (const [kind, pattern] of [
  ["type", /CREATE\s+TYPE\s+public\."([^"]+)"/gi],
  ["table", /CREATE\s+TABLE\s+public\."([^"]+)"/gi],
  ["index", /CREATE\s+(?:UNIQUE\s+)?INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+"([^"]+)"/gi],
  ["policy", /CREATE\s+POLICY\s+"([^"]+)"/gi],
]) {
  const seen = new Map();
  for (const { name, sql } of migrationContents) {
    for (const match of sql.matchAll(pattern)) {
      const previous = seen.get(match[1]);
      if (previous) errors.push(`Duplicerat ${kind} ${match[1]} i ${previous} och ${name}.`);
      else seen.set(match[1], name);
    }
  }
}

const migrationSql = migrationFiles.map((name) => read(`supabase/migrations/${name}`)).join("\n");
const publicFunctionDefinitions = new Set(
  [...migrationSql.matchAll(/CREATE(?: OR REPLACE)? FUNCTION\s+public\.([A-Za-z0-9_]+)\s*\(/gi)]
    .map((match) => match[1].toLowerCase())
);
const publicFunctionCalls = new Set(
  [...migrationSql.matchAll(/public\.([A-Za-z0-9_]+)\s*\(/gi)]
    .map((match) => match[1].toLowerCase())
);
for (const functionName of [...publicFunctionCalls].sort()) {
  if (!publicFunctionDefinitions.has(functionName)) {
    errors.push(`Migrationskedjan anropar odefinierad public-funktion: ${functionName}`);
  }
}
for (const required of [
  "submit_rental_application",
  "send_rental_offer",
  "accept_rental_offer",
  "record_contract_signature",
  "activate_signed_contract",
  "request_contract_termination",
  "claim_outbox_jobs",
  "claim_idempotent_operation",
  "claim_invitation",
]) {
  if (!migrationSql.includes(`FUNCTION public.${required}`)) errors.push(`Obligatorisk RPC saknas: ${required}`);
}
if (migrationSql.includes('CREATE POLICY "authenticated_private_storage_read"')) {
  errors.push("Legacy-policy ger alla autentiserade användare privat Storage-läsning.");
}
if (!migrationSql.includes('CREATE POLICY "private_storage_owner_or_staff_read"')) {
  errors.push("Path-bunden privat Storage-policy saknas.");
}

const accounts = read("src/lib/services/accounts.ts");
const normalRegistration = accounts.slice(accounts.indexOf("export async function registerAccount"), accounts.indexOf("export async function activateInvitation"));
if (normalRegistration.includes("email_confirm: true")) errors.push("Vanlig registrering förbikopplar e-postverifiering.");
if (normalRegistration.includes("db.person.findFirst") || normalRegistration.includes("person.findFirst")) {
  errors.push("Vanlig registrering försöker koppla importerad person genom e-postmatchning.");
}
if (!normalRegistration.includes("auth.signUp")) errors.push("Vanlig registrering använder inte Supabase signUp.");

const applications = read("src/lib/services/applications.ts");
const submitBody = applications.slice(applications.indexOf("export async function submitApplication"), applications.indexOf("export async function changeApplicationStatus"));
if (submitBody.includes("db.$transaction")) errors.push("Ansökningsinskick använder fortfarande den falska transaktionen.");
if (!submitBody.includes("submitRentalApplication")) errors.push("Ansökningsinskick är inte kopplat till PostgreSQL-RPC.");
const respondBody = applications.slice(applications.indexOf("export async function respondToOffer"));
if (respondBody.includes("db.$transaction")) errors.push("Erbjudandesvar använder fortfarande den falska transaktionen.");

const contracts = read("src/lib/services/contracts.ts");
const terminationBody = contracts.slice(contracts.indexOf("export async function requestTermination"));
if (terminationBody.includes('status: "TERMINATED"')) errors.push("Uppsägning avslutar fortfarande avtalet direkt.");
if (!contracts.includes("verifyEmailSigningChallenge")) errors.push("Verifierad OTP-signering är inte kopplad.");


if (contracts.includes("codeHash: sha256(code)") || contracts.includes("codeHash: sha256(input.code)")) {
  errors.push("OTP-koder hashades utan serverhemlig pepper.");
}
if (!contracts.includes("SIGNING_OTP_PEPPER") || !contracts.includes("hmacSha256")) {
  errors.push("OTP-signering saknar HMAC med SIGNING_OTP_PEPPER.");
}
if (applications.slice(applications.indexOf("export async function changeApplicationStatus")).includes("db.$transaction")) {
  errors.push("Administrativ ansökningsstatus använder fortfarande falsk transaktion.");
}
const listings = read("src/lib/services/listings.ts");
if (listings.slice(listings.indexOf("export async function changeListingStatus")).includes("db.$transaction")) {
  errors.push("Annonsstatus använder fortfarande falsk transaktion.");
}
if (contracts.includes("db.$transaction")) {
  errors.push("Avtalskommandon använder fortfarande falsk transaktion.");
}
if (migrationSql.includes("claim_outbox_jobs(text,integer,integer) TO authenticated")) {
  errors.push("Outbox-claim får inte vara körbar av vanliga autentiserade användare.");
}
if (migrationSql.includes("complete_idempotent_operation(text,integer,jsonb) TO authenticated")) {
  errors.push("Idempotens-complete får inte vara körbar av vanliga autentiserade användare.");
}

const pkg = JSON.parse(read("package.json"));
const nodeVersion = read(".node-version").trim();
const nvmVersion = read(".nvmrc").trim().replace(/^v/, "");
if (nodeVersion !== nvmVersion) errors.push(".node-version och .nvmrc skiljer sig.");
if (pkg.engines?.node !== nodeVersion) errors.push("package.json engines.node skiljer sig från låst Node-version.");

if (existsSync(resolve("src/lib/db.ts"))) {
  errors.push("Den förbjudna generiska databasanpassningen src/lib/db.ts finns kvar.");
}
const sourceFiles = [];
const collectSources = (directory) => {
  for (const entry of readdirSync(resolve(directory), { withFileTypes: true })) {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) collectSources(relative);
    else if (/\.(?:ts|tsx)$/.test(entry.name)) sourceFiles.push(relative);
  }
};
collectSources("src");
for (const path of sourceFiles) {
  const source = read(path);
  if (source.includes("@/lib/db")) errors.push(`${path} importerar den borttagna legacyadaptern.`);
  if (source.includes("db.$transaction")) errors.push(`${path} använder en falsk transaktion.`);
  if (source.includes('select("*")')) errors.push(`${path} använder förbjuden wildcard-projektion.`);
}
if (read("scripts/bootstrap-admin.mjs").includes('select("*")')) {
  errors.push("Bootstrap-skriptet använder förbjuden wildcard-projektion.");
}

for (const warning of warnings) console.warn(`WARN: ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}
console.log(`Static hardening checks passed (${migrationFiles.length} canonical migrations).`);
