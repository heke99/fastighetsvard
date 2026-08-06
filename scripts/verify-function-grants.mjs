import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const HARDENING_MIGRATION = "20260806190000_lock_function_grants.sql";
const migrationsDir = resolve("supabase/migrations");
const migrationFiles = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

const hardeningIndex = migrationFiles.indexOf(HARDENING_MIGRATION);
if (hardeningIndex < 0) {
  console.error(`ERROR: Säkerhetsmigrationen ${HARDENING_MIGRATION} saknas.`);
  process.exit(1);
}

const errors = [];
const readMigration = (name) =>
  readFileSync(resolve(migrationsDir, name), "utf8");
const hardeningSql = readMigration(HARDENING_MIGRATION);

const serviceOnlyFunctions = new Set([
  "write_audit_event",
  "enqueue_outbox_event",
  "claim_outbox_jobs",
  "claim_idempotent_operation",
  "complete_idempotent_operation",
  "fail_idempotent_operation",
]);

const authenticatedFunctionAllowlist = new Set([
  "current_app_organization_id",
  "current_app_person_id",
  "current_app_user_id",
  "app_has_permission",
  "current_user_context",
  "record_current_login",
  "toggle_favorite",
  "current_active_tenancy_summary",
  "current_person_has_active_application",
  "current_person_contract_catalog",
  "current_person_application_catalog",
  "current_person_upcoming_viewings",
  "submit_rental_application",
  "withdraw_rental_application",
  "create_viewing_booking",
  "cancel_viewing_booking",
  "send_rental_offer",
  "accept_rental_offer",
  "decline_rental_offer",
  "record_contract_signature",
  "request_contract_termination",
  "cancel_contract_termination",
  "complete_internal_transfer",
  "create_contract_version",
  "create_signing_session",
  "countersign_contract",
  "activate_signed_contract",
  "confirm_contract_termination",
  "complete_move_in",
  "complete_move_out",
  "verify_signing_challenge",
  "change_application_status",
  "change_listing_status",
  "complete_unit_listings",
  "change_contract_status",
]);

