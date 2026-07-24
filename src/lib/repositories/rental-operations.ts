import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const DOMAIN_ERROR_MESSAGES: Record<string, string> = {
  person_mismatch: "Åtgärden tillhör inte den inloggade personen.",
  organization_mismatch: "Åtgärden tillhör en annan organisation.",
  permission_denied: "Du saknar behörighet för åtgärden.",
  listing_not_found: "Annonsen hittades inte.",
  listing_not_open: "Annonsen är inte öppen för ansökningar.",
  application_deadline_passed: "Sista ansökningsdatum har passerat.",
  application_not_found: "Ansökan hittades inte.",
  application_not_offerable: "Ansökan är inte i ett läge där erbjudande kan skickas.",
  optimistic_lock_conflict: "Uppgifterna har ändrats av någon annan. Ladda om sidan och försök igen.",
  offer_not_found: "Erbjudandet hittades inte.",
  offer_person_mismatch: "Erbjudandet tillhör inte dig.",
  offer_not_open: "Erbjudandet är redan besvarat eller återkallat.",
  offer_expired: "Svarstiden för erbjudandet har gått ut.",
  unit_already_reserved: "Bostaden har redan reserverats.",
  unit_has_binding_contract: "Bostaden har redan ett bindande avtalsärende.",
  unit_not_available: "Bostaden är inte längre tillgänglig.",
  idempotency_key_reused_with_different_request: "Samma begäran har återanvänts med ändrade uppgifter.",
  signing_challenge_not_found: "Signeringskoden hittades inte.",
  signing_challenge_already_used: "Signeringskoden har redan använts.",
  signing_challenge_cancelled: "Signeringskoden har ersatts av en ny kod.",
  signing_challenge_expired: "Signeringskoden har gått ut.",
  signing_challenge_locked: "För många felaktiga försök. Begär en ny kod.",
  invalid_signing_code: "Fel signeringskod.",
  verified_email_required: "En verifierad e-postadress krävs för signering.",
  open_signing_session_missing: "Avtalet saknar en aktiv signeringssession.",
  contract_not_open_for_signing: "Avtalet är inte öppet för signering.",
  contract_party_not_signable: "Du är inte en osignerad part i avtalet.",
  contract_not_found: "Avtalet hittades inte.",
  contract_not_active: "Endast aktiva avtal kan sägas upp.",
  not_contract_party: "Du är inte part i avtalet.",
  termination_already_open: "Det finns redan en pågående uppsägning.",
  invitation_not_found: "Inbjudan är ogiltig.",
  invitation_already_used: "Inbjudan har redan använts.",
  invitation_expired: "Inbjudan har gått ut.",
  invitation_locked: "Inbjudan är låst efter för många försök.",
  auth_user_not_found: "Auth-kontot hittades inte.",
  auth_email_not_verified: "E-postadressen är inte verifierad.",
  invitation_email_mismatch: "Inbjudan är bunden till en annan e-postadress.",
  user_already_exists: "Det finns redan ett konto för e-postadressen.",
};

function normalizeRpcError(error: { message?: string; details?: string; hint?: string }): Error {
  const combined = [error.message, error.details, error.hint].filter(Boolean).join(" ");
  const key = Object.keys(DOMAIN_ERROR_MESSAGES).find((candidate) => combined.includes(candidate));
  return new Error(key ? DOMAIN_ERROR_MESSAGES[key] : error.message || "Databasoperationen misslyckades.");
}

async function rpc<T>(
  client: SupabaseClient,
  functionName: string,
  params: Record<string, unknown>
): Promise<T> {
  const { data, error } = await client.rpc(functionName, params);
  if (error) throw normalizeRpcError(error);
  return data as T;
}

export interface SubmittedApplicationResult {
  applicationId: string;
  listingId: string;
  status: "SUBMITTED";
  snapshotHash: string;
  isInternalTransfer: boolean;
}

export async function submitRentalApplication(input: {
  listingId: string;
  personId: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  requestHash: string;
}): Promise<SubmittedApplicationResult> {
  const client = await createServerSupabaseClient();
  return rpc(client, "submit_rental_application", {
    p_listing_id: input.listingId,
    p_person_id: input.personId,
    p_payload: input.payload,
    p_idempotency_key: input.idempotencyKey,
    p_request_hash: input.requestHash,
  });
}

export async function sendRentalOffer(input: {
  applicationId: string;
  expiresAt: Date;
  expectedApplicationVersion?: number;
}) {
  const client = await createServerSupabaseClient();
  return rpc<Record<string, unknown>>(client, "send_rental_offer", {
    p_application_id: input.applicationId,
    p_expires_at: input.expiresAt.toISOString(),
    p_expected_application_version: input.expectedApplicationVersion ?? null,
  });
}

