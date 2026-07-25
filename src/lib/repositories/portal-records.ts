import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function fail(operation: string, error: PostgrestError): never {
  throw new Error(`${operation} misslyckades (${error.code}).`);
}

export async function getMyProfile(personId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("Person")
    .select("id,organizationId,firstName,lastName,email,phone,address,postalCode,city")
    .eq("id", personId)
    .maybeSingle();
  if (error) fail("Profilsökning", error);
  return data;
}

export async function updateMyProfile(
  personId: string,
  values: {
    firstName: string;
    lastName: string;
    phone?: string | null;
    address?: string | null;
    postalCode?: string | null;
    city?: string | null;
  }
) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("Person")
    .update(values)
    .eq("id", personId)
    .select("id,organizationId,firstName,lastName,email,phone,address,postalCode,city")
    .single();
  if (error) fail("Profiluppdatering", error);
  return data;
}

export async function listMySavedSearches(personId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("SavedSearch")
    .select("id,name,criteria,emailAlerts,smsAlerts,lastNotifiedAt,createdAt")
    .eq("personId", personId)
    .order("createdAt", { ascending: false })
    .limit(100);
  if (error) fail("Bevakningar", error);
  return data ?? [];
}

const INVOICE_COLUMNS = [
  "id", "invoiceNumber", "status", "invoiceDate", "dueDate", "periodStart",
  "periodEnd", "currency", "totalAmount", "vatAmount", "paidAmount",
  "isCreditNote", "creditsInvoiceId", "ocr", "bankgiro", "reference",
  "pdfUrl", "contractId", "createdAt",
].join(",");

export async function listMyInvoices(personId: string, limit = 50) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("Invoice")
    .select(INVOICE_COLUMNS)
    .eq("personId", personId)
    .order("invoiceDate", { ascending: false })
    .order("id", { ascending: true })
    .limit(Math.min(100, Math.max(1, limit)));
  if (error) fail("Fakturor", error);
  return (data ?? []) as unknown as Record<string, any>[];
}

