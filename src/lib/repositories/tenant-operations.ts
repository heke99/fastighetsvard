import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function registerExistingTenantCommand(input: {
  organizationId: string;
  unitId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  personalNumber?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  contractNumber?: string;
  contractStartDate: Date;
  contractEndDate?: Date;
  rent: number;
  deposit?: number;
  noticePeriodMonths?: number;
  invoiceReference?: string;
  externalSystem?: string;
  externalCustomerId?: string;
  externalContractId?: string;
  actorUserId?: string;
}) {
  const { data, error } = await createAdminClient().rpc("register_existing_tenant", {
    p_organization_id: input.organizationId,
    p_unit_id: input.unitId,
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_email: input.email ?? null,
    p_phone: input.phone ?? null,
    p_personal_number: input.personalNumber ?? null,
    p_address: input.address ?? null,
    p_postal_code: input.postalCode ?? null,
    p_city: input.city ?? null,
    p_contract_number: input.contractNumber ?? null,
    p_contract_start_date: input.contractStartDate.toISOString(),
    p_contract_end_date: input.contractEndDate?.toISOString() ?? null,
    p_rent: input.rent,
    p_deposit: input.deposit ?? null,
    p_notice_period_months: input.noticePeriodMonths ?? 3,
    p_invoice_reference: input.invoiceReference ?? null,
    p_external_system: input.externalSystem ?? null,
    p_external_customer_id: input.externalCustomerId ?? null,
    p_external_contract_id: input.externalContractId ?? null,
    p_actor_user_id: input.actorUserId ?? null,
  });
  if (error) {
    const combined = `${error.message} ${error.details ?? ""}`;
    if (combined.includes("unit_not_found")) throw new Error("Objektet hittades inte.");
    if (combined.includes("unit_has_binding_contract")) {
      throw new Error("Objektet har redan ett aktivt eller bindande avtal.");
    }
    if (combined.includes("contract_number_exists")) {
      throw new Error("Avtalsnumret finns redan.");
    }
    throw new Error(error.message);
  }
  return data as {
    person: Record<string, any>;
    contract: Record<string, any>;
    personCreated: boolean;
  };
}
