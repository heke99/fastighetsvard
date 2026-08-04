import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

type Row = Record<string, any>;

function fail(operation: string, error: { code?: string } | null): never {
  throw new Error(`${operation} misslyckades (${error?.code ?? "database_error"}).`);
}

export async function createPropertyRecord(input: {
  organizationId: string;
  values: Row;
}) {
  const { data, error } = await createAdminClient()
    .from("Property")
    .insert({ id: randomUUID(), organizationId: input.organizationId, ...input.values })
    .select("id,name,city")
    .single();
  if (error) fail("Skapa fastighet", error);
  return data as unknown as Row;
}

export async function createUnitRecord(input: {
  organizationId: string;
  propertyId: string;
  unitNumber: string;
  values: Row;
}) {
  const admin = createAdminClient();
  const { data: property, error: propertyError } = await admin
    .from("Property")
    .select("id")
    .eq("organizationId", input.organizationId)
    .eq("id", input.propertyId)
    .maybeSingle();
  if (propertyError) fail("Verifiera fastighet", propertyError);
  if (!property) return { status: "property_not_found" as const };
  const { data: existing, error: existingError } = await admin
    .from("Unit")
    .select("id")
    .eq("organizationId", input.organizationId)
    .eq("unitNumber", input.unitNumber)
    .maybeSingle();
  if (existingError) fail("Verifiera objektsnummer", existingError);
  if (existing) return { status: "unit_exists" as const };
  const { data, error } = await admin
    .from("Unit")
    .insert({
      id: randomUUID(),
      organizationId: input.organizationId,
      propertyId: input.propertyId,
      unitNumber: input.unitNumber,
      ...input.values,
    })
    .select("id,unitNumber")
    .single();
  if (error) {
    if (error.code === "23505") return { status: "unit_exists" as const };
    fail("Skapa objekt", error);
  }
  return { status: "created" as const, unit: data as unknown as Row };
}

export async function createListingRecord(input: {
  organizationId: string;
  unitId: string;
  baseSlug: string;
  values: Row;
}) {
  const admin = createAdminClient();
  const { data: unit, error: unitError } = await admin
    .from("Unit")
    .select("id,unitNumber,rent,price,availableFrom")
    .eq("organizationId", input.organizationId)
    .eq("id", input.unitId)
    .maybeSingle();
  if (unitError) fail("Verifiera annonsobjekt", unitError);
  if (!unit) return { status: "unit_not_found" as const };
  const unitSlug = String(unit.unitNumber)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const rootSlug = [input.baseSlug, unitSlug].filter(Boolean).join("-");
  for (let suffix = 0; suffix < 100; suffix += 1) {
    const slug = suffix === 0 ? rootSlug : `${rootSlug}-${suffix + 1}`;
    const values = {
      ...input.values,
      rent: input.values.rent ?? unit.rent,
      price: input.values.price ?? unit.price,
      moveInDate: input.values.moveInDate ?? unit.availableFrom,
    };
    const { data, error } = await admin
      .from("Listing")
      .insert({
        id: randomUUID(),
        organizationId: input.organizationId,
        unitId: input.unitId,
        slug,
        ...values,
      })
      .select("id,title,slug")
      .single();
    if (!error) {
      return {
        status: "created" as const,
        listing: data as unknown as Row,
        unit: unit as unknown as Row,
      };
    }
    if (error.code !== "23505") fail("Skapa annons", error);
  }
  throw new Error("Kunde inte skapa en unik annonsadress.");
}

export async function getMaintenanceRequestStatus(organizationId: string, requestId: string) {
  const { data, error } = await createAdminClient()
    .from("MaintenanceRequest")
    .select("id,status")
    .eq("organizationId", organizationId)
    .eq("id", requestId)
    .maybeSingle();
  if (error) fail("Felanmälansstatus", error);
  return data as unknown as Row | null;
}

