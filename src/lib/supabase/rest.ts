import { getSupabaseServerConfig } from "./config";

/**
 * Minimal server-only helper for Supabase REST/Storage calls without coupling
 * the existing Prisma auth/data layer to Supabase Auth.
 */
export async function supabaseServerFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const { url, serviceRoleKey } = getSupabaseServerConfig();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const headers = new Headers(init.headers);
  headers.set("apikey", serviceRoleKey);
  headers.set("Authorization", `Bearer ${serviceRoleKey}`);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${url}${normalizedPath}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}
