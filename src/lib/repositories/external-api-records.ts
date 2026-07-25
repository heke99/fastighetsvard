import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

type PageInput = {
  organizationId: string;
  skip: number;
  take: number;
};

function databaseError(operation: string, error: { code?: string } | null): never {
  throw new Error(`${operation} misslyckades (${error?.code ?? "database_error"}).`);
}

async function externalReferences(
  organizationId: string,
  entityType: string,
  foreignKey: "personId" | "contractId" | "invoiceId",
  ids: string[]
) {
  if (ids.length === 0) return new Map<string, Record<string, any>[]>();
  const { data, error } = await createAdminClient()
    .from("ExternalReference")
    .select("id,externalSystem,entityType,externalId,syncStatus,lastSyncedAt,createdAt,updatedAt,personId,contractId,invoiceId")
    .eq("organizationId", organizationId)
    .eq("entityType", entityType)
    .in(foreignKey, ids)
    .limit(1000);
  if (error) databaseError("Externa referenser", error);
  const byEntity = new Map<string, Record<string, any>[]>();
  for (const row of (data ?? []) as unknown as Record<string, any>[]) {
    const key = String(row[foreignKey]);
    byEntity.set(key, [...(byEntity.get(key) ?? []), row]);
  }
  return byEntity;
}

export async function listApiContracts(input: PageInput & {
  status?: string | null;
  unitId?: string | null;
  personId?: string | null;
}) {
  const admin = createAdminClient();
  let contractIds: string[] | null = null;
  if (input.personId) {
    const { data, error } = await admin
      .from("ContractParty")
      .select("contractId")
      .eq("personId", input.personId)
      .limit(1000);
    if (error) databaseError("Avtalsparter", error);
    contractIds = [...new Set((data ?? []).map((row) => row.contractId))];
    if (contractIds.length === 0) return { items: [], total: 0 };
  }

  let query = admin
    .from("Contract")
    .select(
      "id,organizationId,unitId,contractNumber,type,status,startDate,endDate,noticePeriodMonths,rent,deposit,invoiceReference,isImported,createdAt,updatedAt",
      { count: "exact" }
    )
    .eq("organizationId", input.organizationId);
  if (input.status) query = query.eq("status", input.status);
  if (input.unitId) query = query.eq("unitId", input.unitId);
  if (contractIds) query = query.in("id", contractIds);
  const { data, error, count } = await query
    .order("createdAt", { ascending: false })
    .order("id", { ascending: true })
    .range(input.skip, input.skip + input.take - 1);
  if (error) databaseError("Avtalslista", error);
  const rows = (data ?? []) as unknown as Record<string, any>[];
  const refs = await externalReferences(
    input.organizationId,
    "contract",
    "contractId",
    rows.map((row) => String(row.id))
  );
  return {
    items: rows.map((row) => ({ ...row, externalReferences: refs.get(String(row.id)) ?? [] })),
    total: count ?? 0,
  };
}

export async function listApiInvoices(input: PageInput & {
  status?: string | null;
  personId?: string | null;
  contractId?: string | null;
  dueFrom?: string | null;
  dueTo?: string | null;
  order: { column: "invoiceDate" | "dueDate"; ascending: boolean };
}) {
  const admin = createAdminClient();
  let query = admin
    .from("Invoice")
    .select(
      "id,organizationId,personId,contractId,unitId,invoiceNumber,status,invoiceDate,dueDate,periodStart,periodEnd,totalAmount,vatAmount,paidAmount,currency,ocr,bankgiro,reference,isCreditNote,createdAt,updatedAt",
      { count: "exact" }
    )
    .eq("organizationId", input.organizationId);
  if (input.status) query = query.eq("status", input.status);
  if (input.personId) query = query.eq("personId", input.personId);
  if (input.contractId) query = query.eq("contractId", input.contractId);
  if (input.dueFrom) query = query.gte("dueDate", input.dueFrom);
  if (input.dueTo) query = query.lte("dueDate", input.dueTo);
  const { data, error, count } = await query
    .order(input.order.column, { ascending: input.order.ascending })
    .order("id", { ascending: true })
    .range(input.skip, input.skip + input.take - 1);
  if (error) databaseError("Fakturalista", error);
  const rows = (data ?? []) as unknown as Record<string, any>[];
  return {
    items: await attachInvoiceRelations(input.organizationId, rows),
    total: count ?? 0,
  };
}

