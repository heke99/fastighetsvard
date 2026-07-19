export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type InputJsonValue = JsonValue;
export type Decimal = number | string;

export namespace Database {
  export type JsonValue = import("./database-types").JsonValue;
  export type InputJsonValue = import("./database-types").InputJsonValue;
  export type TransactionClient = import("./db").SupabaseDatabase;
  export type Decimal = number | string;
  export type PersonWhereInput = Record<string, unknown>;
  export type PersonUpdateInput = Record<string, any>;
  export type PaymentWhereInput = Record<string, unknown>;
  export type ListingWhereInput = Record<string, unknown>;
  export type ListingOrderByWithRelationInput = Record<string, unknown>;
  export type UnitWhereInput = Record<string, unknown>;
  export type InvoiceWhereInput = Record<string, unknown>;
  export type InvoiceOrderByWithRelationInput = Record<string, unknown>;
  export type ContractWhereInput = Record<string, unknown>;
  export type ApplicationWhereInput = Record<string, unknown>;
  export type MaintenanceRequestWhereInput = Record<string, unknown>;
  export type PersonOrderByWithRelationInput = Record<string, unknown>;
  export type ApplicationGetPayload<T> = any;
  export type PersonGetPayload<T> = any;
  export type ListingGetPayload<T> = any;
  export type ContractGetPayload<T> = any;
  export type MaintenanceRequestGetPayload<T> = any;
}

export type Person = Record<string, any>;
export type Listing = Record<string, any>;
export type Unit = Record<string, any>;
export type UnitMedia = Record<string, any>;
export type ApiKey = Record<string, any>;
export type Contract = Record<string, any>;
export type Invoice = Record<string, any>;
export type InvoiceLine = Record<string, any>;
export type Application = Record<string, any>;
export type Property = Record<string, any>;
export type Building = Record<string, any>;
export type MaintenanceRequest = Record<string, any>;
export type WebhookSubscription = Record<string, any>;
export type ExternalReference = Record<string, any>;
export type Payment = Record<string, any>;


export type ListingCategory = "RENTAL" | "SALE" | "COMMERCIAL" | "PARKING";
export type ListingStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "PAUSED" | "UNPUBLISHED" | "COMPLETED";
export type UnitType = "APARTMENT" | "APARTMENT_SALE" | "COMMERCIAL" | "OFFICE" | "RETAIL" | "WAREHOUSE" | "GARAGE" | "PARKING" | "STORAGE" | "STUDENT" | "SHORT_TERM" | "LAND" | "PROPERTY_SALE";
export type UnitStatus = "DRAFT" | "NOT_PUBLISHED" | "UPCOMING" | "PUBLISHED" | "APPLICATION_OPEN" | "VIEWING" | "OFFER_SENT" | "RESERVED" | "CONTRACT_SENT" | "RENTED" | "FOR_SALE" | "BIDDING" | "SOLD" | "RENOVATING" | "BLOCKED" | "NOT_RENTABLE" | "ARCHIVED";
export type ApplicationStatus = "DRAFT" | "SUBMITTED" | "RECEIVED" | "UNDER_REVIEW" | "NEEDS_SUPPLEMENT" | "QUALIFIED" | "NOT_QUALIFIED" | "VIEWING_OFFERED" | "VIEWING_BOOKED" | "OFFER_SENT" | "ACCEPTED" | "DECLINED" | "CONTRACT_SENT" | "CONTRACT_SIGNED" | "CLOSED" | "WITHDRAWN";
export type ContractStatus = "DRAFT" | "INTERNAL_REVIEW" | "APPROVED" | "SENT_FOR_SIGNING" | "PARTIALLY_SIGNED" | "SIGNED" | "ACTIVE" | "TERMINATED" | "ENDED" | "RESCINDED" | "ARCHIVED";
export type InvoiceStatus = "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "REMINDED" | "COLLECTION" | "CREDITED" | "CANCELLED" | "DISPUTED";
export type MaintenanceStatus = "RECEIVED" | "CONFIRMED" | "ASSESSING" | "NEEDS_INFO" | "ASSIGNED" | "BOOKED" | "IN_PROGRESS" | "WAITING_TENANT" | "WAITING_CONTRACTOR" | "WAITING_MATERIAL" | "DONE" | "QUALITY_CHECK" | "CLOSED" | "REJECTED" | "REOPENED";
export type MaintenancePriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type WorkOrderStatus = "CREATED" | "OFFERED" | "ACCEPTED" | "REJECTED" | "BOOKED" | "IN_PROGRESS" | "DONE" | "APPROVED" | "INVOICED" | "CANCELLED";
