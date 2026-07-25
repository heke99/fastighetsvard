import { sha256 } from "@/lib/crypto";
import {
  acceptRentalOffer,
  changeRentalApplicationStatus,
  declineRentalOffer,
  sendRentalOffer,
  submitRentalApplication,
} from "@/lib/repositories/rental-operations";
import type { ApplicationStatus } from "@/lib/database-types";

export interface ApplicationInput {
  listingId: string;
  personId: string;
  idempotencyKey: string;
  desiredMoveInDate?: Date;
  isInternalTransfer?: boolean;
  currentHousing?: string;
  currentLandlord?: string;
  employment?: string;
  employer?: string;
  employmentType?: string;
  monthlyIncome?: number;
  otherIncome?: string;
  references?: string;
  pets?: string;
  vehicles?: string;
  specialNeeds?: string;
  message?: string;
  coApplicants?: { personId: string }[];
}

/** Atomiskt ansökningsinskick med immutable snapshot och idempotens i PostgreSQL. */
export async function submitApplication(_organizationId: string, input: ApplicationInput) {
  const payload: Record<string, unknown> = {
    desiredMoveInDate: input.desiredMoveInDate?.toISOString() ?? null,
    isInternalTransfer: input.isInternalTransfer,
    currentHousing: input.currentHousing ?? null,
    currentLandlord: input.currentLandlord ?? null,
    employment: input.employment ?? null,
    employer: input.employer ?? null,
    employmentType: input.employmentType ?? null,
    monthlyIncome: input.monthlyIncome ?? null,
    otherIncome: input.otherIncome ?? null,
    references: input.references ?? null,
    pets: input.pets ?? null,
    vehicles: input.vehicles ?? null,
    specialNeeds: input.specialNeeds ?? null,
    message: input.message ?? null,
    coApplicants: input.coApplicants ?? [],
    consentVersion: "privacy-v1",
    consentTextHash: sha256("privacy-v1:rental-application-processing"),
  };
  const requestHash = sha256(JSON.stringify({ listingId: input.listingId, personId: input.personId, payload }));
  return submitRentalApplication({
    listingId: input.listingId,
    personId: input.personId,
    payload,
    idempotencyKey: input.idempotencyKey,
    requestHash,
  });
}

export async function changeApplicationStatus(
  _organizationId: string,
  applicationId: string,
  toStatus: ApplicationStatus,
  opts: { expectedStatus: ApplicationStatus; comment?: string }
) {
  return changeRentalApplicationStatus({
    applicationId,
    expectedStatus: opts.expectedStatus,
    toStatus,
    comment: opts.comment,
  });
}

/** Skickar erbjudande, uppdaterar ansökan/objekt och skapar outbox/audit atomiskt. */
export async function sendOffer(
  _organizationId: string,
  applicationId: string,
  opts: { expiresInDays?: number; actorUserId?: string; expectedApplicationVersion?: number } = {}
) {
  const expiresAt = new Date(Date.now() + (opts.expiresInDays ?? 5) * 24 * 60 * 60 * 1000);
  return sendRentalOffer({
    applicationId,
    expiresAt,
    expectedApplicationVersion: opts.expectedApplicationVersion,
  });
}

export interface OfferAcceptResult {
  contractId: string;
  terminationId?: string;
}

/**
 * Sökandens svar sker i PostgreSQL. En internflytt markerar endast att ett
 * samordnat avslut återstår; det gamla avtalet avslutas aldrig vid acceptans.
 */
export async function respondToOffer(
  _organizationId: string,
  offerId: string,
  personId: string,
  accept: boolean,
  opts: { startDate?: Date; actorUserId?: string; idempotencyKey: string }
): Promise<{ offer: unknown; contractId?: string; terminationId?: string; internalTransferPending?: boolean }> {
  if (!accept) {
    const requestHash = sha256(JSON.stringify({ offerId, personId, response: "decline" }));
    const offer = await declineRentalOffer({
      offerId,
      personId,
      idempotencyKey: opts.idempotencyKey,
      requestHash,
    });
    return { offer };
  }
  const requestHash = sha256(JSON.stringify({ offerId, personId, response: "accept", startDate: opts.startDate?.toISOString() ?? null }));
  const result = await acceptRentalOffer({
    offerId,
    personId,
    startDate: opts.startDate,
    idempotencyKey: opts.idempotencyKey,
    requestHash,
  });
  return {
    offer: result,
    contractId: result.contractId,
    terminationId: undefined,
    internalTransferPending: result.internalTransferPending,
  };
}
