import type {
  Person,
  Unit,
  Contract,
  Invoice,
  InvoiceLine,
  Listing,
  Application,
  Property,
  Building,
  MaintenanceRequest,
  WebhookSubscription,
  ExternalReference,
  Payment,
} from "@/lib/database-types";

/** API-representationer – frikopplade från interna modeller och UI. */

export function serializePerson(p: Person & { externalReferences?: ExternalReference[] }) {
  return {
    id: p.id,
    first_name: p.firstName,
    last_name: p.lastName,
    email: p.email,
    phone: p.phone,
    is_company: p.isCompany,
    company_name: p.companyName,
    address: p.address,
    postal_code: p.postalCode,
    city: p.city,
    country: p.country,
    external_references: (p.externalReferences ?? []).map((r) => ({
      system: r.externalSystem,
      entity_type: r.entityType,
      external_id: r.externalId,
      sync_status: r.syncStatus,
      last_synced_at: r.lastSyncedAt,
    })),
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

export function serializeProperty(p: Property) {
  return {
    id: p.id,
    name: p.name,
    designation: p.designation,
    address: p.address,
    postal_code: p.postalCode,
    city: p.city,
    municipality: p.municipality,
    year_built: p.yearBuilt,
    energy_class: p.energyClass,
    status: p.status,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

export function serializeBuilding(b: Building) {
  return {
    id: b.id,
    property_id: b.propertyId,
    name: b.name,
    address: b.address,
    year_built: b.yearBuilt,
    floors_count: b.floorsCount,
  };
}

export function serializeUnit(u: Unit) {
  return {
    id: u.id,
    property_id: u.propertyId,
    unit_number: u.unitNumber,
    apartment_number: u.apartmentNumber,
    type: u.type,
    status: u.status,
    address: u.address,
    postal_code: u.postalCode,
    city: u.city,
    area: u.area,
    floor_level: u.floorLevel,
    rooms: u.rooms ? Number(u.rooms) : null,
    living_area: u.livingArea ? Number(u.livingArea) : null,
    rent: u.rent ? Number(u.rent) : null,
    price: u.price ? Number(u.price) : null,
    available_from: u.availableFrom,
    created_at: u.createdAt,
    updated_at: u.updatedAt,
  };
}

export function serializeListing(l: Listing) {
  return {
    id: l.id,
    unit_id: l.unitId,
    title: l.title,
    slug: l.slug,
    category: l.category,
    status: l.status,
    published_at: l.publishedAt,
    application_deadline: l.applicationDeadline,
    move_in_date: l.moveInDate,
    rent: l.rent ? Number(l.rent) : null,
    price: l.price ? Number(l.price) : null,
    created_at: l.createdAt,
  };
}

export function serializeApplication(a: Application) {
  return {
    id: a.id,
    listing_id: a.listingId,
    status: a.status,
    is_internal_transfer: a.isInternalTransfer,
    desired_move_in_date: a.desiredMoveInDate,
    submitted_at: a.submittedAt,
    created_at: a.createdAt,
  };
}

export function serializeContract(c: Contract & { externalReferences?: ExternalReference[] }) {
  return {
    id: c.id,
    unit_id: c.unitId,
    contract_number: c.contractNumber,
    type: c.type,
    status: c.status,
    start_date: c.startDate,
    end_date: c.endDate,
    notice_period_months: c.noticePeriodMonths,
    rent: Number(c.rent),
    deposit: c.deposit ? Number(c.deposit) : null,
    invoice_reference: c.invoiceReference,
    is_imported: c.isImported,
    external_references: (c.externalReferences ?? []).map((r) => ({
      system: r.externalSystem,
      external_id: r.externalId,
    })),
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

export function serializeInvoice(
  i: Invoice & { lines?: InvoiceLine[]; externalReferences?: ExternalReference[] }
) {
  return {
    id: i.id,
    person_id: i.personId,
    contract_id: i.contractId,
    invoice_number: i.invoiceNumber,
    status: i.status,
    invoice_date: i.invoiceDate,
    due_date: i.dueDate,
    period_start: i.periodStart,
    period_end: i.periodEnd,
    total_amount: Number(i.totalAmount),
    vat_amount: Number(i.vatAmount),
    paid_amount: Number(i.paidAmount),
    remaining_amount: Number(i.totalAmount) - Number(i.paidAmount),
    currency: i.currency,
    ocr: i.ocr,
    bankgiro: i.bankgiro,
    reference: i.reference,
    is_credit_note: i.isCreditNote,
    lines: (i.lines ?? []).map((l) => ({
      description: l.description,
      quantity: Number(l.quantity),
      unit_price: Number(l.unitPrice),
      vat_rate: Number(l.vatRate),
      amount: Number(l.amount),
    })),
    external_references: (i.externalReferences ?? []).map((r) => ({
      system: r.externalSystem,
      external_id: r.externalId,
      sync_status: r.syncStatus,
      last_synced_at: r.lastSyncedAt,
    })),
    created_at: i.createdAt,
    updated_at: i.updatedAt,
  };
}

export function serializePayment(p: Payment) {
  return {
    id: p.id,
    amount: Number(p.amount),
    currency: p.currency,
    paid_at: p.paidAt,
    method: p.method,
    reference: p.reference,
  };
}

export function serializeMaintenanceRequest(m: MaintenanceRequest) {
  return {
    id: m.id,
    request_number: m.requestNumber,
    unit_id: m.unitId,
    status: m.status,
    priority: m.priority,
    category: m.category,
    title: m.title,
    is_emergency: m.isEmergency,
    created_at: m.createdAt,
    updated_at: m.updatedAt,
  };
}

export function serializeWebhookSubscription(w: WebhookSubscription) {
  return {
    id: w.id,
    url: w.url,
    events: w.events,
    is_active: w.isActive,
    disabled_at: w.disabledAt,
    disabled_reason: w.disabledReason,
    created_at: w.createdAt,
  };
}
