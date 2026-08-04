import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseSecretKey } from "@/lib/supabase/env";

/**
 * Repairs a verified Auth user whose app profile was not created because an
 * older database trigger was missing or failed. Login itself never depends on
 * the secret key; this is only a server-side recovery path.
 */
export async function reconcileVerifiedAuthUser(authUserId: string): Promise<boolean> {
  if (!hasSupabaseSecretKey()) return false;

  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc("reconcile_verified_auth_user", {
      p_auth_user_id: authUserId,
    });
    if (error) {
      console.error("FaddeBo auth profile reconciliation failed", {
        code: error.code,
        message: error.message,
      });
      return false;
    }
    return true;
  } catch (error) {
    console.error("FaddeBo auth profile reconciliation unavailable", error);
    return false;
  }
}
