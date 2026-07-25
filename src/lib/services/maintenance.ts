import {
  changeMaintenanceStatusCommand,
  changeWorkOrderStatusCommand,
  createMaintenanceRequestCommand,
  createWorkOrderCommand,
} from "@/lib/repositories/maintenance-operations";
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
  await dispatchEvent(organizationId, "maintenance_request.created", {
    maintenanceRequestId: request.id,
    requestNumber: request.requestNumber,
    title: request.title,
  });
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
  if (toStatus === "DONE") {
    await dispatchEvent(organizationId, "maintenance_request.completed", {
      maintenanceRequestId: requestId,
    });
  }
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
