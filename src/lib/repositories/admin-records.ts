import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { signMaintenanceDocuments } from "@/lib/repositories/maintenance-files";

type Row = Record<string, any>;

function fail(operation: string, error: { code?: string } | null): never {
  throw new Error(`${operation} misslyckades (${error?.code ?? "database_error"}).`);
}

function groupBy(rows: Row[], key: string) {
  const grouped = new Map<string, Row[]>();
  for (const row of rows) {
    const id = String(row[key]);
    grouped.set(id, [...(grouped.get(id) ?? []), row]);
  }
  return grouped;
}

export async function listAdminApiKeys(organizationId: string) {
  const { data, error } = await createAdminClient()
    .from("ApiKey")
    .select("id,name,keyPrefix,scopes,allowedIps,isActive,lastUsedAt,revokedAt,expiresAt,createdAt")
    .eq("organizationId", organizationId)
    .order("createdAt", { ascending: false })
    .limit(500);
  if (error) fail("API-nycklar", error);
  return (data ?? []) as unknown as Row[];
}

export async function listAdminImportJobs(organizationId: string, importType: string) {
  const { data, error } = await createAdminClient()
    .from("ImportJob")
    .select("id,importType,status,totalRows,successRows,errorRows,skippedRows,startedAt,finishedAt,createdAt")
    .eq("organizationId", organizationId)
    .eq("importType", importType)
    .order("createdAt", { ascending: false })
    .limit(10);
  if (error) fail("Importjobb", error);
  return (data ?? []) as unknown as Row[];
}

export async function listUnitsWithoutActiveContracts(organizationId: string) {
  const admin = createAdminClient();
  const { data: contractData, error: contractError } = await admin
    .from("Contract")
    .select("unitId")
    .eq("organizationId", organizationId)
    .in("status", ["ACTIVE", "SIGNED", "SENT_FOR_SIGNING", "PARTIALLY_SIGNED"])
    .limit(5000);
  if (contractError) fail("Aktiva avtal", contractError);
  const occupiedIds = [...new Set((contractData ?? []).map((row) => row.unitId).filter(Boolean))];
  let query = admin
    .from("Unit")
    .select("id,propertyId,unitNumber,apartmentNumber,type,status,address,postalCode,city,rent,availableFrom")
    .eq("organizationId", organizationId);
  if (occupiedIds.length > 0) query = query.not("id", "in", `(${occupiedIds.join(",")})`);
  const { data, error } = await query
    .order("unitNumber", { ascending: true })
    .order("id", { ascending: true })
    .limit(1000);
  if (error) fail("Lediga avtalsobjekt", error);
  return (data ?? []) as unknown as Row[];
}

export async function listAdminAuditEvents(organizationId: string, entityType?: string) {
  const admin = createAdminClient();
  let query = admin
    .from("AuditEvent")
    .select("id,userId,actorType,actorId,action,entityType,entityId,before,after,ip,correlationId,createdAt")
    .eq("organizationId", organizationId);
  if (entityType) query = query.eq("entityType", entityType);
  const { data, error } = await query
    .order("createdAt", { ascending: false })
    .order("id", { ascending: true })
    .limit(200);
  if (error) fail("Revisionslogg", error);
  const events = (data ?? []) as unknown as Row[];
  const userIds = [...new Set(events.map((event) => event.userId).filter(Boolean))];
  if (userIds.length === 0) return events.map((event) => ({ ...event, user: null }));
  const { data: userData, error: userError } = await admin
    .from("User")
    .select("id,email")
    .eq("organizationId", organizationId)
    .in("id", userIds);
  if (userError) fail("Revisionsaktörer", userError);
  const users = new Map((userData ?? []).map((user) => [user.id, user]));
  return events.map((event) => ({ ...event, user: users.get(event.userId) ?? null })) as Row[];
}

export async function listAdminProperties(organizationId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("Property")
    .select("id,name,designation,address,postalCode,city,municipality,status,createdAt")
    .eq("organizationId", organizationId)
    .order("city", { ascending: true })
    .order("name", { ascending: true })
    .limit(500);
  if (error) fail("Fastigheter", error);
  const properties = (data ?? []) as unknown as Row[];
  const ids = properties.map((property) => String(property.id));
  if (ids.length === 0) return [];
  const [{ data: units, error: unitError }, { data: buildings, error: buildingError }] =
    await Promise.all([
      admin.from("Unit").select("id,propertyId").eq("organizationId", organizationId).in("propertyId", ids).limit(5000),
      admin.from("Building").select("id,propertyId").eq("organizationId", organizationId).in("propertyId", ids).limit(5000),
    ]);
  if (unitError) fail("Fastighetsobjekt", unitError);
  if (buildingError) fail("Fastighetsbyggnader", buildingError);
  const unitGroups = groupBy((units ?? []) as unknown as Row[], "propertyId");
  const buildingGroups = groupBy((buildings ?? []) as unknown as Row[], "propertyId");
  return properties.map((property) => ({
    ...property,
    _count: {
      units: unitGroups.get(String(property.id))?.length ?? 0,
      buildings: buildingGroups.get(String(property.id))?.length ?? 0,
    },
  })) as Row[];
}

export async function listAdminSuppliers(organizationId: string, activeOnly = false) {
  const admin = createAdminClient();
  let query = admin
    .from("Supplier")
    .select("id,name,orgNumber,email,phone,specialty,isActive,createdAt")
    .eq("organizationId", organizationId);
  if (activeOnly) query = query.eq("isActive", true);
  const { data, error } = await query.order("name", { ascending: true }).limit(500);
  if (error) fail("Entreprenörer", error);
  const suppliers = (data ?? []) as unknown as Row[];
  const ids = suppliers.map((supplier) => String(supplier.id));
  if (ids.length === 0 || activeOnly) return suppliers;
  const [{ data: users, error: userError }, { data: workOrders, error: workOrderError }] =
    await Promise.all([
      admin.from("User").select("id,supplierId,email").eq("organizationId", organizationId).in("supplierId", ids).limit(2000),
      admin.from("WorkOrder").select("id,supplierId").eq("organizationId", organizationId).in("supplierId", ids).limit(5000),
    ]);
  if (userError) fail("Entreprenörskonton", userError);
  if (workOrderError) fail("Entreprenörsarbetsorder", workOrderError);
  const userGroups = groupBy((users ?? []) as unknown as Row[], "supplierId");
  const workOrderGroups = groupBy((workOrders ?? []) as unknown as Row[], "supplierId");
  return suppliers.map((supplier) => ({
    ...supplier,
    users: userGroups.get(String(supplier.id)) ?? [],
    _count: { workOrders: workOrderGroups.get(String(supplier.id))?.length ?? 0 },
  })) as Row[];
}