export async function provisionSupplier(input: {
  organizationId: string;
  actorUserId: string;
  name: string;
  orgNumber?: string;
  email?: string;
  phone?: string;
  specialty?: string;
  authUserId?: string;
  contractorEmail?: string;
}) {
  const { data, error } = await createAdminClient().rpc("provision_supplier", {
    p_organization_id: input.organizationId,
    p_actor_user_id: input.actorUserId,
    p_name: input.name,
    p_org_number: input.orgNumber ?? null,
    p_email: input.email ?? null,
    p_phone: input.phone ?? null,
    p_specialty: input.specialty ?? null,
    p_auth_user_id: input.authUserId ?? null,
    p_contractor_email: input.contractorEmail ?? null,
  });
  if (error) fail("Provisionera entreprenör", error);
  return data as { supplierId: string; userId?: string };
}

export async function createIntegrationConnectionRecord(input: {
  organizationId: string;
  provider: string;
  name: string;
  credentialsEncrypted: string | null;
  webhookSecret: string;
}) {
  const { data, error } = await createAdminClient()
    .from("IntegrationConnection")
    .insert({ id: randomUUID(), ...input })
    .select("id,provider,name,webhookSecret")
    .single();
  if (error) fail("Skapa integration", error);
  return data as unknown as Row;
}

export async function isOwnedWebhookDelivery(organizationId: string, deliveryId: string) {
  const { data, error } = await createAdminClient()
    .from("WebhookDelivery")
    .select("id")
    .eq("organizationId", organizationId)
    .eq("id", deliveryId)
    .maybeSingle();
  if (error) fail("Verifiera webhook-leverans", error);
  return Boolean(data);
}

export async function toggleWebhookSubscription(organizationId: string, subscriptionId: string) {
  const admin = createAdminClient();
  const { data: current, error: currentError } = await admin
    .from("WebhookSubscription")
    .select("id,isActive")
    .eq("organizationId", organizationId)
    .eq("id", subscriptionId)
    .maybeSingle();
  if (currentError) fail("Verifiera webhook-prenumeration", currentError);
  if (!current) return false;
  const { error } = await admin
    .from("WebhookSubscription")
    .update({
      isActive: !current.isActive,
      disabledAt: current.isActive ? new Date().toISOString() : null,
      disabledReason: current.isActive ? "Avstängd manuellt" : null,
      consecutiveFailures: 0,
    })
    .eq("organizationId", organizationId)
    .eq("id", subscriptionId)
    .eq("isActive", current.isActive);
  if (error) fail("Växla webhook-prenumeration", error);
  return true;
}

export async function createApiKeyRecord(input: {
  organizationId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  scopes: string[];
  allowedIps: string[];
}) {
  const { data, error } = await createAdminClient()
    .from("ApiKey")
    .insert({ id: randomUUID(), ...input })
    .select("id,name,scopes")
    .single();
  if (error) fail("Skapa API-nyckel", error);
  return data as unknown as Row;
}

export async function revokeApiKeyRecord(organizationId: string, apiKeyId: string) {
  const { data, error } = await createAdminClient()
    .from("ApiKey")
    .update({ isActive: false, revokedAt: new Date().toISOString() })
    .eq("organizationId", organizationId)
    .eq("id", apiKeyId)
    .select("id")
    .maybeSingle();
  if (error) fail("Revokera API-nyckel", error);
  return data as unknown as Row | null;
}

export async function createCustomRole(input: {
  organizationId: string;
  actorUserId: string;
  name: string;
  slug: string;
  description: string;
  permissions: string[];
}) {
  const { data, error } = await createAdminClient().rpc("create_custom_role", {
    p_organization_id: input.organizationId,
    p_actor_user_id: input.actorUserId,
    p_name: input.name,
    p_slug: input.slug,
    p_description: input.description,
    p_permissions: input.permissions,
  });
  if (error) {
    if (error.message.includes("role_slug_exists")) return null;
    if (error.message.includes("role_actor_forbidden")) {
      throw new Error("Du saknar behörighet att skapa roller.");
    }
    if (error.message.includes("privileged_role_assignment_denied")) {
      throw new Error("Endast ägarkontot kan skapa en roll med fullständig åtkomst.");
    }
    if (error.message.includes("invalid_permission")) {
      throw new Error("Rollen innehåller en ogiltig behörighet.");
    }
    fail("Skapa roll", error);
  }
  return data as { roleId: string };
}
