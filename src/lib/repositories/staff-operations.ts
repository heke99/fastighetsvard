import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getStaffRoleForAssignment(roleId: string, organizationId: string) {
  const { data, error } = await createAdminClient()
    .from("Role")
    .select("id,organizationId,name,slug")
    .eq("id", roleId)
    .maybeSingle();
  if (error) throw new Error(`Rollen kunde inte verifieras (${error.code}).`);
  if (!data) throw new Error("Rollen hittades inte.");
  if (data.organizationId && String(data.organizationId) !== organizationId) {
    throw new Error("Rollen tillhör en annan organisation.");
  }
  return {
    id: String(data.id),
    organizationId: data.organizationId ? String(data.organizationId) : null,
    name: String(data.name),
    slug: String(data.slug),
  };
}

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
    if (combined.includes("user_already_exists") || combined.includes("person_already_exists")) {
      throw new Error("E-postadressen används redan.");
    }
    if (combined.includes("role_not_found")) throw new Error("Rollen hittades inte.");
    if (combined.includes("privileged_role_assignment_denied")) {
      throw new Error("Endast ägarkontot kan tilldela ägar- eller bolagsadminroll.");
    }
    if (combined.includes("permission_denied")) {
      throw new Error("Du saknar behörighet att skapa personalanvändare.");
    }
    throw new Error(error.message);
  }
  return data as { userId: string; personId: string; roleSlug: string; roleName: string };
}
