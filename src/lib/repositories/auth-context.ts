import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentUser } from "@/lib/auth";

export async function readCurrentUserContext(
  client: SupabaseClient
): Promise<CurrentUser | null> {
  const { data, error } = await client.rpc("current_user_context");
  if (error) throw new Error(`Användarkontext kunde inte läsas (${error.code}).`);
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const value = data as Record<string, unknown>;
  const person =
    value.person && typeof value.person === "object" && !Array.isArray(value.person)
      ? value.person as Record<string, unknown>
      : null;
  return {
    id: String(value.id),
    email: String(value.email),
    organizationId: value.organizationId ? String(value.organizationId) : null,
    personId: value.personId ? String(value.personId) : null,
    supplierId: value.supplierId ? String(value.supplierId) : null,
    permissions: Array.isArray(value.permissions) ? value.permissions.map(String) : [],
    roleSlugs: Array.isArray(value.roleSlugs) ? value.roleSlugs.map(String) : [],
    person: person
      ? {
          id: String(person.id),
          firstName: String(person.firstName),
          lastName: String(person.lastName),
          roles: Array.isArray(person.roles) ? person.roles.map(String) : [],
        }
      : null,
  };
}

export async function recordCurrentLogin(client: SupabaseClient, ip?: string) {
  const { error } = await client.rpc("record_current_login", {
    p_ip: ip ?? null,
  });
  if (error) throw new Error(`Inloggningen kunde inte registreras (${error.code}).`);
}
