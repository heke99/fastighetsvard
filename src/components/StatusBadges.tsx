import type {
  ContractStatus,
  ApplicationStatus,
  InvoiceStatus,
  MaintenanceStatus,
  WorkOrderStatus,
} from "@prisma/client";

const contractLabels: Record<ContractStatus, [string, string]> = {
  DRAFT: ["Utkast", "bg-stone-100 text-stone-700"],
  INTERNAL_REVIEW: ["Intern granskning", "bg-stone-100 text-stone-700"],
  APPROVED: ["Godkänt", "bg-brand-50 text-brand-800"],
  SENT_FOR_SIGNING: ["Väntar på signering", "bg-accent-500/20 text-accent-600"],
  PARTIALLY_SIGNED: ["Delvis signerat", "bg-accent-500/20 text-accent-600"],
  SIGNED: ["Signerat", "bg-brand-50 text-brand-800"],
  ACTIVE: ["Aktivt", "bg-brand-100 text-brand-800"],
  TERMINATED: ["Uppsagt", "bg-orange-100 text-orange-800"],
  ENDED: ["Avslutat", "bg-stone-100 text-stone-600"],
  RESCINDED: ["Hävt", "bg-red-100 text-red-800"],
  ARCHIVED: ["Arkiverat", "bg-stone-100 text-stone-500"],
};

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  const [label, cls] = contractLabels[status];
  return <span className={`badge ${cls}`}>{label}</span>;
}

const applicationLabels: Record<ApplicationStatus, [string, string]> = {
  DRAFT: ["Utkast", "bg-stone-100 text-stone-700"],
  SUBMITTED: ["Inskickad", "bg-brand-50 text-brand-800"],
  RECEIVED: ["Mottagen", "bg-brand-50 text-brand-800"],
  UNDER_REVIEW: ["Under granskning", "bg-brand-50 text-brand-800"],
  NEEDS_SUPPLEMENT: ["Komplettering krävs", "bg-accent-500/20 text-accent-600"],
  QUALIFIED: ["Kvalificerad", "bg-brand-100 text-brand-800"],
  NOT_QUALIFIED: ["Ej kvalificerad", "bg-red-100 text-red-800"],
  VIEWING_OFFERED: ["Visning erbjuden", "bg-brand-50 text-brand-800"],
  VIEWING_BOOKED: ["Visning bokad", "bg-brand-50 text-brand-800"],
  OFFER_SENT: ["Erbjudande skickat", "bg-accent-500/20 text-accent-600"],
  ACCEPTED: ["Accepterad", "bg-brand-100 text-brand-800"],
  DECLINED: ["Avböjd", "bg-stone-100 text-stone-600"],
  CONTRACT_SENT: ["Avtal skickat", "bg-accent-500/20 text-accent-600"],
  CONTRACT_SIGNED: ["Avtal signerat", "bg-brand-100 text-brand-800"],
  CLOSED: ["Avslutad", "bg-stone-100 text-stone-600"],
  WITHDRAWN: ["Återkallad", "bg-stone-100 text-stone-600"],
};

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  const [label, cls] = applicationLabels[status];
  return <span className={`badge ${cls}`}>{label}</span>;
}

const invoiceLabels: Record<InvoiceStatus, [string, string]> = {
  DRAFT: ["Utkast", "bg-stone-100 text-stone-700"],
  SENT: ["Att betala", "bg-brand-50 text-brand-800"],
  PARTIALLY_PAID: ["Delbetald", "bg-accent-500/20 text-accent-600"],
  PAID: ["Betald", "bg-brand-100 text-brand-800"],
  OVERDUE: ["Förfallen", "bg-red-100 text-red-800"],
  REMINDED: ["Påmind", "bg-red-100 text-red-800"],
  COLLECTION: ["Inkasso", "bg-red-200 text-red-900"],
  CREDITED: ["Krediterad", "bg-stone-100 text-stone-600"],
  CANCELLED: ["Makulerad", "bg-stone-100 text-stone-500"],
  DISPUTED: ["Tvistig", "bg-orange-100 text-orange-800"],
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const [label, cls] = invoiceLabels[status];
  return <span className={`badge ${cls}`}>{label}</span>;
}

const maintenanceLabels: Record<MaintenanceStatus, [string, string]> = {
  RECEIVED: ["Inkommen", "bg-brand-50 text-brand-800"],
  CONFIRMED: ["Bekräftad", "bg-brand-50 text-brand-800"],
  ASSESSING: ["Under bedömning", "bg-brand-50 text-brand-800"],
  NEEDS_INFO: ["Komplettering krävs", "bg-accent-500/20 text-accent-600"],
  ASSIGNED: ["Tilldelad", "bg-brand-50 text-brand-800"],
  BOOKED: ["Bokad", "bg-brand-50 text-brand-800"],
  IN_PROGRESS: ["Pågående", "bg-accent-500/20 text-accent-600"],
  WAITING_TENANT: ["Väntar på dig", "bg-accent-500/20 text-accent-600"],
  WAITING_CONTRACTOR: ["Väntar på entreprenör", "bg-stone-100 text-stone-700"],
  WAITING_MATERIAL: ["Väntar på material", "bg-stone-100 text-stone-700"],
  DONE: ["Färdig", "bg-brand-100 text-brand-800"],
  QUALITY_CHECK: ["Kvalitetskontroll", "bg-brand-50 text-brand-800"],
  CLOSED: ["Stängd", "bg-stone-100 text-stone-600"],
  REJECTED: ["Avvisad", "bg-red-100 text-red-800"],
  REOPENED: ["Återöppnad", "bg-orange-100 text-orange-800"],
};

export function MaintenanceStatusBadge({ status }: { status: MaintenanceStatus }) {
  const [label, cls] = maintenanceLabels[status];
  return <span className={`badge ${cls}`}>{label}</span>;
}

const workOrderLabels: Record<WorkOrderStatus, [string, string]> = {
  CREATED: ["Skapad", "bg-stone-100 text-stone-700"],
  OFFERED: ["Erbjuden", "bg-accent-500/20 text-accent-600"],
  ACCEPTED: ["Accepterad", "bg-brand-50 text-brand-800"],
  REJECTED: ["Avvisad", "bg-red-100 text-red-800"],
  BOOKED: ["Bokad", "bg-brand-50 text-brand-800"],
  IN_PROGRESS: ["Pågående", "bg-accent-500/20 text-accent-600"],
  DONE: ["Utförd", "bg-brand-100 text-brand-800"],
  APPROVED: ["Godkänd", "bg-brand-100 text-brand-800"],
  INVOICED: ["Fakturerad", "bg-stone-100 text-stone-600"],
  CANCELLED: ["Avbruten", "bg-stone-100 text-stone-500"],
};

export function WorkOrderStatusBadge({ status }: { status: WorkOrderStatus }) {
  const [label, cls] = workOrderLabels[status];
  return <span className={`badge ${cls}`}>{label}</span>;
}
