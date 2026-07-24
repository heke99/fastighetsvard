import { randomInt } from "crypto";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { hmacSha256, sha256 } from "@/lib/crypto";
import { sendEmail } from "@/lib/email";
import { assertTransition, contractTransitions } from "@/lib/state-machines";
import { dispatchEvent } from "@/lib/services/webhooks";
import {
  createEmailSigningChallenge,
  requestRentalContractTermination,
  verifyEmailSigningChallenge,
} from "@/lib/repositories/rental-operations";
import type { ContractStatus, Database } from "@/lib/database-types";

/**
 * Äldre administrativ statusfunktion. Concurrency-kritiska övergångar som
 * signering, aktivering och uppsägning ska gå genom de särskilda RPC:erna.
 */
export async function changeContractStatus(
  organizationId: string,
  contractId: string,
  toStatus: ContractStatus,
  opts: { comment?: string; actorUserId?: string } = {}
) {
  const result = await db.$transaction(async (tx) => {
    const contract = await tx.contract.findFirst({ where: { id: contractId, organizationId } });
    if (!contract) throw new Error("Avtalet hittades inte.");
    assertTransition("contract", contractTransitions, contract.status, toStatus);
    const updated = await tx.contract.update({
      where: { id: contractId },
      data: {
        status: toStatus,
        activatedAt: toStatus === "ACTIVE" ? new Date() : contract.activatedAt,
        terminatedAt: toStatus === "TERMINATED" ? new Date() : contract.terminatedAt,
      },
    });
    await tx.contractStatusEvent.create({
      data: {
        contractId,
        fromStatus: contract.status,
        toStatus,
        comment: opts.comment ?? null,
        changedByUserId: opts.actorUserId ?? null,
      },
    });
    await audit(
      {
        organizationId,
        userId: opts.actorUserId,
        action: "status_change",
        entityType: "contract",
        entityId: contractId,
        before: { status: contract.status },
        after: { status: toStatus },
      },
      tx
    );
    return updated;
  });

  const eventMap: Partial<Record<ContractStatus, string>> = {
    SIGNED: "contract.signed",
    ACTIVE: "contract.activated",
    TERMINATED: "contract.terminated",
  };
  const event = eventMap[toStatus];
  if (event) {
    await dispatchEvent(organizationId, event, {
      contractId,
      contractNumber: result.contractNumber,
      status: toStatus,
    });
  }
  return result;
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

  const brand = process.env.BRAND_COMPANY_NAME?.trim() || "Fastighetsvärd";
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
  organizationId: string,
  contractId: string,
  content: Record<string, unknown>,
  actorUserId?: string
) {
  return db.$transaction(async (tx) => {
    const contract = await tx.contract.findFirst({
      where: { id: contractId, organizationId },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    });
    if (!contract) throw new Error("Avtalet hittades inte.");
    const nextVersion = (contract.versions[0]?.versionNumber ?? 0) + 1;
    return tx.contractVersion.create({
      data: {
        contractId,
        versionNumber: nextVersion,
        content: content as Database.InputJsonValue,
        createdByUserId: actorUserId ?? null,
      },
    });
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
