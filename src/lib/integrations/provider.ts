/**
 * Providerbaserat integrationslager mot bokföringssystem.
 *
 * Varje leverantör (Fortnox, Visma, Björn Lundén, Business Central, ...)
 * implementerar samma interface. Plattformen skapar aldrig kopior av externa
 * poster – allt mappas via ExternalReference med unika externa ID:n.
 */

export interface ExternalCustomer {
  externalId: string;
  customerNumber?: string;
  name: string;
  email?: string;
  phone?: string;
  personalNumber?: string;
  orgNumber?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  sourceUpdatedAt?: string;
  sourceVersion?: string;
}

export interface ExternalInvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  amount: number;
}

export interface ExternalInvoice {
  externalId: string;
  invoiceNumber: string;
  externalCustomerId: string;
  externalContractId?: string;
  invoiceDate: string;
  dueDate: string;
  periodStart?: string;
  periodEnd?: string;
  totalAmount: number;
  vatAmount: number;
  paidAmount: number;
  currency: string;
  status: "draft" | "sent" | "partially_paid" | "paid" | "overdue" | "reminded" | "collection" | "credited" | "cancelled";
  ocr?: string;
  bankgiro?: string;
  reference?: string;
  lines: ExternalInvoiceLine[];
  isCreditNote?: boolean;
  creditsExternalInvoiceId?: string;
  sourceUpdatedAt?: string;
  sourceVersion?: string;
}

export interface ExternalPayment {
  externalId: string;
  externalInvoiceId: string;
  amount: number;
  currency: string;
  paidAt: string;
  method?: string;
  reference?: string;
}

export interface AccountingProvider {
  readonly name: string;
  fetchCustomers(since?: Date): Promise<ExternalCustomer[]>;
  fetchInvoices(since?: Date): Promise<ExternalInvoice[]>;
  fetchPayments(since?: Date): Promise<ExternalPayment[]>;
  fetchInvoicePdf(externalInvoiceId: string): Promise<Buffer | null>;
  pushCustomerUpdate(customer: ExternalCustomer): Promise<void>;
  pushContractReference(externalCustomerId: string, contractNumber: string): Promise<void>;
}

export type ProviderCredentials = Record<string, string>;

export type ProviderFactory = (credentials: ProviderCredentials, settings?: Record<string, unknown>) => AccountingProvider;

const registry = new Map<string, ProviderFactory>();

export function registerProvider(name: string, factory: ProviderFactory) {
  registry.set(name, factory);
}

export function createProvider(
  name: string,
  credentials: ProviderCredentials,
  settings?: Record<string, unknown>
): AccountingProvider {
  const factory = registry.get(name);
  if (!factory) {
    throw new Error(
      `Okänd bokföringsprovider: ${name}. Registrerade: ${[...registry.keys()].join(", ") || "(inga)"}`
    );
  }
  return factory(credentials, settings);
}

export function listProviders(): string[] {
  return [...registry.keys()];
}