function normalizeSql(value) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function functionDefinitions(sql) {
  const starts = [
    ...sql.matchAll(
      /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.([A-Za-z0-9_]+)\s*\(/gi
    ),
  ];
  return starts.map((match, index) => ({
    name: match[1].toLowerCase(),
    body: sql.slice(
      match.index,
      index + 1 < starts.length ? starts[index + 1].index : sql.length
    ),
  }));
}

function grantedFunctions(sql, role) {
  const names = new Set();
  for (const match of sql.matchAll(
    /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.([A-Za-z0-9_]+)\s*\([\s\S]*?\)\s+TO\s+([^;]+);/gi
  )) {
    const grantees = match[2].toLowerCase();
    if (new RegExp(`\\b${role}\\b`, "i").test(grantees)) {
      names.add(match[1].toLowerCase());
    }
  }
  return names;
}

const hardeningNormalized = normalizeSql(hardeningSql);
for (const required of [
  "alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated",
  "revoke execute on function %s from public, anon, authenticated",
  "alter function public.write_audit_event",
  "alter function public.enqueue_outbox_event",
  "security invoker",
  "coalesce(auth.role(), '') <> 'service_role'",
  "nullif(trim(p_actor_id), '') is null",
  "p_organization_id is distinct from v_current_organization_id",
]) {
  if (!hardeningNormalized.includes(required)) {
    errors.push(
      `${HARDENING_MIGRATION} saknar obligatoriskt skydd: ${required}`
    );
  }
}

const hardeningAuthenticatedGrants = grantedFunctions(
  hardeningSql,
  "authenticated"
);
for (const functionName of authenticatedFunctionAllowlist) {
  if (!hardeningAuthenticatedGrants.has(functionName)) {
    errors.push(
      `${HARDENING_MIGRATION} återger inte authenticated till verifierad RPC ${functionName}.`
    );
  }
}
for (const functionName of hardeningAuthenticatedGrants) {
  if (!authenticatedFunctionAllowlist.has(functionName)) {
    errors.push(
      `${HARDENING_MIGRATION} ger authenticated till ej allow-listad RPC ${functionName}.`
    );
  }
}

for (const functionName of serviceOnlyFunctions) {
  const escaped = functionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const revokePattern = new RegExp(
    `REVOKE\\s+ALL\\s+ON\\s+FUNCTION\\s+public\\.${escaped}\\s*\\([\\s\\S]*?\\)\\s+FROM\\s+PUBLIC\\s*,\\s*anon\\s*,\\s*authenticated\\s*;`,
    "i"
  );
  const grantPattern = new RegExp(
    `GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${escaped}\\s*\\([\\s\\S]*?\\)\\s+TO\\s+service_role\\s*;`,
    "i"
  );
  if (!revokePattern.test(hardeningSql)) {
    errors.push(
      `${HARDENING_MIGRATION} saknar exakt PUBLIC/anon/authenticated-revoke för ${functionName}.`
    );
  }
  if (!grantPattern.test(hardeningSql)) {
    errors.push(
      `${HARDENING_MIGRATION} saknar explicit service_role-grant för ${functionName}.`
    );
  }
}

for (const name of migrationFiles.slice(hardeningIndex)) {
  const sql = readMigration(name);
  const sqlWithoutLineComments = sql.replace(/--[^\n]*/g, "");

  for (const match of sqlWithoutLineComments.matchAll(
    /REVOKE[\s\S]*?\sFROM\s+([^;]+);/gi
  )) {
    const grantees = match[1].toLowerCase();
    if (
      /\bpublic\b/.test(grantees) &&
      !/\banon\b/.test(grantees) &&
      !/\bauthenticated\b/.test(grantees)
    ) {
      const statement = match[0].replace(/\s+/g, " ").slice(0, 180);
      errors.push(
        `${name} har PUBLIC-revoke utan både anon och authenticated: ${statement}`
      );
    }
  }

  for (const match of sql.matchAll(
    /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.([A-Za-z0-9_]+)\s*\([\s\S]*?\)\s+TO\s+([^;]+);/gi
  )) {
    const functionName = match[1].toLowerCase();
    const statement = match[0];
    const grantees = match[2].toLowerCase();

    if (/\banon\b/.test(grantees)) {
      errors.push(
        `${name} ger EXECUTE till anon: ${statement.replace(/\s+/g, " ")}`
      );
    }

    if (
      /\bauthenticated\b/.test(grantees) &&
      !authenticatedFunctionAllowlist.has(functionName)
    ) {
      errors.push(
        `${name} ger authenticated till ej allow-listad RPC ${functionName}.`
      );
    }

    if (
      /\bauthenticated\b/.test(grantees) &&
      serviceOnlyFunctions.has(functionName)
    ) {
      errors.push(
        `${name} ger en service-only-funktion till authenticated: ${statement.replace(/\s+/g, " ")}`
      );
    }
  }

  for (const definition of functionDefinitions(sql)) {
    if (!/\bSECURITY\s+DEFINER\b/i.test(definition.body)) continue;

    if (!/\bSET\s+search_path\s*=/i.test(definition.body)) {
      errors.push(
        `${name} skapar SECURITY DEFINER-funktionen ${definition.name} utan låst search_path.`
      );
    }
    if (
      /\bSET\s+search_path\s+FROM\s+CURRENT\b/i.test(definition.body) ||
      /\$user/i.test(definition.body)
    ) {
      errors.push(
        `${name} använder muterbar search_path i SECURITY DEFINER-funktionen ${definition.name}.`
      );
    }

    const escaped = definition.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const explicitAnonRevoke = new RegExp(
      `REVOKE[\\s\\S]*?FUNCTION\\s+public\\.${escaped}\\s*\\([\\s\\S]*?\\)[\\s\\S]*?FROM\\s+[^;]*\\banon\\b`,
      "i"
    );
    const coveredByStructuralRevoke =
      name === HARDENING_MIGRATION &&
      /pg_proc[\s\S]*p\.prosecdef[\s\S]*REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated/i.test(
        sql
      );

    if (!explicitAnonRevoke.test(sql) && !coveredByStructuralRevoke) {
      errors.push(
        `${name} skapar SECURITY DEFINER-funktionen ${definition.name} utan verifierbar anon-revoke.`
      );
    }
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log(
  `Function grant hardening checks passed (${authenticatedFunctionAllowlist.size} authenticated RPCs; ${migrationFiles.length - hardeningIndex} guarded migrations).`
);
