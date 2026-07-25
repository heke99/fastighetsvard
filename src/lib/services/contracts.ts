import { randomInt } from "crypto";
import { hmacSha256, sha256 } from "@/lib/crypto";
import { sendEmail } from "@/lib/email";
import { getBranding } from "@/lib/branding";
import {
  activateSignedRentalContract,
  changeRentalContractStatus,
  createRentalContractVersion,
  createEmailSigningChallenge,
  requestRentalContractTermination,
  verifyEmailSigningChallenge,
} from "@/lib/repositories/rental-operations";
import type { ContractStatus } from "@/lib/database-types";

export async function changeContractStatus(
  _organizationId: string,
  contractId: string,
  toStatus: ContractStatus,
  opts: {
    expectedStatus: ContractStatus;
    comment?: string;
    idempotencyKey?: string;
  }
) {
  if (toStatus === "ACTIVE") {
    if (!opts.idempotencyKey) throw new Error("Idempotency key krävs för avtalsaktivering.");
    return activateSignedRentalContract({
      contractId,
      idempotencyKey: opts.idempotencyKey,
      requestHash: sha256(JSON.stringify({
        contractId,
        expectedStatus: opts.expectedStatus,
        toStatus,
      })),
    });
  }
  return changeRentalContractStatus({
    contractId,
    expectedStatus: opts.expectedStatus,
    toStatus,
    comment: opts.comment,
  });
}

/** Begär en kortlivad och single-use e-postkod bunden till dokumenthashen. */
function signingOtpHash(challengeSecret: string): string {
  const pepper = process.env.SIGNING_OTP_PEPPER;
  if (!pepper || pepper.length < 32) {
    throw new Error("SIGNING_OTP_PEPPER måste vara minst 32 tecken.");
  }
  return hmacSha256(pepper, challengeSecret);
}

export async function requestContractSigningCode(input: {
  contractId: string;
  personId: string;
  verifiedEmail: string;
}) {
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const challenge = await createEmailSigningChallenge({
    contractId: input.contractId,
    personId: input.personId,
    codeHash: signingOtpHash(code),
    destinationHash: sha256(input.verifiedEmail.toLowerCase().trim()),
    expiresAt,
  });

  const brand = getBranding().brandName;
  await sendEmail({
    to: input.verifiedEmail,
    subject: `Signeringskod för ditt avtal hos ${brand}`,
    text: `Din signeringskod är ${code}. Koden gäller i 10 minuter och kan bara användas en gång.`,
    html: `<p>Din signeringskod är <strong>${code}</strong>.</p><p>Koden gäller i 10 minuter och kan bara användas en gång.</p>`,
  });

  return {
    challengeId: challenge.challengeId,
    expiresAt: challenge.expiresAt,
    maskedDestination: input.verifiedEmail.replace(/^(.{1,2}).*(@.*)$/, "$1••••$2"),
  };
}

/** Verifierar OTP och registrerar signaturen atomiskt mot exakt dokumenthash. */
export async function verifyContractSigningCode(input: {
  challengeId: string;
  personId: string;
  code: string;
  ip?: string;
  userAgent?: string;
}) {
  if (!/^\d{6}$/.test(input.code)) throw new Error("Signeringskoden ska bestå av sex siffror.");
  return verifyEmailSigningChallenge({
    challengeId: input.challengeId,
    personId: input.personId,
    codeHash: signingOtpHash(input.code),
    ip: input.ip,
    userAgent: input.userAgent,
  });
}

/** Ny avtalsversion för osignerade avtal. Full adminmigrering till RPC återstår. */
export async function createContractVersion(
  _organizationId: string,
  contractId: string,
  content: Record<string, unknown>,
  expectedContractVersion: number
) {
  return createRentalContractVersion({
    contractId,
    content,
    documentHash: sha256(JSON.stringify(content)),
    expectedContractVersion,
  });
}

export function calculateEarliestEndDate(noticePeriodMonths: number, from: Date = new Date()): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1 + noticePeriodMonths, 0));
}

/**
 * Registrerar en uppsägningsbegäran men lämnar kontraktet ACTIVE under hela
 * uppsägningstiden. Först complete_move_out får avsluta kontraktet.
 */
export async function requestTermination(
  _organizationId: string,
  contractId: string,
  personId: string,
  desiredMoveOutDate: Date,
  opts: { reason?: string; isInternalTransfer?: boolean; newContractId?: string; actorUserId?: string; idempotencyKey: string }
) {
  const requestHash = sha256(JSON.stringify({
    contractId,
    personId,
    desiredMoveOutDate: desiredMoveOutDate.toISOString(),
    reason: opts.reason ?? null,
    isInternalTransfer: opts.isInternalTransfer ?? false,
    newContractId: opts.newContractId ?? null,
  }));
  return requestRentalContractTermination({
    contractId,
    personId,
    desiredMoveOutDate,
    reason: opts.reason,
    isInternalTransfer: opts.isInternalTransfer,
    newContractId: opts.newContractId,
    idempotencyKey: opts.idempotencyKey,
    requestHash,
  });
}