export async function listMyDocuments(personId: string): Promise<Record<string, any>[]> {
  const supabase = await createServerSupabaseClient();
  const columns = "id,personId,contractId,title,type,version,signStatus,createdAt";
  const [{ data: ownDocuments, error }, { data: parties, error: partyError }] = await Promise.all([
    supabase
      .from("Document")
      .select(columns)
      .eq("personId", personId)
      .is("archivedAt", null)
      .order("createdAt", { ascending: false })
      .limit(200),
    supabase
      .from("ContractParty")
      .select("contractId")
      .eq("personId", personId)
      .limit(200),
  ]);
  if (error) fail("Persondokument", error);
  if (partyError) fail("Dokumentavtalsparter", partyError);

  const contractIds = [...new Set((parties ?? []).map((party) => party.contractId))];
  let contractDocuments: Record<string, any>[] = [];
  if (contractIds.length > 0) {
    const { data, error: contractDocumentError } = await supabase
      .from("Document")
      .select(columns)
      .in("contractId", contractIds)
    .is("archivedAt", null)
    .order("createdAt", { ascending: false })
    .limit(200);
    if (contractDocumentError) fail("Avtalsdokument", contractDocumentError);
    contractDocuments = (data ?? []) as unknown as Record<string, any>[];
  }

  const rows = [...new Map(
    [...((ownDocuments ?? []) as unknown as Record<string, any>[]), ...contractDocuments]
      .map((row) => [String(row.id), row] as const)
  ).values()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  if (contractIds.length === 0) return rows.map((row) => ({ ...row, contract: null }));

  const { data: contracts, error: contractError } = await supabase
    .from("Contract")
    .select("id,contractNumber")
    .in("id", contractIds);
  if (contractError) fail("Dokumentavtal", contractError);
  const byId = new Map((contracts ?? []).map((contract) => [contract.id, contract]));
  return rows.map((row) => ({
    ...row,
    contract: row.contractId ? byId.get(row.contractId) ?? null : null,
  }));
}

export async function listMyMaintenanceRequests(personId: string): Promise<Record<string, any>[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("MaintenanceRequest")
    .select("id,unitId,requestNumber,title,category,status,isEmergency,createdAt")
    .eq("personId", personId)
    .order("createdAt", { ascending: false })
    .limit(100);
  if (error) fail("Felanmälningar", error);
  const rows = (data ?? []) as Record<string, any>[];
  const unitIds = [...new Set(rows.map((row) => row.unitId).filter(Boolean))];
  if (unitIds.length === 0) return rows.map((row) => ({ ...row, unit: null }));

  const { data: units, error: unitError } = await supabase
    .from("Unit")
    .select("id,address")
    .in("id", unitIds);
  if (unitError) fail("Felanmälansobjekt", unitError);
  const byId = new Map((units ?? []).map((unit) => [unit.id, unit]));
  return rows.map((row) => ({ ...row, unit: byId.get(row.unitId) ?? null }));
}

export async function listMyContracts(options?: {
  contractId?: string;
  statuses?: string[];
  roles?: string[];
}): Promise<Record<string, any>[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("current_person_contract_catalog", {
    p_contract_id: options?.contractId ?? null,
    p_statuses: options?.statuses ?? null,
    p_roles: options?.roles ?? null,
  });
  if (error) fail("Avtal", error);
  return (Array.isArray(data) ? data : [])
    .map((row) => row && typeof row === "object" && "payload" in row ? row.payload : null)
    .filter((row): row is Record<string, any> => Boolean(row) && typeof row === "object");
}

export async function getMyContract(contractId: string) {
  const rows = await listMyContracts({ contractId });
  return rows[0] ?? null;
}

export async function listMyRentalUnits(): Promise<Array<{
  id: string;
  propertyId: string;
  address: string;
  city: string;
  [key: string]: any;
}>> {
  const contracts = await listMyContracts({
    statuses: ["ACTIVE", "TERMINATED"],
    roles: ["TENANT", "CO_TENANT"],
  });
  return [...new Map(
    contracts
      .map((contract) => contract.unit as Record<string, any> | undefined)
      .filter((unit): unit is Record<string, any> => Boolean(unit?.id))
      .map((unit) => [String(unit.id), unit] as const)
  ).values()] as Array<{
    id: string;
    propertyId: string;
    address: string;
    city: string;
    [key: string]: any;
  }>;
}

export async function getMyRentalUnit(unitId: string) {
  const units = await listMyRentalUnits();
  return units.find((unit) => unit.id === unitId) ?? null;
}

export async function getMyInvoice(
  personId: string,
  invoiceId: string
): Promise<Record<string, any> | null> {
  const supabase = await createServerSupabaseClient();
  const { data: invoice, error } = await supabase
    .from("Invoice")
    .select(INVOICE_COLUMNS)
    .eq("id", invoiceId)
    .eq("personId", personId)
    .maybeSingle();
  if (error) fail("Faktura", error);
  if (!invoice) return null;
  const invoiceRow = invoice as unknown as Record<string, any>;

  const [linesResult, allocationsResult, creditNotesResult, historyResult] = await Promise.all([
    supabase
      .from("InvoiceLine")
      .select("id,description,quantity,unitPrice,vatRate,amount,sortOrder")
      .eq("invoiceId", invoiceId)
      .order("sortOrder", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("PaymentAllocation")
      .select("id,paymentId,amount,createdAt")
      .eq("invoiceId", invoiceId)
      .order("createdAt", { ascending: false }),
    supabase
      .from("Invoice")
      .select("id,invoiceNumber,totalAmount")
      .eq("creditsInvoiceId", invoiceId)
      .eq("personId", personId)
      .order("invoiceDate", { ascending: false }),
    supabase
      .from("InvoiceStatusEvent")
      .select("id,fromStatus,toStatus,source,comment,createdAt")
      .eq("invoiceId", invoiceId)
      .order("createdAt", { ascending: false }),
  ]);
  if (linesResult.error) fail("Fakturarader", linesResult.error);
  if (allocationsResult.error) fail("Betalningsallokeringar", allocationsResult.error);
  if (creditNotesResult.error) fail("Kreditfakturor", creditNotesResult.error);
  if (historyResult.error) fail("Fakturastatushistorik", historyResult.error);

  const allocations = (allocationsResult.data ?? []) as Record<string, any>[];
  const paymentIds = [...new Set(allocations.map((allocation) => allocation.paymentId).filter(Boolean))];
  const paymentById = new Map<string, Record<string, any>>();
  if (paymentIds.length > 0) {
    const { data: payments, error: paymentError } = await supabase
      .from("Payment")
      .select("id,amount,currency,paidAt,method,reference")
      .in("id", paymentIds);
    if (paymentError) fail("Betalningar", paymentError);
    for (const payment of payments ?? []) paymentById.set(String(payment.id), payment);
  }

  const contract = invoiceRow.contractId
    ? await getMyContract(String(invoiceRow.contractId))
    : null;
  return {
    ...invoiceRow,
    contract,
    lines: linesResult.data ?? [],
    paymentAllocations: allocations.map((allocation) => ({
      ...allocation,
      payment: paymentById.get(String(allocation.paymentId)) ?? null,
    })).filter((allocation) => allocation.payment),
    creditNotes: creditNotesResult.data ?? [],
    statusHistory: historyResult.data ?? [],
  };
}

export async function getMyMaintenanceRequest(
  personId: string,
  requestId: string
): Promise<Record<string, any> | null> {
  const supabase = await createServerSupabaseClient();
  const { data: request, error } = await supabase
    .from("MaintenanceRequest")
    .select("id,unitId,requestNumber,title,description,category,room,status,priority,isEmergency,masterKeyAllowed,petsInHome,createdAt")
    .eq("id", requestId)
    .eq("personId", personId)
    .maybeSingle();
  if (error) fail("Felanmälan", error);
  if (!request) return null;

  const [commentsResult, historyResult, unit] = await Promise.all([
    supabase
      .from("MaintenanceComment")
      .select("id,authorName,body,createdAt")
      .eq("requestId", requestId)
      .eq("isInternal", false)
      .order("createdAt", { ascending: true }),
    supabase
      .from("MaintenanceStatusEvent")
      .select("id,fromStatus,toStatus,comment,createdAt")
      .eq("requestId", requestId)
      .order("createdAt", { ascending: true }),
    request.unitId ? getMyRentalUnit(String(request.unitId)) : Promise.resolve(null),
  ]);
  if (commentsResult.error) fail("Felanmälanskommentarer", commentsResult.error);
  if (historyResult.error) fail("Felanmälanshistorik", historyResult.error);
  return {
    ...(request as unknown as Record<string, any>),
    unit,
    comments: commentsResult.data ?? [],
    statusHistory: historyResult.data ?? [],
  };
}

export async function listMyMessagesAndNotifications(
  personId: string
): Promise<{
  messages: Record<string, any>[];
  notifications: Record<string, any>[];
}> {
  const supabase = await createServerSupabaseClient();
  const [messagesResult, notificationsResult] = await Promise.all([
    supabase
      .from("Message")
      .select("id,senderPersonId,subject,body,readAt,createdAt")
      .eq("recipientPersonId", personId)
      .order("createdAt", { ascending: false })
      .limit(50),
    supabase
      .from("Notification")
      .select("id,title,body,readAt,createdAt")
      .eq("personId", personId)
      .order("createdAt", { ascending: false })
      .limit(50),
  ]);
  if (messagesResult.error) fail("Meddelanden", messagesResult.error);
  if (notificationsResult.error) fail("Notiser", notificationsResult.error);

  const messages = (messagesResult.data ?? []) as Record<string, any>[];
  const senderIds = [...new Set(messages.map((message) => message.senderPersonId).filter(Boolean))];
  const senderById = new Map<string, Record<string, any>>();
  if (senderIds.length > 0) {
    const admin = createAdminClient();
    const { data: senders, error: senderError } = await admin
      .from("Person")
      .select("id,firstName,lastName")
      .in("id", senderIds);
    if (senderError) fail("Meddelandeavsändare", senderError);
    for (const sender of senders ?? []) senderById.set(String(sender.id), sender);
  }
  return {
    messages: messages.map((message) => ({
      ...message,
      sender: message.senderPersonId
        ? senderById.get(String(message.senderPersonId)) ?? null
        : null,
    })),
    notifications: notificationsResult.data ?? [],
  };
}

export async function markMyMessagesAndNotificationsRead(personId: string) {
  const supabase = await createServerSupabaseClient();
  const readAt = new Date().toISOString();
  const [messageResult, notificationResult] = await Promise.all([
    supabase
      .from("Message")
      .update({ readAt })
      .eq("recipientPersonId", personId)
      .is("readAt", null),
    supabase
      .from("Notification")
      .update({ readAt })
      .eq("personId", personId)
      .is("readAt", null),
  ]);
  if (messageResult.error) fail("Läskvitto för meddelanden", messageResult.error);
  if (notificationResult.error) fail("Läskvitto för notiser", notificationResult.error);
}

export async function listMyApplications(options?: {
  statuses?: string[];
  limit?: number;
}): Promise<Record<string, any>[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("current_person_application_catalog", {
    p_statuses: options?.statuses ?? null,
    p_limit: Math.min(200, Math.max(1, options?.limit ?? 100)),
  });
  if (error) fail("Ansökningar", error);
  return (Array.isArray(data) ? data : [])
    .map((row) => row && typeof row === "object" && "payload" in row ? row.payload : null)
    .filter((row): row is Record<string, any> => Boolean(row) && typeof row === "object");
}

export async function listMyUpcomingViewings(limit = 3) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("current_person_upcoming_viewings", {
    p_limit: Math.min(20, Math.max(1, limit)),
  });
  if (error) fail("Kommande visningar", error);
  return (data ?? []) as Record<string, any>[];
}

export async function getMyPortalCounts(personId: string) {
  const supabase = await createServerSupabaseClient();
  const [messages, favorites, searches, notifications] = await Promise.all([
    supabase
      .from("Message")
      .select("id", { count: "exact", head: true })
      .eq("recipientPersonId", personId)
      .is("readAt", null),
    supabase
      .from("Favorite")
      .select("id", { count: "exact", head: true })
      .eq("personId", personId),
    supabase
      .from("SavedSearch")
      .select("id", { count: "exact", head: true })
      .eq("personId", personId),
    supabase
      .from("Notification")
      .select("id,title,body,createdAt")
      .eq("personId", personId)
      .is("readAt", null)
      .order("createdAt", { ascending: false })
      .limit(5),
  ]);
  if (messages.error) fail("Olästa meddelanden", messages.error);
  if (favorites.error) fail("Favoritantal", favorites.error);
  if (searches.error) fail("Bevakningsantal", searches.error);
  if (notifications.error) fail("Portalnotiser", notifications.error);
  return {
    unreadMessages: messages.count ?? 0,
    favoritesCount: favorites.count ?? 0,
    savedSearchesCount: searches.count ?? 0,
    notifications: notifications.data ?? [],
  };
}

export async function toggleMyFavorite(listingId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("toggle_favorite", {
    p_listing_id: listingId,
  });
  if (error?.message.includes("listing_not_found")) {
    throw new Error("Annonsen hittades inte.");
  }
  if (error) fail("Favoritväxling", error);
  return data === true;
}

export async function createMySavedSearch(input: {
  organizationId: string;
  personId: string;
  name: string;
  criteria: Record<string, string>;
}) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("SavedSearch")
    .insert({
      organizationId: input.organizationId,
      personId: input.personId,
      name: input.name,
      criteria: input.criteria,
    })
    .select("id")
    .single();
  if (error) fail("Skapa bevakning", error);
  return String(data.id);
}