async function attachInvoiceRelations(organizationId: string, rows: Record<string, any>[]) {
  const ids = rows.map((row) => String(row.id));
  if (ids.length === 0) return [];
  const admin = createAdminClient();
  const [{ data: lineData, error: lineError }, refs] = await Promise.all([
    admin
      .from("InvoiceLine")
      .select("id,invoiceId,description,quantity,unitPrice,vatRate,amount,sortOrder")
      .in("invoiceId", ids)
      .order("sortOrder", { ascending: true })
      .limit(5000),
    externalReferences(organizationId, "invoice", "invoiceId", ids),
  ]);
  if (lineError) databaseError("Fakturarader", lineError);
  const lines = new Map<string, Record<string, any>[]>();
  for (const line of (lineData ?? []) as unknown as Record<string, any>[]) {
    const key = String(line.invoiceId);
    lines.set(key, [...(lines.get(key) ?? []), line]);
  }
  return rows.map((row) => ({
    ...row,
    lines: lines.get(String(row.id)) ?? [],
    externalReferences: refs.get(String(row.id)) ?? [],
  }));
}

export async function getApiInvoice(organizationId: string, invoiceId: string) {
  const { data, error } = await createAdminClient()
    .from("Invoice")
    .select("id,organizationId,personId,contractId,unitId,invoiceNumber,status,invoiceDate,dueDate,periodStart,periodEnd,totalAmount,vatAmount,paidAmount,currency,ocr,bankgiro,reference,isCreditNote,createdAt,updatedAt")
    .eq("organizationId", organizationId)
    .eq("id", invoiceId)
    .maybeSingle();
  if (error) databaseError("Faktura", error);
  if (!data) return null;
  return (await attachInvoiceRelations(organizationId, [data as unknown as Record<string, any>]))[0] ?? null;
}

export async function listApiTenants(input: PageInput & { activeOnly: boolean }) {
  const admin = createAdminClient();
  const { data: roleData, error: roleError } = await admin
    .from("PersonRole")
    .select("personId")
    .eq("role", "TENANT")
    .limit(5000);
  if (roleError) databaseError("Hyresgästroller", roleError);
  let personIds = [...new Set((roleData ?? []).map((row) => row.personId))];

  if (input.activeOnly && personIds.length > 0) {
    const { data: contractData, error: contractError } = await admin
      .from("Contract")
      .select("id")
      .eq("organizationId", input.organizationId)
      .eq("status", "ACTIVE")
      .limit(5000);
    if (contractError) databaseError("Aktiva avtal", contractError);
    const contractIds = (contractData ?? []).map((row) => row.id);
    if (contractIds.length === 0) return { items: [], total: 0 };
    const { data: partyData, error: partyError } = await admin
      .from("ContractParty")
      .select("personId")
      .in("contractId", contractIds)
      .in("role", ["TENANT", "CO_TENANT"])
      .limit(5000);
    if (partyError) databaseError("Aktiva avtalsparter", partyError);
    const active = new Set((partyData ?? []).map((row) => row.personId));
    personIds = personIds.filter((id) => active.has(id));
  }
  if (personIds.length === 0) return { items: [], total: 0 };

  const { data, error, count } = await admin
    .from("Person")
    .select("id,organizationId,firstName,lastName,email,phone,isCompany,companyName,address,postalCode,city,country,createdAt,updatedAt", { count: "exact" })
    .eq("organizationId", input.organizationId)
    .in("id", personIds)
    .order("lastName", { ascending: true })
    .order("id", { ascending: true })
    .range(input.skip, input.skip + input.take - 1);
  if (error) databaseError("Hyresgästlista", error);
  const rows = (data ?? []) as unknown as Record<string, any>[];
  const refs = await externalReferences(
    input.organizationId,
    "customer",
    "personId",
    rows.map((row) => String(row.id))
  );
  return {
    items: rows.map((row) => ({ ...row, externalReferences: refs.get(String(row.id)) ?? [] })),
    total: count ?? 0,
  };
}

const WEBHOOK_COLUMNS = "id,organizationId,url,events,isActive,disabledAt,disabledReason,consecutiveFailures,createdAt,updatedAt";

export async function listApiWebhookSubscriptions(input: PageInput) {
  const { data, error, count } = await createAdminClient()
    .from("WebhookSubscription")
    .select(WEBHOOK_COLUMNS, { count: "exact" })
    .eq("organizationId", input.organizationId)
    .order("createdAt", { ascending: false })
    .order("id", { ascending: true })
    .range(input.skip, input.skip + input.take - 1);
  if (error) databaseError("Webhook-prenumerationer", error);
  return { items: (data ?? []) as unknown as Record<string, any>[], total: count ?? 0 };
}

export async function createApiWebhookSubscription(input: {
  organizationId: string;
  url: string;
  secret: string;
  events: string[];
}) {
  const { data, error } = await createAdminClient()
    .from("WebhookSubscription")
    .insert({
      id: randomUUID(),
      organizationId: input.organizationId,
      url: input.url,
      secret: input.secret,
      events: input.events,
    })
    .select(WEBHOOK_COLUMNS)
    .single();
  if (error) databaseError("Skapa webhook-prenumeration", error);
  return data as unknown as Record<string, any>;
}

export async function getApiWebhookSubscription(organizationId: string, id: string) {
  const { data, error } = await createAdminClient()
    .from("WebhookSubscription")
    .select(WEBHOOK_COLUMNS)
    .eq("organizationId", organizationId)
    .eq("id", id)
    .maybeSingle();
  if (error) databaseError("Webhook-prenumeration", error);
  return data as unknown as Record<string, any> | null;
}

