import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { hasApiScope, type ApiScope } from "@/lib/permissions";
import type { ApiKey } from "@prisma/client";

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
  const apiKey = await prisma.apiKey.findUnique({ where: { keyHash: sha256(key) } });
  if (!apiKey || !apiKey.isActive || apiKey.revokedAt) {
    throw new ApiError(401, "invalid_api_key", "Ogiltig eller revokerad API-nyckel.");
  }
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    throw new ApiError(401, "expired_api_key", "API-nyckeln har gått ut.");
  }
  if (apiKey.allowedIps.length > 0) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
    if (!apiKey.allowedIps.includes(ip)) {
      throw new ApiError(403, "ip_not_allowed", "Anrop från denna IP-adress är inte tillåtet.");
    }
  }
  if (requiredScope && !hasApiScope(apiKey.scopes, requiredScope)) {
    throw new ApiError(403, "insufficient_scope", `Nyckeln saknar behörighet: ${requiredScope}.`);
  }

  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    apiKey,
    organizationId: apiKey.organizationId,
    correlationId: req.headers.get("x-correlation-id") ?? `corr_${crypto.randomUUID()}`,
    requestId: `req_${crypto.randomUUID()}`,
  };
}

/** Enkel in-memory rate limiting per API-nyckel (per instans). */
const buckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 300; // anrop per minut
const WINDOW_MS = 60_000;

export function checkRateLimit(keyId: string): void {
  const now = Date.now();
  const bucket = buckets.get(keyId);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(keyId, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  bucket.count++;
  if (bucket.count > RATE_LIMIT) {
    throw new ApiError(429, "rate_limited", "För många anrop. Försök igen om en stund.");
  }
}
