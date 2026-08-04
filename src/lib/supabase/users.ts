import "server-only";
import { getAppUrl } from "@/lib/app-url";
import { createAdminClient } from "./admin";

export async function inviteManagedAuthUser(input: {
  email: string;
  firstName?: string;
  lastName?: string;
  roleName?: string;
  claimMode?: "staff_invitation" | "contractor_invitation";
}) {
  const admin = createAdminClient();
  const email = input.email.toLowerCase().trim();
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
