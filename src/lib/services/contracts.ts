import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertTransition, contractTransitions } from "@/lib/state-machines";
import { dispatchEvent } from "@/lib/services/webhooks";
import type { ContractStatus, Prisma } from "@prisma/client";

/** Statusändring med statusmaskin, historik och revisionslogg. */
export async function changeContractStatus(
  organizationId: string,
  contractId: string,
  toStatus: ContractStatus,
  opts: { comment?: string; actorUserId?: string } = {}
) {
  const result = await prisma.$transaction(async (tx) => {
    const contract = await tx.contract.findFirst({
      where: { id: contractId, organizationId },
    });
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

/**
 * Part signerar avtal. När alla parter signerat går avtalet till SIGNED.
 * Signerade dokument ändras aldrig – ändringar kräver ny version.
 */
export async function signContract(
  organizationId: string,
  contractId: string,
  personId: string,
  method: string = "email_code"
) {
  return prisma.$transaction(async (tx) => {
    const contract = await tx.contract.findFirst({
      where: { id: contractId, organizationId },
      include: { parties: true },
    });
    if (!contract) throw new Error("Avtalet hittades inte.");
    if (!["SENT_FOR_SIGNING", "PARTIALLY_SIGNED"].includes(contract.status)) {
      throw new Error("Avtalet är inte öppet för signering.");
    }
    const party = contract.parties.find((p) => p.personId === personId && !p.signedAt);
    if (!party) throw new Error("Du är inte signeringspart på detta avtal eller har redan signerat.");

    await tx.contractParty.update({
      where: { id: party.id },
      data: { signedAt: new Date(), signatureMethod: method },
    });

    const remaining = contract.parties.filter(
      (p) => p.id !== party.id && !p.signedAt && p.role !== "LANDLORD"
    );
    const newStatus: ContractStatus = remaining.length === 0 ? "SIGNED" : "PARTIALLY_SIGNED";
    assertTransition("contract", contractTransitions, contract.status, newStatus);

    const updated = await tx.contract.update({
      where: { id: contractId },
      data: { status: newStatus },
    });
    await tx.contractStatusEvent.create({
      data: { contractId, fromStatus: contract.status, toStatus: newStatus, comment: `Signerad av part ${personId}` },
    });
    await audit(
      {
        organizationId,
        action: "contract_signed_by_party",
        entityType: "contract",
        entityId: contractId,
        after: { personId, method, newStatus },
      },
      tx
    );
    return updated;
  });
}

/** Ny avtalsversion – används i stället för att ändra signerat innehåll. */
export async function createContractVersion(
  organizationId: string,
  contractId: string,
  content: Record<string, unknown>,
  actorUserId?: string
) {
  return prisma.$transaction(async (tx) => {
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
        content: content as Prisma.InputJsonValue,
        createdByUserId: actorUserId ?? null,
      },
    });
  });
}

/**
 * Uppsägning från Mina sidor. Beräknar tidigaste slutdatum enligt
 * uppsägningstid (kalendermånader: uppsägningstid räknas från nästkommande
 * månadsskifte).
 */
export function calculateEarliestEndDate(noticePeriodMonths: number, from: Date = new Date()): Date {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1 + noticePeriodMonths, 0));
  return d;
}

export async function requestTermination(
  organizationId: string,
  contractId: string,
  personId: string,
  desiredMoveOutDate: Date,
  opts: { reason?: string; isInternalTransfer?: boolean; newContractId?: string; actorUserId?: string } = {}
) {
  return prisma.$transaction(async (tx) => {
    const contract = await tx.contract.findFirst({
      where: { id: contractId, organizationId },
      include: { parties: true },
    });
    if (!contract) throw new Error("Avtalet hittades inte.");
    if (contract.status !== "ACTIVE") throw new Error("Endast aktiva avtal kan sägas upp.");
    const isParty = contract.parties.some(
      (p) => p.personId === personId && (p.role === "TENANT" || p.role === "CO_TENANT")
    );
    if (!isParty) throw new Error("Du är inte part i detta avtal.");

    const existing = await tx.termination.findFirst({
      where: { contractId, status: { in: ["REQUESTED", "CONFIRMED", "INSPECTION_BOOKED"] } },
    });
    if (existing) throw new Error("Det finns redan en pågående uppsägning för avtalet.");

    const earliestEndDate = calculateEarliestEndDate(contract.noticePeriodMonths);
    const effectiveEndDate =
      desiredMoveOutDate > earliestEndDate ? desiredMoveOutDate : earliestEndDate;

    const termination = await tx.termination.create({
      data: {
        organizationId,
        contractId,
        requestedByPersonId: personId,
        desiredMoveOutDate,
        earliestEndDate,
        effectiveEndDate,
        reason: opts.reason ?? null,
        isInternalTransfer: opts.isInternalTransfer ?? false,
        newContractId: opts.newContractId ?? null,
      },
    });

    assertTransition("contract", contractTransitions, contract.status, "TERMINATED");
    await tx.contract.update({
      where: { id: contractId },
      data: {
        status: "TERMINATED",
        terminatedAt: new Date(),
        terminationEffectiveDate: effectiveEndDate,
      },
    });
    await tx.contractStatusEvent.create({
      data: {
        contractId,
        fromStatus: contract.status,
        toStatus: "TERMINATED",
        comment: opts.isInternalTransfer ? "Uppsagt p.g.a. intern flytt" : "Uppsagt av hyresgäst",
      },
    });

    // Objektet blir kommande ledigt.
    await tx.unit.update({
      where: { id: contract.unitId },
      data: { status: "UPCOMING", availableFrom: effectiveEndDate },
    });

    await audit(
      {
        organizationId,
        userId: opts.actorUserId,
        action: "termination_requested",
        entityType: "termination",
        entityId: termination.id,
        after: {
          contractId,
          effectiveEndDate: effectiveEndDate.toISOString(),
          isInternalTransfer: opts.isInternalTransfer ?? false,
        },
      },
      tx
    );

    return termination;
  });
}
