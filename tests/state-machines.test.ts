import { describe, it, expect } from "vitest";
import {
  assertTransition,
  canTransition,
  listingTransitions,
  applicationTransitions,
  contractTransitions,
  invoiceTransitions,
  maintenanceTransitions,
  InvalidTransitionError,
} from "@/lib/state-machines";

describe("statusmaskiner", () => {
  it("tillåter giltiga annonsövergångar", () => {
    expect(canTransition(listingTransitions, "DRAFT", "PUBLISHED")).toBe(true);
    expect(canTransition(listingTransitions, "PUBLISHED", "PAUSED")).toBe(true);
    expect(canTransition(listingTransitions, "PUBLISHED", "COMPLETED")).toBe(true);
  });

  it("blockerar ogiltiga annonsövergångar", () => {
    expect(canTransition(listingTransitions, "COMPLETED", "PUBLISHED")).toBe(false);
    expect(() => assertTransition("listing", listingTransitions, "COMPLETED", "DRAFT")).toThrow(
      InvalidTransitionError
    );
  });

  it("följer ansökningsflödet utkast → inskickad → granskning → erbjudande → accepterad", () => {
    expect(canTransition(applicationTransitions, "DRAFT", "SUBMITTED")).toBe(true);
    expect(canTransition(applicationTransitions, "SUBMITTED", "RECEIVED")).toBe(true);
    expect(canTransition(applicationTransitions, "UNDER_REVIEW", "QUALIFIED")).toBe(true);
    expect(canTransition(applicationTransitions, "OFFER_SENT", "ACCEPTED")).toBe(true);
    // Kan inte hoppa direkt från utkast till accepterad.
    expect(canTransition(applicationTransitions, "DRAFT", "ACCEPTED")).toBe(false);
  });

  it("avtal: signerat kan aktiveras men aldrig gå tillbaka till utkast", () => {
    expect(canTransition(contractTransitions, "SIGNED", "ACTIVE")).toBe(true);
    expect(canTransition(contractTransitions, "SIGNED", "DRAFT")).toBe(false);
    expect(canTransition(contractTransitions, "ACTIVE", "TERMINATED")).toBe(true);
    expect(canTransition(contractTransitions, "ENDED", "ACTIVE")).toBe(false);
  });

  it("faktura: betald kan inte bli obetald", () => {
    expect(canTransition(invoiceTransitions, "SENT", "PAID")).toBe(true);
    expect(canTransition(invoiceTransitions, "PAID", "SENT")).toBe(false);
    expect(canTransition(invoiceTransitions, "PAID", "CREDITED")).toBe(true);
    expect(canTransition(invoiceTransitions, "OVERDUE", "COLLECTION")).toBe(true);
  });

  it("felanmälan: stängd kan återöppnas men inte gå direkt till pågående", () => {
    expect(canTransition(maintenanceTransitions, "CLOSED", "REOPENED")).toBe(true);
    expect(canTransition(maintenanceTransitions, "CLOSED", "IN_PROGRESS")).toBe(false);
    expect(canTransition(maintenanceTransitions, "RECEIVED", "CONFIRMED")).toBe(true);
  });
});
