import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.env.BOOTSTRAP_OWNER_EMAIL ?? process.env.BOOTSTRAP_ADMIN_EMAIL ?? "")
  .toLowerCase()
  .trim();
const password = process.env.BOOTSTRAP_OWNER_PASSWORD ?? process.env.BOOTSTRAP_ADMIN_PASSWORD;
const firstName = process.env.BOOTSTRAP_OWNER_FIRST_NAME?.trim() || "System";
const lastName = process.env.BOOTSTRAP_OWNER_LAST_NAME?.trim() || "Ägare";

if (!url || !secret || !email || !password) {
  console.error(
    "Saknar NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, BOOTSTRAP_OWNER_EMAIL eller BOOTSTRAP_OWNER_PASSWORD."
  );
  process.exit(1);
}
if (password.length < 12) {
  console.error("BOOTSTRAP_OWNER_PASSWORD måste vara minst 12 tecken.");
  process.exit(1);
}

const supabase = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findAuthUserByEmail(targetEmail) {
  const perPage = 1000;
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Läs Auth-användare: ${error.message}`);
    const match = data.users.find((user) => user.email?.toLowerCase() === targetEmail);
    if (match) return match;
    if (data.users.length < perPage) return null;
  }
  throw new Error("Auth-användarlistan är för stor för säker bootstrap. Sök användaren manuellt i Supabase.");
}

async function ensureAuthUser() {
  const metadata = {
    first_name: firstName,
    last_name: lastName,
    claim_mode: "bootstrap",
  };

  let authUser = await findAuthUserByEmail(email);
  if (!authUser) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (error || !data.user) {
      // A concurrent or earlier partial bootstrap may have created the Auth row.
      authUser = await findAuthUserByEmail(email);
      if (!authUser) throw new Error(`Skapa Auth-användare: ${error?.message ?? "okänt fel"}`);
    } else {
      authUser = data.user;
    }
  }

  const { data, error } = await supabase.auth.admin.updateUserById(authUser.id, {
    password,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (error || !data.user) {
    throw new Error(`Uppdatera Auth-användare: ${error?.message ?? "okänt fel"}`);
  }
  return data.user;
}

await ensureAuthUser();

const { data, error } = await supabase.rpc("bootstrap_faddebo_owner", {
  p_email: email,
  p_first_name: firstName,
  p_last_name: lastName,
});

if (error) {
  const details = [error.message, error.details, error.hint].filter(Boolean).join(" ");
  if (details.includes("bootstrap_faddebo_owner") || error.code === "PGRST202") {
    throw new Error(
      "Owner-funktionen saknas i databasen. Kör supabase/manual/00_REPAIR_FADDEBO_AUTH_SCHEMA.sql i Supabase SQL Editor och kör sedan bootstrap igen."
    );
  }
  throw new Error(`Tilldela ägarbehörighet: ${details || "okänt fel"}`);
}

console.log(`FaddeBo-ägarkonto klart: ${email}`);
console.log(JSON.stringify(data, null, 2));
console.log("Ta bort BOOTSTRAP_OWNER_* efter verifierad inloggning.");
