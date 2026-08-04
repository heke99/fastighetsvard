import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface MaintenanceNotificationContext {
  id: string;
  requestNumber: string;
  title: string;
  description: string;
  status: string;
  category: string;
  isEmergency: boolean;
  createdAt: string;
  person: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
  } | null;
  unit: {
    id: string;
    unitNumber: string;
    address: string;
    city: string;
  } | null;
}

export async function getMaintenanceNotificationContext(
  organizationId: string,
  requestId: string
): Promise<MaintenanceNotificationContext | null> {
  const admin = createAdminClient();
  const { data: request, error } = await admin
    .from("MaintenanceRequest")
    .select("id,personId,unitId,requestNumber,title,description,status,category,isEmergency,createdAt")
    .eq("organizationId", organizationId)
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw new Error(`Felanmälans e-postunderlag kunde inte hämtas (${error.code}).`);
  if (!request) return null;

  const [personResult, unitResult] = await Promise.all([
    request.personId
      ? admin
          .from("Person")
          .select("id,firstName,lastName,email,phone")
          .eq("organizationId", organizationId)
          .eq("id", request.personId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    request.unitId
      ? admin
          .from("Unit")
          .select("id,unitNumber,address,city")
          .eq("organizationId", organizationId)
          .eq("id", request.unitId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (personResult.error) throw new Error(`Felanmälans person kunde inte hämtas (${personResult.error.code}).`);
  if (unitResult.error) throw new Error(`Felanmälans objekt kunde inte hämtas (${unitResult.error.code}).`);

  return {
    ...request,
    person: personResult.data,
    unit: unitResult.data,
  } as MaintenanceNotificationContext;
}
