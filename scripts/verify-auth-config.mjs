import { createClient } from "@supabase/supabase-js";

function clean(value) {
  if (value == null) return undefined;
  let result = String(value).trim();
  for (let i = 0; i < 2; i += 1) {
    if (
      result.length >= 2 &&
      ((result.startsWith('"') && result.endsWith('"')) ||
        (result.startsWith("'") && result.endsWith("'")))
    ) {
      result = result.slice(1, -1).trim();
    }
  }
  return result || undefined;
}

const urlValue = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const publishableKey =
  clean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ??
  clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const secretKey =
  clean(process.env.SUPABASE_SECRET_KEY) ??
  clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const appUrlValue = clean(process.env.APP_URL) ?? "https://faddebo.se";
const expectedRef = clean(process.env.SUPABASE_PROJECT_REF);

const failures = [];
const passes = [];

function pass(message) {
  passes.push(message);
  console.log(`PASS  ${message}`);
}

function fail(message) {
  failures.push(message);
  console.error(`FAIL  ${message}`);
}

let supabaseUrl;
let appUrl;
try {
  supabaseUrl = new URL(urlValue);
  if (supabaseUrl.protocol !== "https:" && supabaseUrl.protocol !== "http:") {
    throw new Error("fel protokoll");
  }
  pass("NEXT_PUBLIC_SUPABASE_URL är en giltig URL");
} catch {
  fail("NEXT_PUBLIC_SUPABASE_URL saknas eller är ogiltig");
}

try {
  appUrl = new URL(appUrlValue);
  if (appUrl.protocol !== "https:" && appUrl.protocol !== "http:") {
    throw new Error("fel protokoll");
  }
  pass("APP_URL är en giltig URL");
} catch {
  fail("APP_URL är ogiltig. I Vercel ska värdet vara https://faddebo.se utan citattecken");
}

if (publishableKey) pass("Supabase publishable/anon key finns");
else fail("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY saknas");

if (secretKey) pass("Supabase secret/service-role key finns för adminfunktioner");
else fail("SUPABASE_SECRET_KEY saknas; vanlig inloggning fungerar utan den men admininbjudningar gör det inte");

if (supabaseUrl && expectedRef) {
  const actualRef = supabaseUrl.hostname.split(".")[0];
  if (actualRef === expectedRef) pass("SUPABASE_PROJECT_REF matchar Supabase-URL:en");
  else fail(`SUPABASE_PROJECT_REF (${expectedRef}) matchar inte URL-projektet (${actualRef})`);
}

if (supabaseUrl && publishableKey) {
  try {
    const health = await fetch(`${supabaseUrl.origin}/auth/v1/health`, {
      headers: { apikey: publishableKey },
    });
    if (health.ok) pass("Supabase Auth svarar");
    else fail(`Supabase Auth health svarade HTTP ${health.status}`);
  } catch (error) {
    fail(`Supabase Auth kunde inte nås: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (supabaseUrl && secretKey) {
  const admin = createClient(supabaseUrl.origin, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (usersError) fail(`Secret/service-role key är inte giltig: ${usersError.message}`);
  else pass("Secret/service-role key kan använda Supabase Auth Admin API");

  for (const table of ["Organization", "User", "Role"]) {
    const { error } = await admin.from(table).select("*").limit(1);
    if (error) {
      fail(`Databasen saknar eller blockerar public.\"${table}\": ${error.message}`);
    } else {
      pass(`Databastabellen public.\"${table}\" finns`);
    }
  }

  const { error: rpcError } = await admin.rpc("reconcile_verified_auth_user", {
    p_auth_user_id: "00000000-0000-0000-0000-000000000000",
  });
  if (!rpcError) {
    pass("RPC reconcile_verified_auth_user finns");
  } else if (rpcError.code === "PGRST202" || rpcError.message.includes("schema cache")) {
    fail("RPC reconcile_verified_auth_user saknas; kör migration 20260804101500");
  } else {
    // Ett domänfel som verified_auth_user_not_found visar att funktionen finns.
    pass("RPC reconcile_verified_auth_user finns");
  }
}

console.log(`\n${passes.length} godkända kontroller, ${failures.length} fel.`);
if (failures.length > 0) process.exitCode = 1;