async function workOrderRelations(workOrders: Row[], organizationId?: string) {
  const admin = createAdminClient();
  const requestIds = [...new Set(workOrders.map((row) => row.requestId).filter(Boolean))];
  const supplierIds = [...new Set(workOrders.map((row) => row.supplierId).filter(Boolean))];
  const workOrderIds = workOrders.map((row) => String(row.id));
  const [requestResult, supplierResult, documentResult] = await Promise.all([
    requestIds.length
      ? admin
          .from("MaintenanceRequest")
          .select("id,unitId,requestNumber,contactPhone,preferredTime,masterKeyAllowed,petsInHome")
          .in("id", requestIds)
      : Promise.resolve({ data: [], error: null }),
    supplierIds.length
      ? admin.from("Supplier").select("id,name").in("id", supplierIds)
      : Promise.resolve({ data: [], error: null }),
    workOrderIds.length
      ? admin.from("Document").select("id,workOrderId,title").in("workOrderId", workOrderIds).is("archivedAt", null).limit(2000)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (requestResult.error) fail("Arbetsorderns felanmälan", requestResult.error);
  if (supplierResult.error) fail("Arbetsorderns entreprenör", supplierResult.error);
  if (documentResult.error) fail("Arbetsorderns dokument", documentResult.error);
  const requests = (requestResult.data ?? []) as unknown as Row[];
  const unitIds = [...new Set(requests.map((row) => row.unitId).filter(Boolean))];
  const { data: unitData, error: unitError } = unitIds.length
    ? await admin.from("Unit").select("id,address,city").in("id", unitIds)
    : { data: [], error: null };
  if (unitError) fail("Arbetsorderns objekt", unitError);
  const requestMap = new Map<string, Row>(
    requests.map((row) => [String(row.id), row] as const)
  );
  const unitMap = new Map<string, Row>(
    ((unitData ?? []) as unknown as Row[]).map((row) => [String(row.id), row] as const)
  );
  const supplierMap = new Map<string, Row>(
    ((supplierResult.data ?? []) as unknown as Row[]).map((row) => [String(row.id), row] as const)
  );
  const documents = groupBy((documentResult.data ?? []) as unknown as Row[], "workOrderId");
  return workOrders.map((workOrder) => {
    const request = requestMap.get(workOrder.requestId) as Row | undefined;
    return {
      ...workOrder,
      supplier: supplierMap.get(workOrder.supplierId) ?? null,
      request: request ? { ...request, unit: unitMap.get(request.unitId) ?? null } : null,
      documents: documents.get(String(workOrder.id)) ?? [],
    };
  }) as Row[];
}

const WORK_ORDER_COLUMNS =
  "id,organizationId,requestId,supplierId,orderNumber,status,priority,title,description,accessInfo,scheduledAt,completedAt,timeReported,materialsUsed,cost,invoiceReference,createdAt,updatedAt";

export async function listAdminWorkOrders(organizationId: string) {
  const { data, error } = await createAdminClient()
    .from("WorkOrder")
    .select(WORK_ORDER_COLUMNS)
    .eq("organizationId", organizationId)
    .order("priority", { ascending: false })
    .order("createdAt", { ascending: false })
    .limit(100);
  if (error) fail("Arbetsorder", error);
  return workOrderRelations((data ?? []) as unknown as Row[], organizationId);
}

export async function listContractorWorkOrders(supplierId: string) {
  const { data, error } = await createAdminClient()
    .from("WorkOrder")
    .select(WORK_ORDER_COLUMNS)
    .eq("supplierId", supplierId)
    .order("priority", { ascending: false })
    .order("createdAt", { ascending: false })
    .limit(500);
  if (error) fail("Entreprenörens arbetsorder", error);
  return workOrderRelations((data ?? []) as unknown as Row[]);
}

export async function listAdminListings(organizationId: string) {
  const admin = createAdminClient();
  const [{ data, error }, { data: unitOptions, error: unitOptionError }] = await Promise.all([
    admin
      .from("Listing")
      .select("id,unitId,title,slug,category,status,publishAt,publishedAt,applicationDeadline,moveInDate,rent,price,createdAt,updatedAt")
      .eq("organizationId", organizationId)
      .order("createdAt", { ascending: false })
      .limit(100),
    admin
      .from("Unit")
      .select("id,unitNumber,address,city,type,status,rent,price")
      .eq("organizationId", organizationId)
      .in("status", ["NOT_PUBLISHED", "UPCOMING", "DRAFT", "PUBLISHED"])
      .order("unitNumber", { ascending: true })
      .limit(1000),
  ]);
  if (error) fail("Annonslista", error);
  if (unitOptionError) fail("Annonsobjekt", unitOptionError);
  const listings = (data ?? []) as unknown as Row[];
  const listingIds = listings.map((row) => String(row.id));
  const unitIds = [...new Set(listings.map((row) => row.unitId).filter(Boolean))];
  const [unitsResult, applicationsResult, favoritesResult, mediaResult] = await Promise.all([
    unitIds.length
      ? admin.from("Unit").select("id,unitNumber,address,city").eq("organizationId", organizationId).in("id", unitIds)
      : Promise.resolve({ data: [], error: null }),
    listingIds.length
      ? admin.from("Application").select("id,listingId").eq("organizationId", organizationId).in("listingId", listingIds).limit(5000)
      : Promise.resolve({ data: [], error: null }),
    listingIds.length
      ? admin.from("Favorite").select("id,listingId").eq("organizationId", organizationId).in("listingId", listingIds).limit(5000)
      : Promise.resolve({ data: [], error: null }),
    unitIds.length
      ? admin.from("UnitMedia").select("id,unitId,kind,url,caption,sortOrder").in("unitId", unitIds).order("sortOrder", { ascending: true }).limit(5000)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (unitsResult.error) fail("Annonsens objekt", unitsResult.error);
  if (applicationsResult.error) fail("Annonsansökningar", applicationsResult.error);
  if (favoritesResult.error) fail("Annonsfavoriter", favoritesResult.error);
  if (mediaResult.error) fail("Annonsmedia", mediaResult.error);
  const mediaByUnit = groupBy((mediaResult.data ?? []) as unknown as Row[], "unitId");
  const unitMap = new Map<string, Row>(
    ((unitsResult.data ?? []) as unknown as Row[]).map((row) => [
      String(row.id),
      { ...row, media: mediaByUnit.get(String(row.id)) ?? [] },
    ] as const)
  );
  const applications = groupBy((applicationsResult.data ?? []) as unknown as Row[], "listingId");
  const favorites = groupBy((favoritesResult.data ?? []) as unknown as Row[], "listingId");
  return {
    listings: listings.map((listing) => ({
      ...listing,
      unit: unitMap.get(String(listing.unitId)) ?? null,
      _count: {
        applications: applications.get(String(listing.id))?.length ?? 0,
        favorites: favorites.get(String(listing.id))?.length ?? 0,
      },
    })) as Row[],
    units: (unitOptions ?? []) as unknown as Row[],
  };
}

export async function listAdminApplications(organizationId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("Application")
    .select("id,listingId,status,isInternalTransfer,desiredMoveInDate,employment,monthlyIncome,message,submittedAt,createdAt,updatedAt")
    .eq("organizationId", organizationId)
    .order("createdAt", { ascending: false })
    .limit(100);
  if (error) fail("Ansökningar", error);
  const applications = (data ?? []) as unknown as Row[];
  const ids = applications.map((row) => String(row.id));
  const listingIds = [...new Set(applications.map((row) => row.listingId).filter(Boolean))];
  const [listingResult, memberResult, offerResult] = await Promise.all([
    listingIds.length
      ? admin.from("Listing").select("id,unitId,title").eq("organizationId", organizationId).in("id", listingIds)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? admin.from("ApplicationMember").select("id,applicationId,personId,role").in("applicationId", ids).limit(1000)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? admin.from("Offer").select("id,applicationId,status,expiresAt,respondedAt").eq("organizationId", organizationId).in("applicationId", ids).limit(1000)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (listingResult.error) fail("Ansökningarnas annonser", listingResult.error);
  if (memberResult.error) fail("Ansökningsmedlemmar", memberResult.error);
  if (offerResult.error) fail("Ansökningserbjudanden", offerResult.error);
  const listings = (listingResult.data ?? []) as unknown as Row[];
  const unitIds = [...new Set(listings.map((row) => row.unitId).filter(Boolean))];
  const members = (memberResult.data ?? []) as unknown as Row[];
  const personIds = [...new Set(members.map((row) => row.personId).filter(Boolean))];
  const [unitResult, personResult] = await Promise.all([
    unitIds.length
      ? admin.from("Unit").select("id,address,unitNumber").eq("organizationId", organizationId).in("id", unitIds)
      : Promise.resolve({ data: [], error: null }),
    personIds.length
      ? admin.from("Person").select("id,firstName,lastName,email,phone").eq("organizationId", organizationId).in("id", personIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (unitResult.error) fail("Ansökningarnas objekt", unitResult.error);
  if (personResult.error) fail("Ansökningspersoner", personResult.error);
  const unitMap = new Map<string, Row>(
    ((unitResult.data ?? []) as unknown as Row[]).map((row) => [String(row.id), row] as const)
  );
  const listingMap = new Map<string, Row>(
    listings.map((row) => [
      String(row.id),
      { ...row, unit: unitMap.get(String(row.unitId)) ?? null },
    ] as const)
  );
  const personMap = new Map<string, Row>(
    ((personResult.data ?? []) as unknown as Row[]).map((row) => [String(row.id), row] as const)
  );
  const hydratedMembers = members.map((row) => ({
    ...row,
    person: personMap.get(String(row.personId)) ?? null,
  })) as Row[];
  const memberGroups = groupBy(hydratedMembers, "applicationId");
  const offerGroups = groupBy((offerResult.data ?? []) as unknown as Row[], "applicationId");
  return applications.map((application) => ({
    ...application,
    listing: listingMap.get(String(application.listingId)) ?? null,
    members: memberGroups.get(String(application.id)) ?? [],
    offers: offerGroups.get(String(application.id)) ?? [],
  })) as Row[];
}

export async function listAdminContracts(organizationId: string, status?: string) {
  const admin = createAdminClient();
  let query = admin
    .from("Contract")
    .select("id,unitId,contractNumber,type,status,startDate,endDate,noticePeriodMonths,rent,deposit,isImported,createdAt,updatedAt")
    .eq("organizationId", organizationId);
  if (status) query = query.eq("status", status);
  const { data, error } = await query.order("createdAt", { ascending: false }).limit(100);
  if (error) fail("Avtalsadministration", error);
  const contracts = (data ?? []) as unknown as Row[];
  const ids = contracts.map((row) => String(row.id));
  const unitIds = [...new Set(contracts.map((row) => row.unitId).filter(Boolean))];
  const [unitResult, partyResult, referenceResult] = await Promise.all([
    unitIds.length
      ? admin.from("Unit").select("id,unitNumber,address").eq("organizationId", organizationId).in("id", unitIds)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? admin.from("ContractParty").select("id,contractId,personId,role,signedAt").in("contractId", ids).limit(1000)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? admin.from("ExternalReference").select("id,contractId,externalSystem,externalId,syncStatus,lastSyncedAt").eq("organizationId", organizationId).in("contractId", ids).limit(1000)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (unitResult.error) fail("Avtalsobjekt", unitResult.error);
  if (partyResult.error) fail("Avtalsparter", partyResult.error);
  if (referenceResult.error) fail("Avtalsreferenser", referenceResult.error);
  const parties = (partyResult.data ?? []) as unknown as Row[];
  const personIds = [...new Set(parties.map((row) => row.personId).filter(Boolean))];
  const { data: personData, error: personError } = personIds.length
    ? await admin.from("Person").select("id,firstName,lastName,email").eq("organizationId", organizationId).in("id", personIds)
    : { data: [], error: null };
  if (personError) fail("Avtalspersoner", personError);
  const unitMap = new Map<string, Row>(
    ((unitResult.data ?? []) as unknown as Row[]).map((row) => [String(row.id), row] as const)
  );
  const personMap = new Map<string, Row>(
    ((personData ?? []) as unknown as Row[]).map((row) => [String(row.id), row] as const)
  );
  const partyGroups = groupBy(parties.map((row) => ({
    ...row,
    person: personMap.get(String(row.personId)) ?? null,
  })) as Row[], "contractId");
  const referenceGroups = groupBy((referenceResult.data ?? []) as unknown as Row[], "contractId");
  return contracts.map((contract) => ({
    ...contract,
    unit: unitMap.get(String(contract.unitId)) ?? null,
    parties: partyGroups.get(String(contract.id)) ?? [],
    externalReferences: referenceGroups.get(String(contract.id)) ?? [],
  })) as Row[];
}

export async function listAdminInvoices(organizationId: string, status?: string) {
  const admin = createAdminClient();
  let query = admin
    .from("Invoice")
    .select("id,personId,contractId,invoiceNumber,status,invoiceDate,dueDate,totalAmount,paidAmount,currency,isCreditNote,createdAt,updatedAt")
    .eq("organizationId", organizationId);
  if (status) query = query.eq("status", status);
  const { data, error } = await query.order("invoiceDate", { ascending: false }).limit(200);
  if (error) fail("Fakturaadministration", error);
  const invoices = (data ?? []) as unknown as Row[];
  const ids = invoices.map((row) => String(row.id));
  const personIds = [...new Set(invoices.map((row) => row.personId).filter(Boolean))];
  const contractIds = [...new Set(invoices.map((row) => row.contractId).filter(Boolean))];
  const [personResult, contractResult, referenceResult] = await Promise.all([
    personIds.length
      ? admin.from("Person").select("id,firstName,lastName").eq("organizationId", organizationId).in("id", personIds)
      : Promise.resolve({ data: [], error: null }),
    contractIds.length
      ? admin.from("Contract").select("id,contractNumber").eq("organizationId", organizationId).in("id", contractIds)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? admin.from("ExternalReference").select("id,invoiceId,externalSystem,externalId,syncStatus,lastSyncedAt").eq("organizationId", organizationId).in("invoiceId", ids).limit(2000)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (personResult.error) fail("Fakturakunder", personResult.error);
  if (contractResult.error) fail("Fakturaavtal", contractResult.error);
  if (referenceResult.error) fail("Fakturareferenser", referenceResult.error);
  const persons = new Map<string, Row>(
    ((personResult.data ?? []) as unknown as Row[]).map((row) => [String(row.id), row] as const)
  );
  const contracts = new Map<string, Row>(
    ((contractResult.data ?? []) as unknown as Row[]).map((row) => [String(row.id), row] as const)
  );
  const references = groupBy((referenceResult.data ?? []) as unknown as Row[], "invoiceId");
  return invoices.map((invoice) => ({
    ...invoice,
    person: persons.get(String(invoice.personId)) ?? null,
    contract: contracts.get(String(invoice.contractId)) ?? null,
    externalReferences: references.get(String(invoice.id)) ?? [],
  })) as Row[];
}

export async function listAdminMaintenance(organizationId: string) {
  const admin = createAdminClient();
  const [{ data, error }, suppliers] = await Promise.all([
    admin
      .from("MaintenanceRequest")
      .select("id,unitId,personId,requestNumber,status,priority,category,title,description,contactPhone,preferredTime,masterKeyAllowed,petsInHome,isEmergency,createdAt,updatedAt")
      .eq("organizationId", organizationId)
      .order("isEmergency", { ascending: false })
      .order("createdAt", { ascending: false })
      .limit(100),
    listAdminSuppliers(organizationId, true),
  ]);
  if (error) fail("Felanmälansadministration", error);
  const requests = (data ?? []) as unknown as Row[];
  const ids = requests.map((row) => String(row.id));
  const unitIds = [...new Set(requests.map((row) => row.unitId).filter(Boolean))];
  const personIds = [...new Set(requests.map((row) => row.personId).filter(Boolean))];
  const [unitResult, personResult, workOrderResult, documentResult] = await Promise.all([
    unitIds.length
      ? admin.from("Unit").select("id,address,city,unitNumber").eq("organizationId", organizationId).in("id", unitIds)
      : Promise.resolve({ data: [], error: null }),
    personIds.length
      ? admin.from("Person").select("id,firstName,lastName,email,phone").eq("organizationId", organizationId).in("id", personIds)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? admin.from("WorkOrder").select("id,requestId,orderNumber,status").eq("organizationId", organizationId).in("requestId", ids).limit(1000)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? admin
          .from("Document")
          .select("id,maintenanceRequestId,title,fileName,mimeType,sizeBytes,storageKey,createdAt")
          .eq("organizationId", organizationId)
          .in("maintenanceRequestId", ids)
          .is("archivedAt", null)
          .limit(1000)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (unitResult.error) fail("Felanmälansobjekt", unitResult.error);
  if (personResult.error) fail("Felanmälanspersoner", personResult.error);
  if (workOrderResult.error) fail("Felanmälansarbetsorder", workOrderResult.error);
  if (documentResult.error) fail("Felanmälansbilagor", documentResult.error);
  const units = new Map<string, Row>(
    ((unitResult.data ?? []) as unknown as Row[]).map((row) => [String(row.id), row] as const)
  );
  const persons = new Map<string, Row>(
    ((personResult.data ?? []) as unknown as Row[]).map((row) => [String(row.id), row] as const)
  );
  const workOrders = groupBy((workOrderResult.data ?? []) as unknown as Row[], "requestId");
  const signedDocuments = await signMaintenanceDocuments(
    (documentResult.data ?? []) as unknown as Row[]
  );
  const documents = groupBy(signedDocuments, "maintenanceRequestId");
  return {
    requests: requests.map((request) => ({
      ...request,
      unit: units.get(String(request.unitId)) ?? null,
      person: persons.get(String(request.personId)) ?? null,
      workOrders: workOrders.get(String(request.id)) ?? [],
      attachments: documents.get(String(request.id)) ?? [],
    })) as Row[],
    suppliers,
  };
}

export async function listAdminUnits(organizationId: string, status?: string, limit = 200) {
  const admin = createAdminClient();
  let query = admin
    .from("Unit")
    .select("id,propertyId,unitNumber,apartmentNumber,type,status,address,postalCode,city,rent,price,availableFrom,createdAt")
    .eq("organizationId", organizationId);
  if (status) query = query.eq("status", status);
  const [{ data, error }, { data: propertyData, error: propertyError }] = await Promise.all([
    query
      .order("unitNumber", { ascending: true })
      .order("id", { ascending: true })
      .limit(Math.min(5000, Math.max(1, limit))),
    admin.from("Property").select("id,name").eq("organizationId", organizationId).order("name", { ascending: true }).limit(500),
  ]);
  if (error) fail("Objektadministration", error);
  if (propertyError) fail("Objektfastigheter", propertyError);
  const units = (data ?? []) as unknown as Row[];
  const unitIds = units.map((row) => String(row.id));
  const { data: contractData, error: contractError } = unitIds.length
    ? await admin
        .from("Contract")
        .select("id,unitId,contractNumber")
        .eq("organizationId", organizationId)
        .eq("status", "ACTIVE")
        .in("unitId", unitIds)
        .limit(500)
    : { data: [], error: null };
  if (contractError) fail("Objektens aktiva avtal", contractError);
  const contracts = (contractData ?? []) as unknown as Row[];
  const contractIds = contracts.map((row) => String(row.id));
  const { data: partyData, error: partyError } = contractIds.length
    ? await admin
        .from("ContractParty")
        .select("id,contractId,personId,role")
        .in("contractId", contractIds)
        .in("role", ["TENANT", "CO_TENANT"])
        .limit(1000)
    : { data: [], error: null };
  if (partyError) fail("Objektens avtalsparter", partyError);
  const parties = (partyData ?? []) as unknown as Row[];
  const personIds = [...new Set(parties.map((row) => row.personId).filter(Boolean))];
  const { data: personData, error: personError } = personIds.length
    ? await admin.from("Person").select("id,firstName,lastName").eq("organizationId", organizationId).in("id", personIds)
    : { data: [], error: null };
  if (personError) fail("Objektens hyresgäster", personError);
  const persons = new Map<string, Row>(
    ((personData ?? []) as unknown as Row[]).map((row) => [String(row.id), row] as const)
  );
  const hydratedParties = parties.map((row) => ({
    ...row,
    person: persons.get(String(row.personId)) ?? null,
  })) as Row[];
  const partyGroups = groupBy(hydratedParties, "contractId");
  const hydratedContracts = contracts.map((row) => ({
    ...row,
    parties: partyGroups.get(String(row.id)) ?? [],
  })) as Row[];
  const contractGroups = groupBy(hydratedContracts, "unitId");
  const properties = new Map<string, Row>(
    ((propertyData ?? []) as unknown as Row[]).map((row) => [String(row.id), row] as const)
  );
  return {
    units: units.map((unit) => ({
      ...unit,
      property: properties.get(String(unit.propertyId)) ?? null,
      contracts: contractGroups.get(String(unit.id)) ?? [],
    })) as Row[],
    properties: (propertyData ?? []) as unknown as Row[],
  };
}

export async function listAdminTerminations(organizationId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("Termination")
    .select("id,contractId,requestedByPersonId,requestedAt,desiredMoveOutDate,earliestEndDate,effectiveEndDate,status,reason,isInternalTransfer,createdAt")
    .eq("organizationId", organizationId)
    .order("requestedAt", { ascending: false })
    .limit(100);
  if (error) fail("Uppsägningar", error);
  const rows = (data ?? []) as unknown as Row[];
  const contractIds = [...new Set(rows.map((row) => row.contractId).filter(Boolean))];
  const personIds = [...new Set(rows.map((row) => row.requestedByPersonId).filter(Boolean))];
  const [contractResult, personResult] = await Promise.all([
    contractIds.length
      ? admin.from("Contract").select("id,unitId,contractNumber").eq("organizationId", organizationId).in("id", contractIds)
      : Promise.resolve({ data: [], error: null }),
    personIds.length
      ? admin.from("Person").select("id,firstName,lastName").eq("organizationId", organizationId).in("id", personIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (contractResult.error) fail("Uppsägningarnas avtal", contractResult.error);
  if (personResult.error) fail("Uppsägningarnas personer", personResult.error);
  const contracts = (contractResult.data ?? []) as unknown as Row[];
  const unitIds = [...new Set(contracts.map((row) => row.unitId).filter(Boolean))];
  const { data: unitData, error: unitError } = unitIds.length
    ? await admin.from("Unit").select("id,unitNumber,address").eq("organizationId", organizationId).in("id", unitIds)
    : { data: [], error: null };
  if (unitError) fail("Uppsägningarnas objekt", unitError);
  const units = new Map<string, Row>(
    ((unitData ?? []) as unknown as Row[]).map((row) => [String(row.id), row] as const)
  );
  const contractMap = new Map<string, Row>(
    contracts.map((row) => [
      String(row.id),
      { ...row, unit: units.get(String(row.unitId)) ?? null },
    ] as const)
  );
  const persons = new Map<string, Row>(
    ((personResult.data ?? []) as unknown as Row[]).map((row) => [String(row.id), row] as const)
  );
  return rows.map((row) => ({
    ...row,
    contract: contractMap.get(String(row.contractId)) ?? null,
    requestedBy: persons.get(String(row.requestedByPersonId)) ?? null,
  })) as Row[];
}

export async function listAdminPersons(organizationId: string, search?: string) {
  const admin = createAdminClient();
  let query = admin
    .from("api_customer_catalog")
    .select("id,firstName,lastName,email,phone,protectedIdentity,createdAt")
    .eq("organizationId", organizationId);
  if (search) query = query.ilike("searchText", `%${search.trim()}%`);
  const { data, error } = await query
    .order("lastName", { ascending: true })
    .order("firstName", { ascending: true })
    .order("id", { ascending: true })
    .limit(200);
  if (error) fail("Personadministration", error);
  const persons = (data ?? []) as unknown as Row[];
  const personIds = persons.map((row) => String(row.id));
  if (personIds.length === 0) return [];
  const [roleResult, userResult, invitationResult, referenceResult, partyResult] = await Promise.all([
    admin.from("PersonRole").select("id,personId,role").in("personId", personIds).limit(2000),
    admin.from("User").select("id,personId,lastLoginAt,isActive").eq("organizationId", organizationId).in("personId", personIds).limit(500),
    admin.from("Invitation").select("id,personId,expiresAt,acceptedAt,createdAt").eq("organizationId", organizationId).in("personId", personIds).order("createdAt", { ascending: false }).limit(2000),
    admin.from("ExternalReference").select("id,personId,externalSystem,externalId").eq("organizationId", organizationId).eq("entityType", "customer").in("personId", personIds).limit(2000),
    admin.from("ContractParty").select("id,personId,contractId,role").in("personId", personIds).in("role", ["TENANT", "CO_TENANT"]).limit(2000),
  ]);
  if (roleResult.error) fail("Personroller", roleResult.error);
  if (userResult.error) fail("Personkonton", userResult.error);
  if (invitationResult.error) fail("Personinbjudningar", invitationResult.error);
  if (referenceResult.error) fail("Personreferenser", referenceResult.error);
  if (partyResult.error) fail("Personavtalsparter", partyResult.error);
  const parties = (partyResult.data ?? []) as unknown as Row[];
  const contractIds = [...new Set(parties.map((row) => row.contractId).filter(Boolean))];
  const { data: contractData, error: contractError } = contractIds.length
    ? await admin.from("Contract").select("id,unitId").eq("organizationId", organizationId).eq("status", "ACTIVE").in("id", contractIds)
    : { data: [], error: null };
  if (contractError) fail("Personernas aktiva avtal", contractError);
  const contracts = (contractData ?? []) as unknown as Row[];
  const activeContractIds = new Set(contracts.map((row) => String(row.id)));
  const unitIds = [...new Set(contracts.map((row) => row.unitId).filter(Boolean))];
  const { data: unitData, error: unitError } = unitIds.length
    ? await admin.from("Unit").select("id,address").eq("organizationId", organizationId).in("id", unitIds)
    : { data: [], error: null };
  if (unitError) fail("Personernas objekt", unitError);
  const units = new Map<string, Row>(
    ((unitData ?? []) as unknown as Row[]).map((row) => [String(row.id), row] as const)
  );
  const contractMap = new Map<string, Row>(
    contracts.map((row) => [
      String(row.id),
      { ...row, unit: units.get(String(row.unitId)) ?? null },
    ] as const)
  );
  const hydratedParties = parties
    .filter((row) => activeContractIds.has(String(row.contractId)))
    .map((row) => ({ ...row, contract: contractMap.get(String(row.contractId)) })) as Row[];
  const invitations = ((invitationResult.data ?? []) as unknown as Row[]).map((row) => ({
    ...row,
    expiresAt: new Date(String(row.expiresAt)),
    acceptedAt: row.acceptedAt ? new Date(String(row.acceptedAt)) : null,
  })) as Row[];
  const roles = groupBy((roleResult.data ?? []) as unknown as Row[], "personId");
  const invitationGroups = groupBy(invitations, "personId");
  const references = groupBy((referenceResult.data ?? []) as unknown as Row[], "personId");
  const partyGroups = groupBy(hydratedParties, "personId");
  const userRows = (userResult.data ?? []) as unknown as Row[];
  const userIds = userRows.map((row) => String(row.id));
  const { data: userRoleData, error: userRoleError } = userIds.length
    ? await admin.from("UserRole").select("id,userId,roleId").in("userId", userIds).limit(2000)
    : { data: [], error: null };
  if (userRoleError) fail("Personernas personalroller", userRoleError);
  const userRoleRows = (userRoleData ?? []) as unknown as Row[];
  const staffRoleIds = [...new Set(userRoleRows.map((row) => row.roleId).filter(Boolean))];
  const { data: staffRoleData, error: staffRoleError } = staffRoleIds.length
    ? await admin.from("Role").select("id,organizationId,name,slug").in("id", staffRoleIds).limit(500)
    : { data: [], error: null };
  if (staffRoleError) fail("Personernas rollnamn", staffRoleError);
  const scopedStaffRoles = ((staffRoleData ?? []) as unknown as Row[]).filter(
    (row) => row.organizationId === null || String(row.organizationId) === organizationId
  );
  const staffRoleMap = new Map<string, Row>(
    scopedStaffRoles.map((row) => [String(row.id), row] as const)
  );
  const hydratedUserRoles = userRoleRows.map((row) => ({
    ...row,
    role: staffRoleMap.get(String(row.roleId)) ?? null,
  })) as Row[];
  const staffRolesByUser = groupBy(hydratedUserRoles, "userId");
  const users = new Map<string, Row>(
    userRows.map((row) => [
      String(row.personId),
      { ...row, staffRoles: staffRolesByUser.get(String(row.id)) ?? [] },
    ] as const)
  );
  return persons.map((person) => ({
    ...person,
    roles: roles.get(String(person.id)) ?? [],
    user: users.get(String(person.id)) ?? null,
    contractParties: partyGroups.get(String(person.id)) ?? [],
    invitations: (invitationGroups.get(String(person.id)) ?? []).slice(0, 1),
    externalReferences: references.get(String(person.id)) ?? [],
  })) as Row[];
}

async function countAdminRows(
  table: string,
  organizationId: string,
  configure?: (query: any) => any
): Promise<number> {
  const admin = createAdminClient();
  let query: any = admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("organizationId", organizationId);
  if (configure) query = configure(query);
  const { count, error } = await query;
  if (error) fail(`Dashboardmått: ${table}`, error);
  return count ?? 0;
}

async function sumPaidInvoiceAmount(organizationId: string): Promise<number> {
  const admin = createAdminClient();
  const pageSize = 1000;
  let offset = 0;
  let total = 0;

  for (;;) {
    const { data, error } = await admin
      .from("Invoice")
      .select("paidAmount")
      .eq("organizationId", organizationId)
      .eq("isCreditNote", false)
      .range(offset, offset + pageSize - 1);
    if (error) fail("Dashboardmått: betalda belopp", error);

    const rows = (data ?? []) as Array<{ paidAmount: number | string | null }>;
    total += rows.reduce((sum, row) => sum + Number(row.paidAmount ?? 0), 0);
    if (rows.length < pageSize) return total;
    offset += pageSize;
  }
}

async function getAdminDashboardMetricsFallback(
  organizationId: string,
  now = new Date()
): Promise<Record<string, number>> {
  const today = now.toISOString().slice(0, 10);
  const inThirtyDays = new Date(now);
  inThirtyDays.setUTCDate(inThirtyDays.getUTCDate() + 30);
  const endDate = inThirtyDays.toISOString().slice(0, 10);

  const [
    totalUnits,
    rentedUnits,
    availableUnits,
    upcomingUnits,
    forSaleUnits,
    publishedListings,
    activeApplications,
    contractsAwaitingSignature,
    overdueInvoices,
    activeMaintenanceRequests,
    urgentWorkOrders,
    upcomingMoveIns,
    upcomingMoveOuts,
    failedWebhooks,
    pendingReviewItems,
    failedSyncJobs,
    paidAmount,
  ] = await Promise.all([
    countAdminRows("Unit", organizationId),
    countAdminRows("Unit", organizationId, (query) => query.eq("status", "RENTED")),
    countAdminRows("Unit", organizationId, (query) => query.in("status", ["PUBLISHED", "APPLICATION_OPEN"])),
    countAdminRows("Unit", organizationId, (query) => query.eq("status", "UPCOMING")),
    countAdminRows("Unit", organizationId, (query) => query.in("status", ["FOR_SALE", "BIDDING"])),
    countAdminRows("Listing", organizationId, (query) => query.eq("status", "PUBLISHED")),
    countAdminRows("Application", organizationId, (query) => query.not("status", "in", "(CLOSED,WITHDRAWN,DECLINED)")),
    countAdminRows("Contract", organizationId, (query) => query.in("status", ["SENT_FOR_SIGNING", "PARTIALLY_SIGNED"])),
    countAdminRows("Invoice", organizationId, (query) => query.in("status", ["OVERDUE", "REMINDED", "COLLECTION"])),
    countAdminRows("MaintenanceRequest", organizationId, (query) => query.not("status", "in", "(CLOSED,REJECTED)")),
    countAdminRows("WorkOrder", organizationId, (query) => query
      .eq("priority", "URGENT")
      .not("status", "in", "(DONE,APPROVED,INVOICED,CANCELLED)")),
    countAdminRows("Contract", organizationId, (query) => query
      .in("status", ["SIGNED", "ACTIVE"])
      .gte("startDate", today)
      .lte("startDate", endDate)),
    countAdminRows("Termination", organizationId, (query) => query
      .gte("effectiveEndDate", today)
      .lte("effectiveEndDate", endDate)
      .neq("status", "CANCELLED")),
    countAdminRows("WebhookDelivery", organizationId, (query) => query.in("status", ["FAILED", "DEAD_LETTER"])),
    countAdminRows("SyncReviewItem", organizationId, (query) => query.eq("status", "PENDING")),
    countAdminRows("IntegrationSyncJob", organizationId, (query) => query.eq("status", "FAILED")),
    sumPaidInvoiceAmount(organizationId),
  ]);

  return {
    totalUnits,
    rentedUnits,
    availableUnits,
    upcomingUnits,
    forSaleUnits,
    publishedListings,
    activeApplications,
    contractsAwaitingSignature,
    overdueInvoices,
    activeMaintenanceRequests,
    urgentWorkOrders,
    upcomingMoveIns,
    upcomingMoveOuts,
    failedWebhooks,
    pendingReviewItems,
    failedSyncJobs,
    paidAmount,
  };
}

export async function getAdminDashboardMetrics(organizationId: string) {
  const now = new Date();
  const { data, error } = await createAdminClient().rpc("admin_dashboard_metrics", {
    p_organization_id: organizationId,
    p_now: now.toISOString(),
  });
  if (!error && data && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, number>;
  }

  console.error("FaddeBo dashboard metrics RPC failed; using canonical query fallback", {
    code: error?.code,
    message: error?.message,
  });
  return getAdminDashboardMetricsFallback(organizationId, now);
}

export async function getAdminReportMetrics(organizationId: string) {
  const { data, error } = await createAdminClient().rpc("admin_report_metrics", {
    p_organization_id: organizationId,
    p_now: new Date().toISOString(),
  });
  if (error) fail("Rapportmått", error);
  return data as Record<string, any>;
}

export async function listAdminWebhooks(organizationId: string) {
  const admin = createAdminClient();
  const [subscriptionResult, deliveryResult, inboundResult] = await Promise.all([
    admin
      .from("WebhookSubscription")
      .select("id,url,events,isActive,disabledAt,disabledReason,createdAt")
      .eq("organizationId", organizationId)
      .order("createdAt", { ascending: false })
      .limit(500),
    admin
      .from("WebhookDelivery")
      .select("id,subscriptionId,eventType,status,attempts,lastAttemptAt,lastStatusCode,lastError,deliveredAt,createdAt")
      .eq("organizationId", organizationId)
      .order("createdAt", { ascending: false })
      .limit(30),
    admin
      .from("InboundWebhookEvent")
      .select("id,provider,eventId,eventType,signatureValid,processedAt,processingError,createdAt")
      .eq("organizationId", organizationId)
      .order("createdAt", { ascending: false })
      .limit(20),
  ]);
  if (subscriptionResult.error) fail("Webhook-prenumerationer", subscriptionResult.error);
  if (deliveryResult.error) fail("Webhook-leveranser", deliveryResult.error);
  if (inboundResult.error) fail("Inkommande webhooks", inboundResult.error);
  const subscriptions = (subscriptionResult.data ?? []) as unknown as Row[];
  const counts = await Promise.all(
    subscriptions.map(async (subscription) => {
      const { count, error } = await admin
        .from("WebhookDelivery")
        .select("id", { count: "exact", head: true })
        .eq("organizationId", organizationId)
        .eq("subscriptionId", subscription.id);
      if (error) fail("Antal webhook-leveranser", error);
      return [String(subscription.id), count ?? 0] as const;
    })
  );
  const countMap = new Map(counts);
  const subscriptionMap = new Map<string, Row>(
    subscriptions.map((row) => [String(row.id), row] as const)
  );
  return {
    subscriptions: subscriptions.map((row) => ({
      ...row,
      _count: { deliveries: countMap.get(String(row.id)) ?? 0 },
    })) as Row[],
    deliveries: ((deliveryResult.data ?? []) as unknown as Row[]).map((row) => ({
      ...row,
      subscription: subscriptionMap.get(String(row.subscriptionId)) ?? null,
    })) as Row[],
    inboundEvents: (inboundResult.data ?? []) as unknown as Row[],
  };
}

export async function listAdminIntegrations(organizationId: string) {
  const admin = createAdminClient();
  const [connectionResult, jobResult, reviewResult, personResult] = await Promise.all([
    admin
      .from("IntegrationConnection")
      .select("id,provider,name,isActive,settings,lastSyncAt,createdAt,updatedAt")
      .eq("organizationId", organizationId)
      .order("createdAt", { ascending: false })
      .limit(100),
    admin
      .from("IntegrationSyncJob")
      .select("id,connectionId,jobType,status,startedAt,finishedAt,itemsProcessed,itemsCreated,itemsUpdated,itemsSkipped,itemsFailed,error,createdAt")
      .eq("organizationId", organizationId)
      .order("createdAt", { ascending: false })
      .limit(15),
    admin
      .from("SyncReviewItem")
      .select("id,syncJobId,entityType,externalSystem,externalId,payload,reason,status,createdAt")
      .eq("organizationId", organizationId)
      .eq("status", "PENDING")
      .order("createdAt", { ascending: true })
      .limit(50),
    admin
      .from("Person")
      .select("id,firstName,lastName,email")
      .eq("organizationId", organizationId)
      .order("lastName", { ascending: true })
      .order("id", { ascending: true })
      .limit(500),
  ]);
  if (connectionResult.error) fail("Integrationsanslutningar", connectionResult.error);
  if (jobResult.error) fail("Integrationsjobb", jobResult.error);
  if (reviewResult.error) fail("Integrationsgranskning", reviewResult.error);
  if (personResult.error) fail("Integrationspersoner", personResult.error);
  const connections = (connectionResult.data ?? []) as unknown as Row[];
  const connectionMap = new Map<string, Row>(
    connections.map((row) => [String(row.id), row] as const)
  );
  return {
    connections,
    syncJobs: ((jobResult.data ?? []) as unknown as Row[]).map((row) => ({
      ...row,
      connection: connectionMap.get(String(row.connectionId)) ?? null,
    })) as Row[],
    reviewItems: (reviewResult.data ?? []) as unknown as Row[],
    persons: (personResult.data ?? []) as unknown as Row[],
  };
}

export async function listAdminUsersAndRoles(organizationId: string) {
  const admin = createAdminClient();
  const [userResult, localRoleResult, systemRoleResult] = await Promise.all([
    admin
      .from("User")
      .select("id,personId,supplierId,email,lastLoginAt,isActive,createdAt")
      .eq("organizationId", organizationId)
      .order("createdAt", { ascending: false })
      .limit(200),
    admin
      .from("Role")
      .select("id,organizationId,name,slug,description,isSystem,createdAt")
      .eq("organizationId", organizationId)
      .order("name", { ascending: true })
      .limit(500),
    admin
      .from("Role")
      .select("id,organizationId,name,slug,description,isSystem,createdAt")
      .is("organizationId", null)
      .order("name", { ascending: true })
      .limit(500),
  ]);
  if (userResult.error) fail("Adminanvändare", userResult.error);
  if (localRoleResult.error) fail("Lokala roller", localRoleResult.error);
  if (systemRoleResult.error) fail("Systemroller", systemRoleResult.error);
  const users = (userResult.data ?? []) as unknown as Row[];
  const roles = [
    ...((systemRoleResult.data ?? []) as unknown as Row[]),
    ...((localRoleResult.data ?? []) as unknown as Row[]),
  ].sort((a, b) => String(a.name).localeCompare(String(b.name), "sv"));
  const userIds = users.map((row) => String(row.id));
  const personIds = [...new Set(users.map((row) => row.personId).filter(Boolean))];
  const supplierIds = [...new Set(users.map((row) => row.supplierId).filter(Boolean))];
  const roleIds = roles.map((row) => String(row.id));
  const [personResult, personRoleResult, supplierResult, userRoleResult, permissionResult] = await Promise.all([
    personIds.length
      ? admin.from("Person").select("id,firstName,lastName").eq("organizationId", organizationId).in("id", personIds)
      : Promise.resolve({ data: [], error: null }),
    personIds.length
      ? admin.from("PersonRole").select("id,personId,role").in("personId", personIds).limit(2000)
      : Promise.resolve({ data: [], error: null }),
    supplierIds.length
      ? admin.from("Supplier").select("id,name").eq("organizationId", organizationId).in("id", supplierIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? admin.from("UserRole").select("id,userId,roleId,propertyId").in("userId", userIds).limit(2000)
      : Promise.resolve({ data: [], error: null }),
    roleIds.length
      ? admin.from("RolePermission").select("id,roleId,permission").in("roleId", roleIds).limit(5000)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (personResult.error) fail("Adminanvändarnas personer", personResult.error);
  if (personRoleResult.error) fail("Adminanvändarnas personroller", personRoleResult.error);
  if (supplierResult.error) fail("Adminanvändarnas entreprenörer", supplierResult.error);
  if (userRoleResult.error) fail("Användarroller", userRoleResult.error);
  if (permissionResult.error) fail("Rollbehörigheter", permissionResult.error);
  const personRoles = groupBy((personRoleResult.data ?? []) as unknown as Row[], "personId");
  const persons = new Map<string, Row>(
    ((personResult.data ?? []) as unknown as Row[]).map((row) => [
      String(row.id),
      { ...row, roles: personRoles.get(String(row.id)) ?? [] },
    ] as const)
  );
  const suppliers = new Map<string, Row>(
    ((supplierResult.data ?? []) as unknown as Row[]).map((row) => [String(row.id), row] as const)
  );
  const roleMap = new Map<string, Row>(roles.map((row) => [String(row.id), row] as const));
  const hydratedUserRoles = ((userRoleResult.data ?? []) as unknown as Row[]).map((row) => ({
    ...row,
    role: roleMap.get(String(row.roleId)) ?? null,
  })) as Row[];
  const userRoles = groupBy(hydratedUserRoles, "userId");
  const roleUsers = groupBy((userRoleResult.data ?? []) as unknown as Row[], "roleId");
  const permissions = groupBy((permissionResult.data ?? []) as unknown as Row[], "roleId");
  return {
    users: users.map((row) => ({
      ...row,
      person: persons.get(String(row.personId)) ?? null,
      supplier: suppliers.get(String(row.supplierId)) ?? null,
      userRoles: userRoles.get(String(row.id)) ?? [],
    })) as Row[],
    roles: roles.map((row) => ({
      ...row,
      permissions: permissions.get(String(row.id)) ?? [],
      _count: { userRoles: roleUsers.get(String(row.id))?.length ?? 0 },
    })) as Row[],
  };
}
