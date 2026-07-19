import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseSecretKey, getSupabaseUrl } from "./env";

let adminClient: SupabaseClient | undefined;

/** Server-only client for trusted administration and API-key integrations. */
export function createAdminClient(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(getSupabaseUrl(), getSupabaseSecretKey(), {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: { headers: { "X-Client-Info": "ostgota-fastighet-server" } },
    });
  }
  return adminClient;
}
