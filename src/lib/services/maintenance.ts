import {
  changeMaintenanceStatusCommand,
  changeWorkOrderStatusCommand,
  createMaintenanceRequestCommand,
  createWorkOrderCommand,
} from "@/lib/repositories/maintenance-operations";
import { getMaintenanceNotificationContext } from "@/lib/repositories/maintenance-notifications";
import {
  sendMaintenanceInternalAlertEmail,
  sendMaintenanceReceiptEmail,
  sendMaintenanceStatusEmail,
  type MaintenanceEmailInput,
} from "@/lib/email";
import { getBranding } from "@/lib/branding";
import { dispatchEvent } from "@/lib/services/webhooks";
import type {
  MaintenancePriority,
  MaintenanceStatus,
  WorkOrderStatus,
} from "@/lib/database-types";

export interface MaintenanceRequestInput {
  propertyId?: string;
  unitId?: string;
  personId?: string;
  category: string;
  subcategory?: string;
  room?: string;
  title: string;
  description: string;
  priority?: MaintenancePriority;
  discoveredAt?: Date;
  contactPhone?: string;
  preferredTime?: string;
  masterKeyAllowed?: boolean;
  petsInHome?: boolean;
  isEmergency?: boolean;
}

function toEmailInput(context: NonNullable<Awaited<ReturnType<typeof getMaintenanceNotificationContext>>>): MaintenanceEmailInput {
  return {
    requestId: context.id,
    requestNumber: context.requestNumber,
    title: context.title,
    description: context.description,
    category: context.category,
    status: context.status,
    isEmergency: context.isEmergency,
    reporterName: context.person
      ? `${context.person.firstName} ${context.person.lastName}`.trim()
      : undefined,
    reporterEmail: context.person?.email,
    reporterPhone: context.person?.phone,
    location: context.unit
      ? `${context.unit.unitNumber} · ${context.unit.address}, ${context.unit.city}`
      : "Allmänt utrymme",
  };
}

async function notifyCreated(organizationId: string, requestId: string): Promise<void> {
  try {
    const context = await getMaintenanceNotificationContext(organizationId, requestId);
    if (!context) return;
    const input = toEmailInput(context);
    const jobs: Promise<void>[] = [
      sendMaintenanceInternalAlertEmail(getBranding().faultReportEmail, input),
    ];
    if (context.person?.email) jobs.push(sendMaintenanceReceiptEmail(context.person.email, input));
    const results = await Promise.allSettled(jobs);
    for (const result of results) {
      if (result.status === "rejected") console.error("FaddeBo maintenance email failed", result.reason);
    }
  } catch (error) {
    console.error("FaddeBo maintenance notification context failed", error);
  }
}

async function notifyStatus(organizationId: string, requestId: string): Promise<void> {
  try {
    const context = await getMaintenanceNotificationContext(organizationId, requestId);
    if (!context?.person?.email) return;
    await sendMaintenanceStatusEmail(context.person.email, toEmailInput(context));
  } catch (error) {
    console.error("FaddeBo maintenance status email failed", error);
  }
}

async function runPostCommitEffects(
  effects: Array<{ label: string; task: Promise<unknown> }>
): Promise<void> {
  const results = await Promise.allSettled(effects.map((effect) => effect.task));
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`FaddeBo maintenance ${effects[index]?.label ?? "side effect"} failed`, result.reason);
    }
  });
}

export async function createMaintenanceRequest(
  organizationId: string,
  input: MaintenanceRequestInput,
  actorUserId?: string
) {
  const request = await createMaintenanceRequestCommand({
    organizationId,
    ...input,
    actorUserId,
  });
  await runPostCommitEffects([
    {
      label: "created webhook",
      task: dispatchEvent(organizationId, "maintenance_request.created", {
        maintenanceRequestId: request.id,
        requestNumber: request.requestNumber,
        title: request.title,
      }),
    },
    {
      label: "created email",
      task: notifyCreated(organizationId, String(request.id)),
    },
  ]);
  return request;
}

export async function changeMaintenanceStatus(
  organizationId: string,
  requestId: string,
  toStatus: MaintenanceStatus,
  opts: {
    comment?: string;
    actorUserId?: string;
    expectedStatus?: MaintenanceStatus;
  } = {}
) {
  const updated = await changeMaintenanceStatusCommand({
    organizationId,
    requestId,
    expectedStatus: opts.expectedStatus,
    toStatus,
    comment: opts.comment,
    actorUserId: opts.actorUserId,
  });
  const effects: Array<{ label: string; task: Promise<unknown> }> = [
    {
      label: "status email",
      task: notifyStatus(organizationId, requestId),
    },
  ];
  if (toStatus === "DONE") {
    effects.push({
      label: "completed webhook",
      task: dispatchEvent(organizationId, "maintenance_request.completed", {
        maintenanceRequestId: requestId,
      }),
    });
  }
  await runPostCommitEffects(effects);
  return updated;
}

export interface WorkOrderInput {
  requestId?: string;
  supplierId?: string;
  assigneeUserId?: string;
  title: string;
  description: string;
  priority?: MaintenancePriority;
  accessInfo?: string;
  scheduledAt?: Date;
}

export function createWorkOrder(
  organizationId: string,
  input: WorkOrderInput,
  actorUserId?: string
) {
  return createWorkOrderCommand({
    organizationId,
    ...input,
    actorUserId,
  });
}

export function changeWorkOrderStatus(
  organizationId: string,
  workOrderId: string,
  toStatus: WorkOrderStatus,
  opts: {
    actorUserId?: string;
    supplierId?: string;
    expectedStatus?: WorkOrderStatus;
    timeReported?: number;
    materialsUsed?: string;
    cost?: number;
    notes?: string;
    scheduledAt?: Date;
  } = {}
) {
  return changeWorkOrderStatusCommand({
    organizationId,
    workOrderId,
    expectedStatus: opts.expectedStatus,
    toStatus,
    actorUserId: opts.actorUserId,
    supplierId: opts.supplierId,
    timeReported: opts.timeReported,
    materialsUsed: opts.materialsUsed,
    cost: opts.cost,
    notes: opts.notes,
    scheduledAt: opts.scheduledAt,
  });
}
