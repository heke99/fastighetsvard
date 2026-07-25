import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

function failure(operation: string, code?: string): never {
  throw new Error(`${operation} misslyckades${code ? ` (${code})` : ""}.`);
}

export async function getInvitationPreview(tokenHash: string) {
  const admin = createAdminClient();
  const { data: invitation, error } = await admin
    .from("Invitation")
    .select("personId,acceptedAt,expiresAt")
    .eq("tokenHash", tokenHash)
    .maybeSingle();
  if (error) failure("Inbjudningskontroll", error.code);
  if (!invitation) return null;

  const { data: person, error: personError } = await admin
    .from("Person")
    .select("firstName")
    .eq("id", invitation.personId)
    .maybeSingle();
  if (personError) failure("Inbjudningsperson", personError.code);
  if (!person) return null;

  return {
    acceptedAt: invitation.acceptedAt as string | null,
    expiresAt: String(invitation.expiresAt),
    firstName: String(person.firstName),
  };
}

export async function findUserForPasswordReset(email: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("User")
    .select("id,organizationId")
    .eq("email", email)
    .eq("isActive", true)
    .maybeSingle();
  if (error) failure("Kontouppslag", error.code);
  return data
    ? { id: String(data.id), organizationId: String(data.organizationId) }
    : null;
}

export async function findUserByAuthId(authUserId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("User")
    .select("id,organizationId")
    .eq("authUserId", authUserId)
    .maybeSingle();
  if (error) failure("Auth-kontouppslag", error.code);
  return data
    ? { id: String(data.id), organizationId: String(data.organizationId) }
    : null;
}

export async function getInvitationClaimDetails(tokenHash: string) {
  const admin = createAdminClient();
  const { data: invitation, error } = await admin
    .from("Invitation")
    .select("id,personId,email,acceptedAt,expiresAt")
    .eq("tokenHash", tokenHash)
    .maybeSingle();
  if (error) failure("Inbjudningsclaim", error.code);
  if (!invitation) return null;
  const { data: person, error: personError } = await admin
    .from("Person")
    .select("firstName,lastName")
    .eq("id", invitation.personId)
    .maybeSingle();
  if (personError) failure("Inbjudningsperson", personError.code);
  if (!person) return null;
  return {
    id: String(invitation.id),
    email: String(invitation.email),
    acceptedAt: invitation.acceptedAt as string | null,
    expiresAt: String(invitation.expiresAt),
    person: {
      firstName: String(person.firstName),
      lastName: String(person.lastName),
    },
  };
}

export async function getDefaultOrganizationRecord() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("Organization")
    .select("id,name,legalName,orgNumber,email,phone,createdAt")
    .order("createdAt", { ascending: true })
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) failure("Standardorganisation", error.code);
  return data;
}
