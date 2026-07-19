import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { nextNumber } from "@/lib/counters";
import {
  assertTransition,
  maintenanceTransitions,
  workOrderTransitions,
} from "@/lib/state-machines";
import { dispatchEvent } from "@/lib/services/webhooks";
import type { MaintenanceStatus, WorkOrderStatus, MaintenancePriority } from "@prisma/client";

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
  const request = await prisma.$transaction(async (tx) => {
    const requestNumber = await nextNumber(tx, organizationId, "maintenance");
    const created = await tx.maintenanceRequest.create({
      data: {
        organizationId,
        requestNumber,
        propertyId: input.propertyId ?? null,
        unitId: input.unitId ?? null,
        personId: input.personId ?? null,
        category: input.category,
        subcategory: input.subcategory ?? null,
        room: input.room ?? null,
        title: input.title,
        description: input.description,
        priority: input.isEmergency ? "URGENT" : (input.priority ?? "NORMAL"),
        discoveredAt: input.discoveredAt ?? null,
        contactPhone: input.contactPhone ?? null,
        preferredTime: input.preferredTime ?? null,
        masterKeyAllowed: input.masterKeyAllowed ?? false,
        petsInHome: input.petsInHome ?? false,
        isEmergency: input.isEmergency ?? false,
        statusHistory: { create: [{ toStatus: "RECEIVED" }] },
      },
    });
    if (input.personId) {
      await tx.notification.create({
        data: {
          organizationId,
          personId: input.personId,
          eventType: "maintenance_received",
          title: `Felanmälan #${requestNumber} mottagen`,
          body: `Vi har tagit emot din felanmälan "${input.title}" och återkommer så snart som möjligt.`,
        },
      });
    }
    await audit(
      {
        organizationId,
        userId: actorUserId,
        action: "maintenance_request_created",
        entityType: "maintenance_request",
        entityId: created.id,
        after: { requestNumber, title: input.title, isEmergency: input.isEmergency ?? false },
      },
      tx
    );
    return created;
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
  opts: { comment?: string; actorUserId?: string } = {}
) {
  const updated = await prisma.$transaction(async (tx) => {
    const request = await tx.maintenanceRequest.findFirst({
      where: { id: requestId, organizationId },
    });
    if (!request) throw new Error("Felanmälan hittades inte.");
    assertTransition("maintenance", maintenanceTransitions, request.status, toStatus);

    const result = await tx.maintenanceRequest.update({
      where: { id: requestId },
      data: {
        status: toStatus,
        closedAt: toStatus === "CLOSED" ? new Date() : request.closedAt,
      },
    });
    await tx.maintenanceStatusEvent.create({
      data: {
        requestId,
        fromStatus: request.status,
        toStatus,
        comment: opts.comment ?? null,
        changedByUserId: opts.actorUserId ?? null,
      },
    });
    if (request.personId && ["DONE", "CLOSED"].includes(toStatus)) {
      await tx.notification.create({
        data: {
          organizationId,
          personId: request.personId,
          eventType: "maintenance_done",
          title: `Felanmälan #${request.requestNumber} ${toStatus === "DONE" ? "åtgärdad" : "stängd"}`,
          body: `Ärendet "${request.title}" har uppdaterats.`,
        },
      });
    }
    await audit(
      {
        organizationId,
        userId: opts.actorUserId,
        action: "status_change",
        entityType: "maintenance_request",
        entityId: requestId,
        before: { status: request.status },
        after: { status: toStatus },
      },
      tx
    );
    return result;
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

export async function createWorkOrder(
  organizationId: string,
  input: WorkOrderInput,
  actorUserId?: string
) {
  return prisma.$transaction(async (tx) => {
    if (input.requestId) {
      const request = await tx.maintenanceRequest.findFirst({
        where: { id: input.requestId, organizationId },
      });
      if (!request) throw new Error("Felanmälan hittades inte.");
    }
    const orderNumber = await nextNumber(tx, organizationId, "workorder");
    const workOrder = await tx.workOrder.create({
      data: {
        organizationId,
        requestId: input.requestId ?? null,
        supplierId: input.supplierId ?? null,
        assigneeUserId: input.assigneeUserId ?? null,
        orderNumber,
        status: input.supplierId ? "OFFERED" : "CREATED",
        priority: input.priority ?? "NORMAL",
        title: input.title,
        description: input.description,
        accessInfo: input.accessInfo ?? null,
        scheduledAt: input.scheduledAt ?? null,
      },
    });
    await audit(
      {
        organizationId,
        userId: actorUserId,
        action: "work_order_created",
        entityType: "work_order",
        entityId: workOrder.id,
        after: { orderNumber, supplierId: input.supplierId ?? null },
      },
      tx
    );
    return workOrder;
  });
}

export async function changeWorkOrderStatus(
  organizationId: string,
  workOrderId: string,
  toStatus: WorkOrderStatus,
  opts: {
    actorUserId?: string;
    /** Sätt när anropet kommer från entreprenörsportalen: begränsar till egna order. */
    supplierId?: string;
    timeReported?: number;
    materialsUsed?: string;
    cost?: number;
    notes?: string;
    scheduledAt?: Date;
  } = {}
) {
  return prisma.$transaction(async (tx) => {
    const workOrder = await tx.workOrder.findFirst({
      where: {
        id: workOrderId,
        organizationId,
        // Entreprenör kan bara röra sina egna arbetsorder.
        ...(opts.supplierId ? { supplierId: opts.supplierId } : {}),
      },
    });
    if (!workOrder) throw new Error("Arbetsordern hittades inte.");
    assertTransition("work_order", workOrderTransitions, workOrder.status, toStatus);

    // Entreprenörer får inte godkänna eller fakturera.
    if (opts.supplierId && ["APPROVED", "INVOICED", "CANCELLED"].includes(toStatus)) {
      throw new Error("Entreprenörer kan inte sätta denna status.");
    }

    const updated = await tx.workOrder.update({
      where: { id: workOrderId },
      data: {
        status: toStatus,
        completedAt: toStatus === "DONE" ? new Date() : workOrder.completedAt,
        timeReported: opts.timeReported ?? workOrder.timeReported,
        materialsUsed: opts.materialsUsed ?? workOrder.materialsUsed,
        cost: opts.cost ?? workOrder.cost,
        notes: opts.notes ?? workOrder.notes,
        scheduledAt: opts.scheduledAt ?? workOrder.scheduledAt,
        approvedByUserId: toStatus === "APPROVED" ? (opts.actorUserId ?? null) : workOrder.approvedByUserId,
        approvedAt: toStatus === "APPROVED" ? new Date() : workOrder.approvedAt,
      },
    });
    await audit(
      {
        organizationId,
        userId: opts.actorUserId,
        action: "status_change",
        entityType: "work_order",
        entityId: workOrderId,
        before: { status: workOrder.status },
        after: { status: toStatus },
      },
      tx
    );
    return updated;
  });
}