export interface AcceptedOfferResult {
  offerId: string;
  status: "ACCEPTED";
  contractId: string;
  contractNumber: string;
  reservationId: string;
  terminationId: null;
  internalTransferPending: boolean;
}

export async function acceptRentalOffer(input: {
  offerId: string;
  personId: string;
  startDate?: Date;
  idempotencyKey: string;
  requestHash: string;
}): Promise<AcceptedOfferResult> {
  const client = await createServerSupabaseClient();
  return rpc(client, "accept_rental_offer", {
    p_offer_id: input.offerId,
    p_person_id: input.personId,
    p_start_date: input.startDate?.toISOString() ?? null,
    p_idempotency_key: input.idempotencyKey,
    p_request_hash: input.requestHash,
  });
}

export async function declineRentalOffer(input: {
  offerId: string;
  personId: string;
  idempotencyKey: string;
  requestHash: string;
}) {
  const client = await createServerSupabaseClient();
  return rpc<Record<string, unknown>>(client, "decline_rental_offer", {
    p_offer_id: input.offerId,
    p_person_id: input.personId,
    p_idempotency_key: input.idempotencyKey,
    p_request_hash: input.requestHash,
  });
}

export interface TerminationRequestResult {
  terminationId: string;
  status: "REQUESTED";
  effectiveEndDate: string;
  contractStatus: "ACTIVE";
}

export async function requestRentalContractTermination(input: {
  contractId: string;
  personId: string;
  desiredMoveOutDate: Date;
  reason?: string;
  isInternalTransfer?: boolean;
  newContractId?: string;
  idempotencyKey: string;
  requestHash: string;
}): Promise<TerminationRequestResult> {
  const client = await createServerSupabaseClient();
  return rpc(client, "request_contract_termination", {
    p_contract_id: input.contractId,
    p_person_id: input.personId,
    p_desired_move_out_date: input.desiredMoveOutDate.toISOString(),
    p_reason: input.reason ?? null,
    p_is_internal_transfer: input.isInternalTransfer ?? false,
    p_new_contract_id: input.newContractId ?? null,
    p_idempotency_key: input.idempotencyKey,
    p_request_hash: input.requestHash,
  });
}

export interface SigningChallengeResult {
  challengeId: string;
  signingSessionId: string;
  contractVersionId: string;
  documentHash: string;
  email: string;
  expiresAt: string;
}

export async function createEmailSigningChallenge(input: {
  contractId: string;
  personId: string;
  codeHash: string;
  destinationHash: string;
  expiresAt: Date;
}): Promise<SigningChallengeResult> {
  return rpc(createAdminClient(), "create_signing_challenge", {
    p_contract_id: input.contractId,
    p_person_id: input.personId,
    p_code_hash: input.codeHash,
    p_destination_hash: input.destinationHash,
    p_expires_at: input.expiresAt.toISOString(),
  });
}

export async function verifyEmailSigningChallenge(input: {
  challengeId: string;
  personId: string;
  codeHash: string;
  ip?: string;
  userAgent?: string;
}) {
  const client = await createServerSupabaseClient();
  const result = await rpc<{ ok?: boolean; error?: string; [key: string]: unknown }>(
    client,
    "verify_signing_challenge",
    {
      p_challenge_id: input.challengeId,
      p_person_id: input.personId,
      p_code_hash: input.codeHash,
      p_ip: input.ip ?? null,
      p_user_agent: input.userAgent ?? null,
    }
  );
  if (result.ok === false) {
    throw new Error(DOMAIN_ERROR_MESSAGES[result.error ?? ""] ?? "Signeringskoden kunde inte verifieras.");
  }
  return result;
}

export async function claimInvitation(input: { tokenHash: string; authUserId: string }) {
  const result = await rpc<{
    ok: boolean;
    error?: string;
    userId?: string;
    personId?: string;
    organizationId?: string;
    invitationId?: string;
  }>(createAdminClient(), "claim_invitation", {
    p_token_hash: input.tokenHash,
    p_auth_user_id: input.authUserId,
  });
  if (!result.ok || !result.userId || !result.personId || !result.organizationId || !result.invitationId) {
    const message = result.error ? DOMAIN_ERROR_MESSAGES[result.error] : undefined;
    throw new Error(message ?? "Inbjudan kunde inte aktiveras.");
  }
  return {
    userId: result.userId,
    personId: result.personId,
    organizationId: result.organizationId,
    invitationId: result.invitationId,
  };
}
