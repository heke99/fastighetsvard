import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import {
  assertTransition,
  applicationTransitions,
} from "@/lib/state-machines";
import { ensurePersonRole } from "@/lib/services/tenants";
import { dispatchEvent } from "@/lib/services/webhooks";
import type { ApplicationStatus, Prisma } from "@prisma/client";

export interface ApplicationInput {
  listingId: string;
  personId: string;
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

/**
 * Skapa och skicka in bostadsansökan.
 *
 * VIKTIGT: en befintlig hyresgäst blockeras ALDRIG från att ansöka.
 * Om personen har aktivt avtal flaggas ansökan automatiskt som möjlig
 * intern omflyttning så att handläggaren ser det.
 */
export async function submitApplication(organizationId: string, input: ApplicationInput) {
  const application = await prisma.$transaction(async (tx) => {
    const listing = await tx.listing.findFirst({
      where: { id: input.listingId, organizationId },
    });
    if (!listing) throw new Error("Annonsen hittades inte.");
    if (listing.status !== "PUBLISHED") {
      throw new Error("Annonsen är inte öppen för ansökningar.");
    }
    if (listing.applicationDeadline && listing.applicationDeadline < new Date()) {
      throw new Error("Sista ansökningsdatum har passerat.");
    }

    // Dubblettskydd: en aktiv ansökan per person och annons.
    const existing = await tx.application.findFirst({
      where: {
        listingId: listing.id,
        members: { some: { personId: input.personId, role: "MAIN_APPLICANT" } },
        status: { notIn: ["CLOSED", "WITHDRAWN", "DECLINED"] },
      },
    });
    if (existing) throw new Error("Du har redan en aktiv ansökan för denna annons.");

    // Har personen aktivt hyresavtal? Då är detta (potentiellt) en intern flytt.
    const activeContract = await tx.contract.findFirst({
      where: {
        organizationId,
        status: "ACTIVE",
        parties: { some: { personId: input.personId, role: { in: ["TENANT", "CO_TENANT"] } } },
      },
    });

    await ensurePersonRole(tx, input.personId, "APPLICANT");

    const app = await tx.application.create({
      data: {
        organizationId,
        listingId: listing.id,
        status: "SUBMITTED",
        isInternalTransfer: input.isInternalTransfer ?? Boolean(activeContract),
        desiredMoveInDate: input.desiredMoveInDate ?? null,
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
        consentGivenAt: new Date(),
        submittedAt: new Date(),
        members: {
          create: [
            { personId: input.personId, role: "MAIN_APPLICANT" },
            ...(input.coApplicants ?? []).map((c) => ({
              personId: c.personId,
              role: "CO_APPLICANT" as const,
            })),
          ],
        },
        statusHistory: {
          create: [{ toStatus: "SUBMITTED" as ApplicationStatus, comment: "Ansökan inskickad" }],
        },
      },
    });

    for (const c of input.coApplicants ?? []) {
      await ensurePersonRole(tx, c.personId, "CO_APPLICANT");
    }

    await tx.notification.create({
      data: {
        organizationId,
        personId: input.personId,
        eventType: "application_received",
        title: "Ansökan mottagen",
        body: `Vi har tagit emot din ansökan för ${listing.title}.`,
      },
    });

    await audit(
      {
        organizationId,
        action: "application_submitted",
        entityType: "application",
        entityId: app.id,
        after: { listingId: listing.id, personId: input.personId, internalTransfer: app.isInternalTransfer },
      },
      tx
    );

    return app;
  });

  await dispatchEvent(organizationId, "application.submitted", {
    applicationId: application.id,
    listingId: input.listingId,
  });
  return application;
}

export async function changeApplicationStatus(
  organizationId: string,
  applicationId: string,
  toStatus: ApplicationStatus,
  opts: { comment?: string; actorUserId?: string } = {}
) {
  return prisma.$transaction(async (tx) => {
    const app = await tx.application.findFirst({
      where: { id: applicationId, organizationId },
    });
    if (!app) throw new Error("Ansökan hittades inte.");
    assertTransition("application", applicationTransitions, app.status, toStatus);

    const updated = await tx.application.update({
      where: { id: applicationId },
      data: {
        status: toStatus,
        closedAt: ["CLOSED", "WITHDRAWN"].includes(toStatus) ? new Date() : app.closedAt,
      },
    });
    await tx.applicationStatusEvent.create({
      data: {
        applicationId,
        fromStatus: app.status,
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
        entityType: "application",
        entityId: applicationId,
        before: { status: app.status },
        after: { status: toStatus },
      },
      tx
    );
    return updated;
  });
}

export interface OfferAcceptResult {
  contractId: string;
  terminationId?: string;
}

/**
 * Skicka erbjudande till sökande. Ansökan går till OFFER_SENT.
 */
export async function sendOffer(
  organizationId: string,
  applicationId: string,
  opts: { expiresInDays?: number; actorUserId?: string } = {}
) {
  return prisma.$transaction(async (tx) => {
    const app = await tx.application.findFirst({
      where: { id: applicationId, organizationId },
      include: { members: true, listing: true },
    });
    if (!app) throw new Error("Ansökan hittades inte.");
    assertTransition("application", applicationTransitions, app.status, "OFFER_SENT");

    const main = app.members.find((m) => m.role === "MAIN_APPLICANT");
    if (!main) throw new Error("Ansökan saknar huvudsökande.");

    const offer = await tx.offer.create({
      data: {
        organizationId,
        listingId: app.listingId,
        applicationId: app.id,
        personId: main.personId,
        status: "SENT",
        isInternalTransfer: app.isInternalTransfer,
        expiresAt: new Date(Date.now() + (opts.expiresInDays ?? 5) * 24 * 60 * 60 * 1000),
      },
    });

    await tx.application.update({ where: { id: app.id }, data: { status: "OFFER_SENT" } });
    await tx.applicationStatusEvent.create({
      data: { applicationId: app.id, fromStatus: app.status, toStatus: "OFFER_SENT", changedByUserId: opts.actorUserId ?? null },
    });
    await tx.listing.update({ where: { id: app.listingId }, data: {} });
    await tx.unit.update({
      where: { id: app.listing.unitId },
      data: { status: "OFFER_SENT" },
    });
    await tx.notification.create({
      data: {
        organizationId,
        personId: main.personId,
        eventType: "offer_sent",
        title: "Du har fått ett erbjudande",
        body: `Du har erbjudits ${app.listing.title}. Svara senast ${offer.expiresAt.toLocaleDateString("sv-SE")}.`,
      },
    });
    await audit(
      {
        organizationId,
        userId: opts.actorUserId,
        action: "offer_sent",
        entityType: "offer",
        entityId: offer.id,
        after: { applicationId: app.id, personId: main.personId },
      },
      tx
    );
    return offer;
  });
}

/**
 * Sökande accepterar erbjudande.
 *
 * Vid intern flytt skapas det nya avtalet och det gamla sägs upp i SAMMA
 * transaktion. Datum samordnas: gamla avtalets slutdatum sätts till dagen
 * före nya avtalets start om uppsägningstiden tillåter, annars tillåts en
 * godkänd överlappning (aldrig oavsiktlig).
 */
export async function respondToOffer(
  organizationId: string,
  offerId: string,
  personId: string,
  accept: boolean,
  opts: { startDate?: Date; actorUserId?: string } = {}
): Promise<{ offer: unknown; contractId?: string; terminationId?: string }> {
  return prisma.$transaction(async (tx) => {
    const offer = await tx.offer.findFirst({
      where: { id: offerId, organizationId },
      include: { application: { include: { members: true } }, listing: { include: { unit: true } } },
    });
    if (!offer) throw new Error("Erbjudandet hittades inte.");
    if (offer.personId !== personId) throw new Error("Erbjudandet tillhör inte dig.");
    if (offer.status !== "SENT") throw new Error("Erbjudandet är redan besvarat.");
    if (offer.expiresAt < new Date()) throw new Error("Svarstiden har gått ut.");

    if (!accept) {
      const declined = await tx.offer.update({
        where: { id: offer.id },
        data: { status: "DECLINED", respondedAt: new Date() },
      });
      await tx.application.update({ where: { id: offer.applicationId }, data: { status: "DECLINED" } });
      await tx.applicationStatusEvent.create({
        data: { applicationId: offer.applicationId, fromStatus: "OFFER_SENT", toStatus: "DECLINED", comment: "Erbjudande avböjt" },
      });
      await tx.unit.update({
        where: { id: offer.listing.unitId },
        data: { status: "PUBLISHED" },
      });
      await audit(
        { organizationId, action: "offer_declined", entityType: "offer", entityId: offer.id },
        tx
      );
      return { offer: declined };
    }

    // Accept: skapa nytt avtalsutkast och skicka för signering.
    const unit = offer.listing.unit;
    const year = new Date().getFullYear();
    const seq = await tx.counter.upsert({
      where: { organizationId_key: { organizationId, key: "contract" } },
      create: { organizationId, key: "contract", value: 1 },
      update: { value: { increment: 1 } },
    });
    const contractNumber = `HK-${year}-${seq.value}`;
    const startDate = opts.startDate ?? offer.application.desiredMoveInDate ?? offer.listing.moveInDate ?? new Date();

    const contract = await tx.contract.create({
      data: {
        organizationId,
        unitId: unit.id,
        contractNumber,
        type: unit.type === "PARKING" ? "PARKING" : "RESIDENTIAL",
        status: "SENT_FOR_SIGNING",
        startDate,
        noticePeriodMonths: unit.noticePeriodMonths,
        rent: offer.listing.rent ?? unit.rent ?? 0,
        deposit: unit.deposit,
        parties: {
          create: offer.application.members
            .filter((m) => ["MAIN_APPLICANT", "CO_APPLICANT"].includes(m.role))
            .map((m) => ({
              personId: m.personId,
              role: m.role === "MAIN_APPLICANT" ? ("TENANT" as const) : ("CO_TENANT" as const),
            })),
        },
        versions: {
          create: [{ versionNumber: 1, content: { rent: String(offer.listing.rent ?? unit.rent ?? 0), startDate: startDate.toISOString() } }],
        },
        statusHistory: { create: [{ toStatus: "SENT_FOR_SIGNING", comment: "Skapat från accepterat erbjudande" }] },
      },
    });

    const accepted = await tx.offer.update({
      where: { id: offer.id },
      data: { status: "ACCEPTED", respondedAt: new Date(), contractId: contract.id },
    });
    await tx.application.update({ where: { id: offer.applicationId }, data: { status: "ACCEPTED" } });
    await tx.applicationStatusEvent.create({
      data: { applicationId: offer.applicationId, fromStatus: "OFFER_SENT", toStatus: "ACCEPTED", comment: "Erbjudande accepterat" },
    });
    await tx.application.update({ where: { id: offer.applicationId }, data: { status: "CONTRACT_SENT" } });
    await tx.applicationStatusEvent.create({
      data: { applicationId: offer.applicationId, fromStatus: "ACCEPTED", toStatus: "CONTRACT_SENT", comment: "Avtal skickat för signering" },
    });

    await tx.unit.update({ where: { id: unit.id }, data: { status: "CONTRACT_SENT" } });

    // Intern flytt: säg upp gamla avtalet samordnat med nya avtalets start.
    let terminationId: string | undefined;
    if (offer.isInternalTransfer) {
      const oldContract = await tx.contract.findFirst({
        where: {
          organizationId,
          status: "ACTIVE",
          id: { not: contract.id },
          parties: { some: { personId, role: { in: ["TENANT", "CO_TENANT"] } } },
        },
      });
      if (oldContract) {
        const { calculateEarliestEndDate } = await import("@/lib/services/contracts");
        const earliestEndDate = calculateEarliestEndDate(oldContract.noticePeriodMonths);
        const dayBeforeNewStart = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
        // Samordna: sluta dagen före inflytt om möjligt, annars godkänd överlappning
        // fram till tidigaste tillåtna slutdatum.
        const effectiveEndDate = dayBeforeNewStart >= earliestEndDate ? dayBeforeNewStart : earliestEndDate;

        const termination = await tx.termination.create({
          data: {
            organizationId,
            contractId: oldContract.id,
            requestedByPersonId: personId,
            desiredMoveOutDate: dayBeforeNewStart,
            earliestEndDate,
            effectiveEndDate,
            status: "CONFIRMED",
            isInternalTransfer: true,
            newContractId: contract.id,
            reason: "Intern omflyttning",
          },
        });
        terminationId = termination.id;

        await tx.contract.update({
          where: { id: oldContract.id },
          data: {
            status: "TERMINATED",
            terminatedAt: new Date(),
            terminationEffectiveDate: effectiveEndDate,
          },
        });
        await tx.contractStatusEvent.create({
          data: { contractId: oldContract.id, fromStatus: "ACTIVE", toStatus: "TERMINATED", comment: `Intern flytt till avtal ${contractNumber}` },
        });
        await tx.contract.update({
          where: { id: contract.id },
          data: { replacesContractId: oldContract.id },
        });
        await tx.unit.update({
          where: { id: oldContract.unitId },
          data: { status: "UPCOMING", availableFrom: effectiveEndDate },
        });
      }
    }

    await tx.notification.create({
      data: {
        organizationId,
        personId,
        eventType: "contract_sent",
        title: "Avtal att signera",
        body: `Avtal ${contractNumber} är skickat till dig för signering.`,
      },
    });

    await audit(
      {
        organizationId,
        userId: opts.actorUserId,
        action: "offer_accepted",
        entityType: "offer",
        entityId: offer.id,
        after: { contractId: contract.id, terminationId: terminationId ?? null },
      },
      tx
    );

    return { offer: accepted, contractId: contract.id, terminationId };
  });
}

export async function listApplicationsForPerson(organizationId: string, personId: string) {
  return prisma.application.findMany({
    where: {
      organizationId,
      members: { some: { personId } },
    },
    include: {
      listing: { include: { unit: { select: { address: true, city: true, unitNumber: true } } } },
      offers: { where: { status: "SENT" } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export type ApplicationWithRelations = Prisma.ApplicationGetPayload<{
  include: {
    listing: { include: { unit: true } };
    members: { include: { person: true } };
    offers: true;
  };
}>;
