import type {
  ListingStatus,
  ApplicationStatus,
  ContractStatus,
  InvoiceStatus,
  MaintenanceStatus,
  WorkOrderStatus,
} from "@prisma/client";

/**
 * Kontrollerade statusövergångar. Ogiltiga övergångar blockeras i backend
 * genom att `assertTransition` kastar fel.
 */

type TransitionMap<S extends string> = Record<S, S[]>;

export const listingTransitions: TransitionMap<ListingStatus> = {
  DRAFT: ["SCHEDULED", "PUBLISHED", "UNPUBLISHED"],
  SCHEDULED: ["PUBLISHED", "DRAFT", "UNPUBLISHED"],
  PUBLISHED: ["PAUSED", "UNPUBLISHED", "COMPLETED"],
  PAUSED: ["PUBLISHED", "UNPUBLISHED"],
  UNPUBLISHED: ["PUBLISHED", "COMPLETED", "DRAFT"],
  COMPLETED: [],
};

export const applicationTransitions: TransitionMap<ApplicationStatus> = {
  DRAFT: ["SUBMITTED", "WITHDRAWN"],
  SUBMITTED: ["RECEIVED", "WITHDRAWN"],
  RECEIVED: ["UNDER_REVIEW", "WITHDRAWN"],
  UNDER_REVIEW: ["NEEDS_SUPPLEMENT", "QUALIFIED", "NOT_QUALIFIED", "WITHDRAWN"],
  NEEDS_SUPPLEMENT: ["UNDER_REVIEW", "WITHDRAWN"],
  QUALIFIED: ["VIEWING_OFFERED", "OFFER_SENT", "WITHDRAWN", "CLOSED"],
  NOT_QUALIFIED: ["CLOSED", "UNDER_REVIEW"],
  VIEWING_OFFERED: ["VIEWING_BOOKED", "OFFER_SENT", "WITHDRAWN", "CLOSED"],
  VIEWING_BOOKED: ["OFFER_SENT", "QUALIFIED", "WITHDRAWN", "CLOSED"],
  OFFER_SENT: ["ACCEPTED", "DECLINED", "WITHDRAWN"],
  ACCEPTED: ["CONTRACT_SENT", "CLOSED"],
  DECLINED: ["CLOSED", "OFFER_SENT"],
  CONTRACT_SENT: ["CONTRACT_SIGNED", "CLOSED"],
  CONTRACT_SIGNED: ["CLOSED"],
  CLOSED: [],
  WITHDRAWN: [],
};

export const contractTransitions: TransitionMap<ContractStatus> = {
  DRAFT: ["INTERNAL_REVIEW", "APPROVED", "ARCHIVED"],
  INTERNAL_REVIEW: ["APPROVED", "DRAFT"],
  APPROVED: ["SENT_FOR_SIGNING", "DRAFT"],
  SENT_FOR_SIGNING: ["PARTIALLY_SIGNED", "SIGNED", "DRAFT"],
  PARTIALLY_SIGNED: ["SIGNED", "DRAFT"],
  SIGNED: ["ACTIVE"],
  ACTIVE: ["TERMINATED", "RESCINDED"],
  TERMINATED: ["ENDED", "ACTIVE"], // ACTIVE = ångrad uppsägning
  ENDED: ["ARCHIVED"],
  RESCINDED: ["ARCHIVED"],
  ARCHIVED: [],
};

export const invoiceTransitions: TransitionMap<InvoiceStatus> = {
  DRAFT: ["SENT", "CANCELLED"],
  SENT: ["PARTIALLY_PAID", "PAID", "OVERDUE", "CREDITED", "CANCELLED", "DISPUTED"],
  PARTIALLY_PAID: ["PAID", "OVERDUE", "CREDITED", "DISPUTED"],
  PAID: ["CREDITED"],
  OVERDUE: ["REMINDED", "PARTIALLY_PAID", "PAID", "COLLECTION", "CREDITED", "DISPUTED"],
  REMINDED: ["PARTIALLY_PAID", "PAID", "COLLECTION", "CREDITED", "DISPUTED"],
  COLLECTION: ["PAID", "PARTIALLY_PAID", "CREDITED"],
  CREDITED: [],
  CANCELLED: [],
  DISPUTED: ["SENT", "PAID", "CREDITED", "CANCELLED"],
};

export const maintenanceTransitions: TransitionMap<MaintenanceStatus> = {
  RECEIVED: ["CONFIRMED", "REJECTED"],
  CONFIRMED: ["ASSESSING", "ASSIGNED", "REJECTED"],
  ASSESSING: ["NEEDS_INFO", "ASSIGNED", "REJECTED"],
  NEEDS_INFO: ["ASSESSING", "ASSIGNED", "REJECTED"],
  ASSIGNED: ["BOOKED", "IN_PROGRESS", "ASSESSING"],
  BOOKED: ["IN_PROGRESS", "ASSIGNED"],
  IN_PROGRESS: ["WAITING_TENANT", "WAITING_CONTRACTOR", "WAITING_MATERIAL", "DONE"],
  WAITING_TENANT: ["IN_PROGRESS", "DONE"],
  WAITING_CONTRACTOR: ["IN_PROGRESS", "DONE"],
  WAITING_MATERIAL: ["IN_PROGRESS", "DONE"],
  DONE: ["QUALITY_CHECK", "CLOSED", "REOPENED"],
  QUALITY_CHECK: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REJECTED: ["REOPENED"],
  REOPENED: ["ASSESSING", "ASSIGNED", "IN_PROGRESS"],
};

export const workOrderTransitions: TransitionMap<WorkOrderStatus> = {
  CREATED: ["OFFERED", "BOOKED", "IN_PROGRESS", "CANCELLED"],
  OFFERED: ["ACCEPTED", "REJECTED", "CANCELLED"],
  ACCEPTED: ["BOOKED", "IN_PROGRESS", "CANCELLED"],
  REJECTED: ["OFFERED", "CANCELLED"],
  BOOKED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["DONE", "CANCELLED"],
  DONE: ["APPROVED", "IN_PROGRESS"],
  APPROVED: ["INVOICED"],
  INVOICED: [],
  CANCELLED: [],
};

export class InvalidTransitionError extends Error {
  constructor(
    public entity: string,
    public from: string,
    public to: string
  ) {
    super(`Ogiltig statusövergång för ${entity}: ${from} → ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function canTransition<S extends string>(
  map: TransitionMap<S>,
  from: S,
  to: S
): boolean {
  return (map[from] ?? []).includes(to);
}

export function assertTransition<S extends string>(
  entity: string,
  map: TransitionMap<S>,
  from: S,
  to: S
): void {
  if (!canTransition(map, from, to)) {
    throw new InvalidTransitionError(entity, from, to);
  }
}
