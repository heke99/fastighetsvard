import "server-only";
import { createAdminClient } from "./admin";

export async function createManagedAuthUser(input: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email.toLowerCase().trim(),
    password: input.password,
    email_confirm: true,
    user_metadata: {
      first_name: input.firstName ?? "",
      last_name: input.lastName ?? "",
    },
  });
  if (error || !data.user) throw new Error(error?.message ?? "Kunde inte skapa Supabase Auth-användare.");
  return data.user;
}

export async function deleteManagedAuthUser(userId: string) {
  const admin = createAdminClient();
  await admin.auth.admin.deleteUser(userId);
}
