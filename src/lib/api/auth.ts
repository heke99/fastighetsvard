import { NextRequest } from "next/server";
import { sha256 } from "@/lib/crypto";
import { getTrustedClientIp } from "@/lib/http-client-ip";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasApiScope, type ApiScope } from "@/lib/permissions";
import type { ApiKey } from "@/lib/database-types";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiContext {
  apiKey: ApiKey;
  organizationId: string;
  correlationId: string;
  requestId: string;
}

/**
 * Autentisera API-anrop via Bearer-token (API-nyckel).
 * Kontrollerar aktiv status, utgångsdatum, revokering och IP-begränsning.
 */
export async function authenticateApiRequest(
  req: NextRequest,
  requiredScope?: ApiScope
): Promise<ApiContext> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new ApiError(401, "unauthenticated", "Authorization: Bearer <api-key> krävs.");
  }
  const key = header.slice(7).trim();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ApiKey")
    .select("id,organizationId,name,keyPrefix,keyHash,scopes,allowedIps,isActive,lastUsedAt,expiresAt,revokedAt")
    .eq("keyHash", sha256(key))
    .maybeSingle();
  if (error) {
    throw new ApiError(503, "api_key_lookup_failed", "API-nyckeln kunde inte verifieras.");
  }
  const apiKey = data as ApiKey | null;
  if (!apiKey || !apiKey.isActive || apiKey.revokedAt) {
    throw new ApiError(401, "invalid_api_key", "Ogiltig eller revokerad API-nyckel.");
  }
  if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
    throw new ApiError(401, "expired_api_key", "API-nyckeln har gått ut.");
  }
  if (apiKey.allowedIps.length > 0) {
    const ip = getTrustedClientIp(req.headers) ?? "";
    if (!apiKey.allowedIps.includes(ip)) {
      throw new ApiError(403, "ip_not_allowed", "Anrop från denna IP-adress är inte tillåtet.");
    }
  }
  if (requiredScope && !hasApiScope(apiKey.scopes, requiredScope)) {
    throw new ApiError(403, "insufficient_scope", `Nyckeln saknar behörighet: ${requiredScope}.`);
  }

  const { error: updateError } = await admin
    .from("ApiKey")
    .update({ lastUsedAt: new Date().toISOString() })
    .eq("id", apiKey.id);
  if (updateError) {
    throw new ApiError(503, "api_key_update_failed", "API-nyckeln kunde inte registreras.");
  }

  return {
    apiKey,
    organizationId: apiKey.organizationId,
    correlationId: req.headers.get("x-correlation-id") ?? `corr_${crypto.randomUUID()}`,
    requestId: `req_${crypto.randomUUID()}`,
  };
}

/** Distribuerad rate limiting genom en atomisk PostgreSQL-upsert. */
export async function checkRateLimit(keyId: string): Promise<void> {
  const { data, error } = await createAdminClient().rpc("consume_rate_limit", {
    p_scope: "api_key",
    p_subject: keyId,
    p_limit: 300,
    p_window_seconds: 60,
  });
  if (error) throw new ApiError(503, "rate_limit_unavailable", "Rate limiting kunde inte verifieras.");
  const result = data as { allowed?: boolean } | null;
  if (!result?.allowed) {
    throw new ApiError(429, "rate_limited", "För många anrop. Försök igen om en stund.");
  }
}
