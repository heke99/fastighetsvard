import "server-only";
import { getAppUrl } from "@/lib/app-url";
import { createAdminClient } from "./admin";

async function findManagedAuthUserByEmail(email: string) {
  const admin = createAdminClient();
  const normalizedEmail = email.toLowerCase().trim();
  const perPage = 1000;

  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Supabase Auth-användare kunde inte verifieras: ${error.message}`);
    }

    const match = data.users.find(
      (user) => user.email?.toLowerCase().trim() === normalizedEmail
    );
    if (match) return match;

    if (data.users.length < perPage) return null;
  }
}

export async function inviteManagedAuthUser(input: {
  email: string;
  firstName?: string;
  lastName?: string;
  roleName?: string;
  claimMode?: "staff_invitation" | "contractor_invitation";
}) {
  const admin = createAdminClient();
  const email = input.email.toLowerCase().trim();
  const existingAuthUser = await findManagedAuthUserByEmail(email);

  if (existingAuthUser) {
    throw new Error("E-postadressen har redan ett Supabase Auth-konto.");
  }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${getAppUrl()}/aterstall-losenord`,
    data: {
      first_name: input.firstName ?? "",
      last_name: input.lastName ?? "",
      role_name: input.roleName ?? "",
      claim_mode: input.claimMode ?? "staff_invitation",
    },
  });

  if (error || !data.user) {
    const message = error?.message ?? "Supabase kunde inte skicka aktiveringsmejlet.";
    throw new Error(`Aktiveringsmejlet kunde inte skickas: ${message}`);
  }
  return data.user;
}

export async function deleteManagedAuthUser(userId: string) {
  const admin = createAdminClient();
  await admin.auth.admin.deleteUser(userId);
}