export async function deleteApiWebhookSubscription(organizationId: string, id: string) {
  const { data, error } = await createAdminClient()
    .from("WebhookSubscription")
    .delete()
    .eq("organizationId", organizationId)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) databaseError("Ta bort webhook-prenumeration", error);
  return Boolean(data);
}

const CUSTOMER_COLUMNS =
  "id,organizationId,firstName,lastName,email,phone,isCompany,companyName,address,postalCode,city,country,createdAt,updatedAt";

export async function listApiCustomers(input: PageInput & {
  email?: string | null;
  search?: string | null;
  externalId?: string | null;
  updatedSince?: string | null;
  order: { column: "createdAt" | "lastName"; ascending: boolean };
}) {
  const admin = createAdminClient();
  let personIds: string[] | null = null;
  if (input.externalId) {
    const { data, error } = await admin
      .from("ExternalReference")
      .select("personId")
      .eq("organizationId", input.organizationId)
      .eq("entityType", "customer")
      .eq("externalId", input.externalId)
      .not("personId", "is", null)
      .limit(1000);
    if (error) databaseError("Extern kundreferens", error);
    personIds = [...new Set((data ?? []).map((row) => row.personId).filter(Boolean))] as string[];
    if (personIds.length === 0) return { items: [], total: 0 };
  }

  let query = admin
    .from("api_customer_catalog")
    .select(CUSTOMER_COLUMNS, { count: "exact" })
    .eq("organizationId", input.organizationId);
  if (input.email) query = query.eq("email", input.email.toLowerCase());
  if (input.search) query = query.ilike("searchText", `%${input.search.trim()}%`);
  if (input.updatedSince) query = query.gte("updatedAt", input.updatedSince);
  if (personIds) query = query.in("id", personIds);
  const { data, error, count } = await query
    .order(input.order.column, { ascending: input.order.ascending })
    .order("id", { ascending: true })
    .range(input.skip, input.skip + input.take - 1);
  if (error) databaseError("Kundlista", error);
  const rows = (data ?? []) as unknown as Record<string, any>[];
  const refs = await externalReferences(
    input.organizationId,
    "customer",
    "personId",
    rows.map((row) => String(row.id))
  );
  return {
    items: rows.map((row) => ({ ...row, externalReferences: refs.get(String(row.id)) ?? [] })),
    total: count ?? 0,
  };
}

export async function getApiCustomer(
  organizationId: string,
  personId: string
): Promise<Record<string, any> | null> {
  const { data, error } = await createAdminClient()
    .from("Person")
    .select(CUSTOMER_COLUMNS)
    .eq("organizationId", organizationId)
    .eq("id", personId)
    .maybeSingle();
  if (error) databaseError("Kund", error);
  if (!data) return null;
  const refs = await externalReferences(organizationId, "customer", "personId", [personId]);
  const row = data as unknown as Record<string, any>;
  return {
    ...row,
    externalReferences: refs.get(personId) ?? [],
  };
}

export async function updateApiCustomer(
  organizationId: string,
  personId: string,
  values: Record<string, string | null | undefined>
): Promise<Record<string, any> | null> {
  const updates = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
  const { data, error } = await createAdminClient()
    .from("Person")
    .update(updates)
    .eq("organizationId", organizationId)
    .eq("id", personId)
    .select(CUSTOMER_COLUMNS)
    .maybeSingle();
  if (error) databaseError("Uppdatera kund", error);
  if (!data) return null;
  const refs = await externalReferences(organizationId, "customer", "personId", [personId]);
  const row = data as unknown as Record<string, any>;
  return {
    ...row,
    externalReferences: refs.get(personId) ?? [],
  };
}

export async function upsertApiCustomer(input: {
  organizationId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  isCompany?: boolean;
  companyName?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  externalSystem?: string;
  externalCustomerId?: string;
}): Promise<{ person: Record<string, any>; deduplicated: boolean }> {
  const { data, error } = await createAdminClient().rpc("upsert_external_customer", {
    p_organization_id: input.organizationId,
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_email: input.email ?? null,
    p_phone: input.phone ?? null,
    p_is_company: input.isCompany ?? false,
    p_company_name: input.companyName ?? null,
    p_address: input.address ?? null,
    p_postal_code: input.postalCode ?? null,
    p_city: input.city ?? null,
    p_external_system: input.externalSystem ?? null,
    p_external_customer_id: input.externalCustomerId ?? null,
  });
  if (error) databaseError("Skapa eller matcha kund", error);
  const result = data as { personId: string; deduplicated: boolean };
  const person = await getApiCustomer(input.organizationId, result.personId);
  if (!person) throw new Error("Kundkommandot returnerade en okänd person.");
  return { person, deduplicated: result.deduplicated };
}
