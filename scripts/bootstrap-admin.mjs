import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.env.BOOTSTRAP_OWNER_EMAIL ?? process.env.BOOTSTRAP_ADMIN_EMAIL ?? "").toLowerCase().trim();
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

const now = () => new Date().toISOString();

async function one(operation, query) {
  const { data, error } = await query;
  if (error) throw new Error(`${operation}: ${error.message}`);
  return data;
}

let organization = await one(
  "Läs organisation",
  supabase
    .from("Organization")
    .select("id,name,legalName,orgNumber")
    .order("createdAt")
    .limit(1)
    .maybeSingle()
);

if (!organization) {
  organization = await one(
    "Skapa organisation",
    supabase
      .from("Organization")
      .insert({
        id: randomUUID(),
        name: "Östgöta El Teknik",
        legalName: "Östgöta El Teknik AB",
        orgNumber: "559350-5620",
        email: "info@faddebo.se",
        dataProtectionEmail: "info@faddebo.se",
        createdAt: now(),
        updatedAt: now(),
      })
      .select("id,name,legalName,orgNumber")
      .single()
  );
} else {
  organization = await one(
    "Uppdatera FaddeBo-organisation",
    supabase
      .from("Organization")
      .update({
        email: "info@faddebo.se",
        dataProtectionEmail: "info@faddebo.se",
        updatedAt: now(),
      })
      .eq("id", organization.id)
      .select("id,name,legalName,orgNumber")
      .single()
  );
}

await one(
  "Avmarkera andra primära varumärken",
  supabase
    .from("Brand")
    .update({ isPrimary: false, updatedAt: now() })
    .eq("organizationId", organization.id)
    .neq("slug", "faddebo")
    .eq("isPrimary", true)
);

const existingBrand = await one(
  "Läs FaddeBo-varumärke",
  supabase.from("Brand").select("id").eq("organizationId", organization.id).eq("slug", "faddebo").maybeSingle()
);
const brandValues = {
  organizationId: organization.id,
  name: "FaddeBo",
  slug: "faddebo",
  legalDisplayName: "FaddeBo – ett varumärke inom Östgöta El Teknik AB, org.nr 559350-5620",
  supportEmail: "info@faddebo.se",
  privacyPolicyUrl: "/integritetspolicy",
  termsUrl: "/allmanna-villkor",
  isPrimary: true,
  status: "ACTIVE",
  updatedAt: now(),
};
if (!existingBrand) {
  await one(
    "Skapa FaddeBo-varumärke",
    supabase.from("Brand").insert({ id: randomUUID(), createdAt: now(), ...brandValues })
  );
} else {
  await one(
    "Uppdatera FaddeBo-varumärke",
    supabase.from("Brand").update(brandValues).eq("id", existingBrand.id)
  );
}

let person = await one(
  "Läs ägarperson",
  supabase
    .from("Person")
    .select("id,organizationId,firstName,lastName,email")
    .eq("organizationId", organization.id)
    .eq("email", email)
    .maybeSingle()
);
if (!person) {
  person = await one(
    "Skapa ägarperson",
    supabase
      .from("Person")
      .insert({
        id: randomUUID(),
        organizationId: organization.id,
        firstName,
        lastName,
        email,
        country: "SE",
        createdAt: now(),
        updatedAt: now(),
      })
      .select("id,organizationId,firstName,lastName,email")
      .single()
  );
} else {
  person = await one(
    "Uppdatera ägarperson",
    supabase
      .from("Person")
      .update({ firstName, lastName, email, updatedAt: now() })
      .eq("id", person.id)
      .select("id,organizationId,firstName,lastName,email")
      .single()
  );
}

await one(
  "Ta bort sökanderoll från ägaren",
  supabase.from("PersonRole").delete().eq("personId", person.id).eq("role", "APPLICANT")
);

let authUser;
const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
  type: "magiclink",
  email,
  options: { data: { first_name: firstName, last_name: lastName, claim_mode: "bootstrap" } },
});
if (!linkError && linkData.user) authUser = linkData.user;

if (!authUser) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName, claim_mode: "bootstrap" },
  });
  if (error || !data.user) throw new Error(error?.message ?? "Auth-användaren kunde inte skapas.");
  authUser = data.user;
} else {
  const { data, error } = await supabase.auth.admin.updateUserById(authUser.id, {
    password,
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName, claim_mode: "bootstrap" },
  });
  if (error || !data.user) throw new Error(error?.message ?? "Auth-användaren kunde inte uppdateras.");
  authUser = data.user;
}

let profile = await one(
  "Läs ägarprofil via auth-id",
  supabase.from("User").select("id,authUserId").eq("authUserId", authUser.id).maybeSingle()
);
if (!profile) {
  profile = await one(
    "Läs ägarprofil via e-post",
    supabase.from("User").select("id,authUserId").eq("email", email).maybeSingle()
  );
}
if (!profile) {
  const profileValues = {
    id: randomUUID(),
    authUserId: authUser.id,
    organizationId: organization.id,
    personId: person.id,
    email,
    emailVerifiedAt: now(),
    isActive: true,
    createdAt: now(),
    updatedAt: now(),
  };

  let profileResult = await supabase
    .from("User")
    .insert(profileValues)
    .select("id,authUserId")
    .single();

  // Legacy Prisma databases can still have a required passwordHash column.
  // Passwords are managed by Supabase Auth, so this sentinel is never read.
  if (profileResult.error?.message?.includes("passwordHash")) {
    profileResult = await supabase
      .from("User")
      .insert({ ...profileValues, passwordHash: "SUPABASE_AUTH_MANAGED" })
      .select("id,authUserId")
      .single();
  }

  if (profileResult.error) {
    throw new Error(`Skapa ägarprofil: ${profileResult.error.message}`);
  }
  profile = profileResult.data;
} else {
  profile = await one(
    "Uppdatera ägarprofil",
    supabase
      .from("User")
      .update({
        authUserId: authUser.id,
        organizationId: organization.id,
        personId: person.id,
        email,
        emailVerifiedAt: now(),
        isActive: true,
        updatedAt: now(),
      })
      .eq("id", profile.id)
      .select("id,authUserId")
      .single()
  );
}

let role = await one(
  "Läs superadminroll",
  supabase.from("Role").select("id,name,slug").eq("slug", "superadmin").is("organizationId", null).maybeSingle()
);
if (!role) {
  role = await one(
    "Skapa superadminroll",
    supabase
      .from("Role")
      .insert({ id: randomUUID(), name: "Ägare / superadmin", slug: "superadmin", isSystem: true, createdAt: now(), updatedAt: now() })
      .select("id,name,slug")
      .single()
  );
}
await one(
  "Säkerställ superadminbehörighet",
  supabase.from("RolePermission").upsert(
    { id: randomUUID(), roleId: role.id, permission: "*" },
    { onConflict: "roleId,permission", ignoreDuplicates: true }
  )
);

const existingRole = await one(
  "Läs ägarroll",
  supabase
    .from("UserRole")
    .select("id")
    .eq("userId", profile.id)
    .eq("roleId", role.id)
    .is("propertyId", null)
    .maybeSingle()
);
if (!existingRole) {
  await one(
    "Tilldela ägarroll",
    supabase.from("UserRole").insert({
      id: randomUUID(),
      userId: profile.id,
      roleId: role.id,
      propertyId: null,
      createdAt: now(),
    })
  );
}

console.log(`FaddeBo-ägarkonto klart: ${email}`);
console.log("Ta bort BOOTSTRAP_OWNER_* från den permanenta produktionsmiljön efter verifierad inloggning.");