export async function deleteMySavedSearch(personId: string, id: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("SavedSearch")
    .delete()
    .eq("id", id)
    .eq("personId", personId)
    .select("id");
  if (error) fail("Ta bort bevakning", error);
  return (data ?? []).length > 0;
}

export async function getMyGdprExport(personId: string) {
  const supabase = await createServerSupabaseClient();
  const [
    person,
    rolesResult,
    applications,
    contracts,
    invoices,
    maintenanceRequests,
    favoriteIds,
    savedSearches,
    notificationsResult,
    documents,
  ] = await Promise.all([
    getMyProfile(personId),
    supabase
      .from("PersonRole")
      .select("role")
      .eq("personId", personId)
      .order("role", { ascending: true }),
    listMyApplications(),
    listMyContracts(),
    listMyInvoices(personId, 100),
    listMyMaintenanceRequests(personId),
    listFavoriteListingIdsForExport(personId),
    listMySavedSearches(personId),
    supabase
      .from("Notification")
      .select("eventType,title,createdAt")
      .eq("personId", personId)
      .order("createdAt", { ascending: false })
      .limit(500),
    listMyDocuments(personId),
  ]);
  if (rolesResult.error) fail("Personroller", rolesResult.error);
  if (notificationsResult.error) fail("Registerutdragsnotiser", notificationsResult.error);
  return {
    person: person ? {
      ...person,
      roles: rolesResult.data ?? [],
    } : null,
    applications,
    contracts,
    invoices,
    maintenanceRequests,
    favorites: favoriteIds,
    savedSearches,
    notifications: notificationsResult.data ?? [],
    documents,
  };
}

async function listFavoriteListingIdsForExport(personId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("Favorite")
    .select("listingId,createdAt")
    .eq("personId", personId)
    .order("createdAt", { ascending: false })
    .limit(500);
  if (error) fail("Registerutdragsfavoriter", error);
  return data ?? [];
}
