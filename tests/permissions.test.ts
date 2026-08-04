import { describe, it, expect } from "vitest";
import {
  getPersonRoleLabels,
  getRoleDisplayNames,
  hasPermission,
  hasApiScope,
  isValidPermission,
  SYSTEM_ROLES,
} from "@/lib/permissions";

describe("RBAC-behörigheter", () => {
  it("superadmin (wildcard) har alla behörigheter", () => {
    expect(hasPermission(["*"], "invoices", "delete")).toBe(true);
    expect(hasPermission(["*"], "audit", "read")).toBe(true);
  });

  it("resurs-wildcard ger alla åtgärder på resursen", () => {
    expect(hasPermission(["invoices:*"], "invoices", "update")).toBe(true);
    expect(hasPermission(["invoices:*"], "contracts", "read")).toBe(false);
  });

  it("exakt behörighet krävs annars", () => {
    expect(hasPermission(["units:read"], "units", "read")).toBe(true);
    expect(hasPermission(["units:read"], "units", "update")).toBe(false);
  });

  it("entreprenörsrollen har endast arbetsorderbehörighet", () => {
    const contractor = SYSTEM_ROLES.find((r) => r.slug === "contractor")!;
    expect(hasPermission(contractor.permissions, "workorders", "read")).toBe(true);
    expect(hasPermission(contractor.permissions, "workorders", "update")).toBe(true);
    expect(hasPermission(contractor.permissions, "invoices", "read")).toBe(false);
    expect(hasPermission(contractor.permissions, "persons", "read")).toBe(false);
    expect(hasPermission(contractor.permissions, "contracts", "read")).toBe(false);
  });

  it("ekonomrollen kommer inte åt användaradministration", () => {
    const finance = SYSTEM_ROLES.find((r) => r.slug === "finance")!;
    expect(hasPermission(finance.permissions, "invoices", "update")).toBe(true);
    expect(hasPermission(finance.permissions, "users", "create")).toBe(false);
    expect(hasPermission(finance.permissions, "roles", "create")).toBe(false);
  });

  it("visar tydliga canonical rollnamn", () => {
    expect(getRoleDisplayNames(["superadmin"])).toEqual(["Ägare / superadmin"]);
    expect(getRoleDisplayNames(["custom"], ["Regional förvaltare"])).toEqual(["Regional förvaltare"]);
    expect(getPersonRoleLabels(["TENANT", "CO_APPLICANT"])).toEqual(["Hyresgäst", "Medsökande"]);
  });

  it("avvisar okända behörighetssträngar", () => {
    expect(isValidPermission("maintenance:update")).toBe(true);
    expect(isValidPermission("maintenance:*")).toBe(true);
    expect(isValidPermission("unknown:read")).toBe(false);
    expect(isValidPermission("maintenance:publish")).toBe(false);
  });

  it("API-scopes fungerar med wildcard per resurs", () => {
    expect(hasApiScope(["invoices:read"], "invoices:read")).toBe(true);
    expect(hasApiScope(["invoices:read"], "invoices:write")).toBe(false);
    expect(hasApiScope(["invoices:*"], "invoices:write")).toBe(true);
    expect(hasApiScope(["*"], "customers:write")).toBe(true);
  });
});
