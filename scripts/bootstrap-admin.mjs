import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
if (!url || !secret || !email || !password) {
  console.error("Saknar NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, BOOTSTRAP_ADMIN_EMAIL eller BOOTSTRAP_ADMIN_PASSWORD.");
  process.exit(1);
}
if (password.length < 12) {
  console.error("BOOTSTRAP_ADMIN_PASSWORD måste vara minst 12 tecken.");
  process.exit(1);
}
const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

async function one(table, query) {
  const { data, error } = await query;
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

let organization = await one("Organization", supabase.from("Organization").select("*").order("createdAt").limit(1).maybeSingle());
if (!organization) {
  organization = await one("Organization", supabase.from("Organization").insert({ id: randomUUID(), name: "Östgöta El Teknik", email: "info@ostgotaelteknik.se" }).select("*").single());
}
let person = await one("Person", supabase.from("Person").select("*").eq("organizationId", organization.id).eq("email", email.toLowerCase()).maybeSingle());
if (!person) {
  person = await one("Person", supabase.from("Person").insert({
    id: randomUUID(), organizationId: organization.id, firstName: "System", lastName: "Admin", email: email.toLowerCase(), country: "SE"
  }).select("*").single());
}
let authUser;
const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({ type: "magiclink", email: email.toLowerCase() });
if (!linkError && linkData.user) authUser = linkData.user;
if (!authUser) {
  const { data, error } = await supabase.auth.admin.createUser({ email: email.toLowerCase(), password, email_confirm: true });
  if (error) throw error;
  authUser = data.user;
} else {
  const { error } = await supabase.auth.admin.updateUserById(authUser.id, { password, email_confirm: true });
  if (error) throw error;
}
await one("User", supabase.from("User").upsert({
  id: randomUUID(), authUserId: authUser.id, organizationId: organization.id, personId: person.id, email: email.toLowerCase(), emailVerifiedAt: new Date().toISOString(), isActive: true
}, { onConflict: "authUserId" }));
let role = await one("Role", supabase.from("Role").select("*").eq("slug", "superadmin").is("organizationId", null).maybeSingle());
if (!role) {
  role = await one("Role", supabase.from("Role").insert({ id: randomUUID(), name: "Superadmin", slug: "superadmin", isSystem: true }).select("*").single());
  await one("RolePermission", supabase.from("RolePermission").insert({ id: randomUUID(), roleId: role.id, permission: "*" }));
}
const profile = await one("User", supabase.from("User").select("*").eq("authUserId", authUser.id).single());
const existingRole = await one("UserRole", supabase.from("UserRole").select("id").eq("userId", profile.id).eq("roleId", role.id).is("propertyId", null).maybeSingle());
if (!existingRole) await one("UserRole", supabase.from("UserRole").insert({ id: randomUUID(), userId: profile.id, roleId: role.id, propertyId: null }));
console.log(`Superadmin klar: ${email}`);
