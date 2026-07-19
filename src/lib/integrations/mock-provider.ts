import {
  registerProvider,
  type AccountingProvider,
  type ExternalCustomer,
  type ExternalInvoice,
  type ExternalPayment,
} from "./provider";

/**
 * Mock-provider för test och demo. I settings kan man lägga in
 * `customers`, `invoices`, `payments` som fasta dataset – används av
 * testerna och som referensimplementation för riktiga providers
 * (Fortnox, Visma, Björn Lundén, Business Central).
 */
class MockProvider implements AccountingProvider {
  readonly name = "mock";
  constructor(
    private data: {
      customers?: ExternalCustomer[];
      invoices?: ExternalInvoice[];
      payments?: ExternalPayment[];
      failFetch?: boolean;
    }
  ) {}

  async fetchCustomers(): Promise<ExternalCustomer[]> {
    if (this.data.failFetch) throw new Error("Extern tjänst svarar inte (simulerat avbrott).");
    return this.data.customers ?? [];
  }

  async fetchInvoices(): Promise<ExternalInvoice[]> {
    if (this.data.failFetch) throw new Error("Extern tjänst svarar inte (simulerat avbrott).");
    return this.data.invoices ?? [];
  }

  async fetchPayments(): Promise<ExternalPayment[]> {
    if (this.data.failFetch) throw new Error("Extern tjänst svarar inte (simulerat avbrott).");
    return this.data.payments ?? [];
  }

  async fetchInvoicePdf(): Promise<Buffer | null> {
    return null;
  }

  async pushCustomerUpdate(): Promise<void> {
    // no-op i mock
  }

  async pushContractReference(): Promise<void> {
    // no-op i mock
  }
}

registerProvider("mock", (_credentials, settings) => {
  return new MockProvider((settings as ConstructorParameters<typeof MockProvider>[0]) ?? {});
});

export { MockProvider };
