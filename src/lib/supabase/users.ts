import "server-only";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "./admin";

async function findAuthUserByEmail(email: string): Promise<User | null> {
  const admin = createAdminClient();
  const target = email.toLowerCase().trim();
  const perPage = 1000;

  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Kunde inte kontrollera Supabase Auth-användare (${error.message}).`);
    const match = data.users.find((user) => user.email?.toLowerCase() === target);
    if (match) return match;
    if (data.users.length < perPage) return null;
  }

  throw new Error("Auth-användarlistan är för stor för säker automatisk matchning.");
}

export async function createManagedAuthUser(input: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  claimMode?: "staff_invitation" | "contractor_invitation" | "bootstrap";
}): Promise<{ user: User; created: boolean }> {
  const admin = createAdminClient();
  const email = input.email.toLowerCase().trim();
  const metadata = {
    first_name: input.firstName ?? "",
    last_name: input.lastName ?? "",
    claim_mode: input.claimMode ?? "staff_invitation",
  };

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: metadata,
  });

  if (!error && data.user) return { user: data.user, created: true };

  // A previous failed app-profile provisioning may have left a confirmed Auth
  // user behind. Reuse that orphan instead of forcing manual deletion.
  const existing = await findAuthUserByEmail(email);
  if (!existing) {
    throw new Error(error?.message ?? "Kunde inte skapa Supabase Auth-användare.");
  }

  const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
    password: input.password,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (updateError || !updated.user) {
    throw new Error(updateError?.message ?? "Kunde inte reparera Supabase Auth-användaren.");
  }

  return { user: updated.user, created: false };
}

export async function deleteManagedAuthUser(userId: string) {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(`Auth-användaren kunde inte tas bort (${error.message}).`);
}

export async function createPasswordSetupLink(email: string, redirectTo: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: email.toLowerCase().trim(),
    options: { redirectTo },
  });
  if (error || !data.properties?.action_link) {
    throw new Error(error?.message ?? "Kunde inte skapa aktiveringslänk.");
  }
  return data.properties.action_link;
}
