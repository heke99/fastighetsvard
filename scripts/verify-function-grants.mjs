import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(".");
const migrationsDir = resolve(root, "supabase/migrations");
const lockMigrationName = "20260806190000_lock_function_grants.sql";
const errors = [];

const read = (path) => readFileSync(resolve(root, path), "utf8");
const migrationFiles = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

const expectedAuthenticatedSignatures = [
  "public.current_app_organization_id()",
  "public.current_app_person_id()",
  "public.current_app_user_id()",
  "public.app_has_permission(text)",
  "public.current_user_context()",
  "public.record_current_login(text)",
  "public.current_active_tenancy_summary()",
  "public.current_person_has_active_application(text)",
  "public.current_person_contract_catalog(text,public.\"ContractStatus\"[],public.\"ContractPartyRole\"[])",
  "public.current_person_application_catalog(public.\"ApplicationStatus\"[],integer)",
  "public.current_person_upcoming_viewings(integer)",
  "public.toggle_favorite(text)",
  "public.submit_rental_application(text,text,jsonb,text,text)",
  "public.withdraw_rental_application(text,text,text)",
  "public.create_viewing_booking(text,text,text)",
  "public.cancel_viewing_booking(text,text)",
  "public.send_rental_offer(text,timestamp without time zone,integer)",
  "public.accept_rental_offer(text,text,timestamp without time zone,text,text)",
  "public.decline_rental_offer(text,text,text,text)",
  "public.request_contract_termination(text,text,timestamp without time zone,text,boolean,text,text,text)",
  "public.cancel_contract_termination(text,text)",
  "public.verify_signing_challenge(text,text,text,text,text)",
  "public.change_application_status(text,public.\"ApplicationStatus\",public.\"ApplicationStatus\",text)",
  "public.change_listing_status(text,public.\"ListingStatus\",public.\"ListingStatus\")",
  "public.complete_unit_listings(text,text)",
  "public.change_contract_status(text,public.\"ContractStatus\",public.\"ContractStatus\",text)",
  "public.create_contract_version(text,jsonb,text,integer)",
  "public.activate_signed_contract(text,text,text)",
];

/**
 * Funktioner som authenticated får exekvera och som tillkommit efter
 * låsmigrationen. Låsmigrationen pinnar tillståndet vid sin egen tidpunkt och
 * kan inte räkna upp funktioner som inte fanns då – dess allow-list körs med
 * `to_regprocedure` och skulle fela på en ren databas. Senare migrationer måste
 * i stället deklarera sina egna authenticated-funktioner här.
 */
const postLockAuthenticatedRpcNames = new Set([
  // RLS-hjälpfunktion för interna anteckningar, införd i
  // 20260814094000_notes_and_media_lifecycle.sql.
  "note_entity_permission",
]);

/**
 * Migrationer vars authenticated-grants ges dynamiskt ur en granskad lista i
 * SQL i stället för som enskilda signaturer.
 */
const verifiedDynamicAllowListMigrations = new Set([
  lockMigrationName,
  "20260814083350_least_privilege_grants.sql",
]);

