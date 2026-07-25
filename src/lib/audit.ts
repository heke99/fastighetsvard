import type { Database } from "@/lib/database-types";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AuditInput {
  organizationId?: string | null;
  userId?: string | null;
  actorType?: "user" | "api_key" | "system" | "webhook";
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  correlationId?: string | null;
}

/** Fält som aldrig får hamna i revisionsloggen i klartext. */
const SENSITIVE_KEYS = new Set([
  "password", "passwordHash", "tokenHash", "secret", "keyHash",
  "credentialsEncrypted", "twoFactorSecret", "personalNumber",
]);

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEYS.has(k) ? "[REDACTED]" : redact(v);
    }
    return out;
  }
  return value;
}

export async function audit(input: AuditInput) {
  const data = {
      organizationId: input.organizationId ?? null,
      userId: input.userId ?? null,
      actorType: input.actorType ?? "user",
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      before: input.before === undefined ? undefined : (redact(input.before) as Database.InputJsonValue),
      after: input.after === undefined ? undefined : (redact(input.after) as Database.InputJsonValue),
      ip: input.ip ?? null,
      correlationId: input.correlationId ?? null,
  };
  const { error } = await createAdminClient().from("AuditEvent").insert(data);
  if (error) throw new Error(`Audit kunde inte skrivas (${error.code}).`);
}
