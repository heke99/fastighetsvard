import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  MaintenancePriority,
  MaintenanceStatus,
  WorkOrderStatus,
} from "@/lib/database-types";

const messages: Record<string, string> = {
  maintenance_unit_not_found: "Objektet hittades inte.",
  maintenance_property_not_found: "Fastigheten hittades inte.",
  maintenance_person_not_found: "Personen hittades inte.",
  maintenance_request_not_found: "Felanmälan hittades inte.",
  supplier_not_found: "Entreprenören hittades inte.",
  work_order_not_found: "Arbetsordern hittades inte.",
  optimistic_lock_conflict: "Uppgifterna har ändrats. Ladda om och försök igen.",
  invalid_maintenance_transition: "Felanmälans statusövergång är inte tillåten.",
  invalid_work_order_transition: "Arbetsorderns statusövergång är inte tillåten.",
  supplier_status_forbidden: "Entreprenörer kan inte sätta denna status.",
};

async function command<T>(name: string, params: Record<string, unknown>): Promise<T> {
  const { data, error } = await createAdminClient().rpc(name, params);
  if (error) {
    const combined = `${error.message} ${error.details ?? ""} ${error.hint ?? ""}`;
    const key = Object.keys(messages).find((candidate) => combined.includes(candidate));
    throw new Error(key ? messages[key] : error.message);
  }
  return data as T;
}

export function createMaintenanceRequestCommand(input: {
  organizationId: string;
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
  actorUserId?: string;
}) {
  return command<Record<string, any>>("create_maintenance_request", {
    p_organization_id: input.organizationId,
    p_property_id: input.propertyId ?? null,
    p_unit_id: input.unitId ?? null,
    p_person_id: input.personId ?? null,
    p_category: input.category,
    p_subcategory: input.subcategory ?? null,
    p_room: input.room ?? null,
    p_title: input.title,
    p_description: input.description,
    p_priority: input.priority ?? "NORMAL",
    p_discovered_at: input.discoveredAt?.toISOString() ?? null,
    p_contact_phone: input.contactPhone ?? null,
    p_preferred_time: input.preferredTime ?? null,
    p_master_key_allowed: input.masterKeyAllowed ?? false,
    p_pets_in_home: input.petsInHome ?? false,
    p_is_emergency: input.isEmergency ?? false,
    p_actor_user_id: input.actorUserId ?? null,
  });
}

export function changeMaintenanceStatusCommand(input: {
  organizationId: string;
  requestId: string;
  expectedStatus?: MaintenanceStatus;
  toStatus: MaintenanceStatus;
  comment?: string;
  actorUserId?: string;
}) {
  return command<Record<string, any>>("change_maintenance_status", {
    p_organization_id: input.organizationId,
    p_request_id: input.requestId,
    p_expected_status: input.expectedStatus ?? null,
    p_to_status: input.toStatus,
    p_comment: input.comment ?? null,
    p_actor_user_id: input.actorUserId ?? null,
  });
}

export function createWorkOrderCommand(input: {
  organizationId: string;
  requestId?: string;
  supplierId?: string;
  assigneeUserId?: string;
  title: string;
  description: string;
  priority?: MaintenancePriority;
  accessInfo?: string;
  scheduledAt?: Date;
  actorUserId?: string;
}) {
  return command<Record<string, any>>("create_work_order", {
    p_organization_id: input.organizationId,
    p_request_id: input.requestId ?? null,
    p_supplier_id: input.supplierId ?? null,
    p_assignee_user_id: input.assigneeUserId ?? null,
    p_title: input.title,
    p_description: input.description,
    p_priority: input.priority ?? "NORMAL",
    p_access_info: input.accessInfo ?? null,
    p_scheduled_at: input.scheduledAt?.toISOString() ?? null,
    p_actor_user_id: input.actorUserId ?? null,
  });
}

export function changeWorkOrderStatusCommand(input: {
  organizationId: string;
  workOrderId: string;
  expectedStatus?: WorkOrderStatus;
  toStatus: WorkOrderStatus;
  actorUserId?: string;
  supplierId?: string;
  timeReported?: number;
  materialsUsed?: string;
  cost?: number;
  notes?: string;
  scheduledAt?: Date;
}) {
  return command<Record<string, any>>("change_work_order_status", {
    p_organization_id: input.organizationId,
    p_work_order_id: input.workOrderId,
    p_expected_status: input.expectedStatus ?? null,
    p_to_status: input.toStatus,
    p_actor_user_id: input.actorUserId ?? null,
    p_supplier_id: input.supplierId ?? null,
    p_time_reported: input.timeReported ?? null,
    p_materials_used: input.materialsUsed ?? null,
    p_cost: input.cost ?? null,
    p_notes: input.notes ?? null,
    p_scheduled_at: input.scheduledAt?.toISOString() ?? null,
  });
}