const functionName = (signature) => signature.match(/^public\.([A-Za-z0-9_]+)\(/)?.[1];
const authenticatedRpcNames = new Set([
  ...expectedAuthenticatedSignatures.map(functionName),
  ...postLockAuthenticatedRpcNames,
]);
const serviceOnlyRpcNames = new Set([
  "assert_service_role",
  "admin_dashboard_metrics",
  "admin_report_metrics",
  "apply_external_payment",
  "bootstrap_faddebo_owner",
  "change_maintenance_status",
  "change_work_order_status",
  "claim_idempotent_operation",
  "claim_invitation",
  "claim_outbox_jobs",
  "claim_webhook_deliveries",
  "complete_idempotent_operation",
  "complete_move_in",
  "complete_move_out",
  "confirm_contract_termination",
  "consume_rate_limit",
  "create_custom_role",
  "create_maintenance_request",
  "create_person_invitation",
  "create_signing_challenge",
  "create_work_order",
  "enqueue_outbox_event",
  "fail_idempotent_operation",
  "persist_external_invoice",
  "provision_staff_user",
  "provision_supplier",
  "queue_sync_review",
  "reconcile_verified_auth_user",
  "record_contract_signature",
  "record_webhook_delivery_attempt",
  "register_existing_tenant",
  "upsert_external_customer",
  "write_audit_event",
]);

for (const name of authenticatedRpcNames) {
  if (!name) errors.push("Authenticated-signatur saknar funktionsnamn.");
  if (serviceOnlyRpcNames.has(name)) {
    errors.push(`RPC ${name} finns i både authenticated- och service-only-matrisen.`);
  }
}

const lockIndex = migrationFiles.indexOf(lockMigrationName);
if (lockIndex === -1) {
  errors.push(`Säkerhetsmigrationen saknas: ${lockMigrationName}.`);
}

const postLockMigrations = lockIndex === -1 ? [] : migrationFiles.slice(lockIndex);
for (const name of postLockMigrations) {
  const sql = read(`supabase/migrations/${name}`);

  for (const statement of sql.matchAll(/REVOKE\s+([\s\S]*?)\s+FROM\s+([^;]+);/gi)) {
    const target = statement[1];
    const roles = statement[2].toLowerCase();
    if (!roles.includes("public")) continue;
    if (roles.includes("anon") && roles.includes("authenticated")) continue;

    // Ett återkall som utelämnar authenticated är korrekt när samma migration
    // uttryckligen ger authenticated EXECUTE på just den funktionen igen.
    const targetFunction = target.match(/public\.([A-Za-z0-9_]+)\s*\(/i)?.[1];
    const regranted =
      targetFunction &&
      !roles.includes("authenticated") &&
      new RegExp(
        `GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${targetFunction}\\s*\\([^;]*TO\\s+authenticated`,
        "i",
      ).test(sql);
    if (regranted) continue;

    errors.push(`${name} har REVOKE från PUBLIC utan både anon och authenticated.`);
  }

  const grantStatements = [...sql.matchAll(/GRANT\s+EXECUTE\s+ON\s+FUNCTIONS?[^;]+;/gi)]
    .map((match) => match[0]);

  for (const grant of grantStatements) {
    const roleClause = grant.match(/\bTO\b([^;]+);/i)?.[1] ?? "";
    if (/\bPUBLIC\b/i.test(roleClause) || /\banon\b/i.test(roleClause)) {
      errors.push(`${name} får inte ge EXECUTE på public-funktioner till PUBLIC eller anon.`);
    }

    if (/\bauthenticated\b/i.test(roleClause)) {
      const isVerifiedDynamicAllowList =
        verifiedDynamicAllowListMigrations.has(name) &&
        /FUNCTION\s+%s\s+TO\s+authenticated/i.test(grant);
      if (isVerifiedDynamicAllowList) continue;

      const grantedNames = [...grant.matchAll(/public\.([A-Za-z0-9_]+)\s*\(/gi)]
        .map((match) => match[1]);
      if (grantedNames.length === 0) {
        errors.push(`${name} har ett authenticated-grant som inte kan klassificeras strukturellt.`);
        continue;
      }
      for (const grantedName of grantedNames) {
        if (!authenticatedRpcNames.has(grantedName)) {
          errors.push(`${name} ger authenticated EXECUTE på oklassificerad RPC: ${grantedName}.`);
        }
      }
    }
  }

  const functionStarts = [
    ...sql.matchAll(/CREATE(?:\s+OR\s+REPLACE)?\s+FUNCTION\s+public\.[A-Za-z0-9_]+\s*\(/gi),
  ];
  for (let index = 0; index < functionStarts.length; index += 1) {
    const start = functionStarts[index].index ?? 0;
    const end = functionStarts[index + 1]?.index ?? sql.length;
    const block = sql.slice(start, end);
    // PostgreSQL accepterar både `SET search_path = ...` och `SET search_path TO ...`.
    if (/SECURITY\s+DEFINER/i.test(block) && !/SET\s+search_path\s*(?:=|\bTO\b)/i.test(block)) {
      const nameMatch = block.match(/FUNCTION\s+public\.([A-Za-z0-9_]+)/i);
      errors.push(
        `${name} definierar SECURITY DEFINER-funktionen ${nameMatch?.[1] ?? "okänd"} utan låst search_path.`,
      );
    }
  }
}

if (lockIndex !== -1) {
  const lockSql = read(`supabase/migrations/${lockMigrationName}`);
  for (const required of [
    "pg_get_function_identity_arguments",
    "REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated",
    "ALTER DEFAULT PRIVILEGES IN SCHEMA public",
    "REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated",
    "GRANT EXECUTE ON FUNCTIONS TO service_role",
    "p_actor_id IS NULL",
    "current_app_organization_id() IS NULL",
    "SECURITY INVOKER",
  ]) {
    if (!lockSql.includes(required)) {
      errors.push(`${lockMigrationName} saknar strukturellt skydd: ${required}.`);
    }
  }

  const allowListBlock = lockSql.match(
    /DO \$authenticated_acl\$([\s\S]*?)\$authenticated_acl\$;/,
  )?.[1];
  if (!allowListBlock) {
    errors.push(`${lockMigrationName} saknar authenticated allow-list-blocket.`);
  } else {
    const listedSignatures = new Set(
      [...allowListBlock.matchAll(/'(public\.[^']+\))'/g)].map((match) => match[1]),
    );
    for (const signature of expectedAuthenticatedSignatures) {
      if (!listedSignatures.has(signature)) {
        errors.push(`${lockMigrationName} saknar verifierad authenticated-signatur: ${signature}.`);
      }
    }
    for (const signature of listedSignatures) {
      if (!expectedAuthenticatedSignatures.includes(signature)) {
        errors.push(`${lockMigrationName} innehåller oväntad authenticated-signatur: ${signature}.`);
      }
    }
  }
}

const sourceFiles = [];
const collect = (directory) => {
  for (const entry of readdirSync(resolve(root, directory), { withFileTypes: true })) {
    if (["node_modules", ".next", ".git"].includes(entry.name)) continue;
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) collect(relative);
    else if (/\.(?:ts|tsx|js|mjs|cjs)$/.test(entry.name)) sourceFiles.push(relative);
  }
};
for (const directory of ["src", "tests", "scripts"]) collect(directory);

const literalRpcNames = new Set();
const rpcPatterns = [
  /\.rpc\(\s*["'`]([A-Za-z0-9_]+)["'`]/g,
  // `rpc(client, "namn")`. Första argumentet måste vara ett uttryck utan
  // strängliteral, annars matchar mönstret det andra elementet i en lista av
  // strängar som råkar innehålla ordet rpc.
  /\brpc\(\s*[A-Za-z_$][\w$.[\]]*\s*,\s*["'`]([A-Za-z0-9_]+)["'`]/g,
];
for (const path of sourceFiles) {
  if (path === "scripts/verify-function-grants.mjs") continue;
  const source = read(path);
  for (const pattern of rpcPatterns) {
    for (const match of source.matchAll(pattern)) literalRpcNames.add(match[1]);
  }
}

for (const name of [...literalRpcNames].sort()) {
  if (!authenticatedRpcNames.has(name) && !serviceOnlyRpcNames.has(name)) {
    errors.push(`Statiskt RPC-anrop saknar rollklassificering: ${name}.`);
  }
}

if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log(
  `Function grant checks passed (${literalRpcNames.size} static RPC names; ` +
    `${authenticatedRpcNames.size} authenticated; ${serviceOnlyRpcNames.size} service-only; 0 anon).`,
);
