import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function provisionStaffUser(input: {
  authUserId: string;
  organizationId: string;
  email: string;
  firstName: string;
  lastName: string;
  roleId: string;
  actorUserId: string;
}) {
  const { data, error } = await createAdminClient().rpc("provision_staff_user", {
    p_auth_user_id: input.authUserId,
    p_organization_id: input.organizationId,
    p_email: input.email,
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_role_id: input.roleId,
    p_actor_user_id: input.actorUserId,
  });
  if (error) {
    const combined = `${error.message} ${error.details ?? ""}`;
    if (combined.includes("user_already_exists")) {
      throw new Error("E-postadressen används redan.");
    }
    if (combined.includes("role_not_found")) throw new Error("Rollen hittades inte.");
    throw new Error(error.message);
  }
  return data as { userId: string; personId: string; roleSlug: string; roleName: string };
}
