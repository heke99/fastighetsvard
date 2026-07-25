import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

type Row = Record<string, any>;

function fail(operation: string, error: { code?: string; message?: string } | null): never {
  throw new Error(`${operation} misslyckades (${error?.code ?? "database_error"}).`);
}

export async function findTenantPerson(
  organizationId: string,
  input: { email?: string | null; personalNumber?: string | null }
) {
  const admin = createAdminClient();
  if (input.email) {
    const { data, error } = await admin
      .from("Person")
      .select("id,organizationId,firstName,lastName,email,phone,personalNumber,address,postalCode,city")
      .eq("organizationId", organizationId)
      .eq("email", input.email.toLowerCase().trim())
      .limit(2);
    if (error) fail("Personmatchning via e-post", error);
    if ((data ?? []).length === 1) {
      return { person: data![0] as unknown as Row, matchedBy: "email" as const };
    }
  }
  if (input.personalNumber) {
    const normalized = input.personalNumber.replace(/[^0-9]/g, "");
    if (normalized.length >= 10) {
      const { data, error } = await admin
        .from("Person")
        .select("id,organizationId,firstName,lastName,email,phone,personalNumber,address,postalCode,city")
        .eq("organizationId", organizationId)
        .eq("personalNumber", normalized)
        .limit(2);
      if (error) fail("Personmatchning via personnummer", error);
      if ((data ?? []).length === 1) {
        return { person: data![0] as unknown as Row, matchedBy: "personalNumber" as const };
      }
    }
  }
  return null;
}

export async function getImportUnitState(organizationId: string, unitNumber: string) {
  const admin = createAdminClient();
  const { data: unit, error: unitError } = await admin
    .from("Unit")
    .select("id,unitNumber")
    .eq("organizationId", organizationId)
    .eq("unitNumber", unitNumber)
    .maybeSingle();
  if (unitError) fail("Importobjekt", unitError);
  if (!unit) return { unit: null, hasActiveContract: false };
  const { data: contract, error: contractError } = await admin
    .from("Contract")
    .select("id")
    .eq("organizationId", organizationId)
    .eq("unitId", unit.id)
    .in("status", ["ACTIVE", "SIGNED"])
    .limit(1)
    .maybeSingle();
  if (contractError) fail("Importobjektets avtal", contractError);
  return { unit: unit as unknown as Row, hasActiveContract: Boolean(contract) };
}

export async function createInvitationRecord(input: {
  organizationId: string;
  personId: string;
  tokenHash: string;
  expiresAt: Date;
  actorUserId?: string;
}) {
  const { data, error } = await createAdminClient().rpc("create_person_invitation", {
    p_organization_id: input.organizationId,
    p_person_id: input.personId,
    p_token_hash: input.tokenHash,
    p_expires_at: input.expiresAt.toISOString(),
    p_actor_user_id: input.actorUserId ?? null,
  });
  if (error) {
    const message =
      error.message.includes("person_not_found") ? "Personen hittades inte."
      : error.message.includes("person_email_missing") ? "Personen saknar e-postadress."
      : error.message.includes("person_already_has_account") ? "Personen har redan ett konto."
      : null;
    if (message) throw new Error(message);
    fail("Skapa inbjudan", error);
  }
  return data as { id: string; email: string; personId: string; expiresAt: string };
}

export async function createImportJobRecord(input: {
  organizationId: string;
  totalRows: number;
  actorUserId?: string;
  fileName?: string;
}) {
  const { data, error } = await createAdminClient()
    .from("ImportJob")
    .insert({
      id: randomUUID(),
      organizationId: input.organizationId,
      importType: "tenants",
      fileName: input.fileName ?? null,
      status: "RUNNING",
      totalRows: input.totalRows,
      createdByUserId: input.actorUserId ?? null,
      startedAt: new Date().toISOString(),
    })
    .select("id,status,totalRows,successRows,errorRows,skippedRows,createdAt")
    .single();
  if (error) fail("Starta importjobb", error);
  return data as unknown as Row;
}

export async function finishImportJobRecord(
  organizationId: string,
  jobId: string,
  input: {
    status: string;
    successRows: number;
    errorRows: number;
    skippedRows: number;
    rowResults: unknown;
  }
) {
  const { data, error } = await createAdminClient()
    .from("ImportJob")
    .update({ ...input, finishedAt: new Date().toISOString() })
    .eq("organizationId", organizationId)
    .eq("id", jobId)
    .select("id,status,totalRows,successRows,errorRows,skippedRows,createdAt")
    .single();
  if (error) fail("Slutför importjobb", error);
  return data as unknown as Row;
}
