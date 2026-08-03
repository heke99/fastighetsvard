import { describe, expect, it } from "vitest";
import {
  defaultDashboardForRoles,
  isOwnerAccount,
  isStaffAccount,
  isTenantPerson,
  isContractorAccount,
} from "@/lib/role-routing";

describe("FaddeBo role routing", () => {
  it("routes owner and property manager accounts to administration", () => {
    expect(defaultDashboardForRoles(["superadmin"])).toBe("/admin");
    expect(defaultDashboardForRoles(["property-manager"])).toBe("/admin");
    expect(isStaffAccount(["property-manager"])).toBe(true);
  });

  it("routes applicants and tenants to Mina sidor", () => {
    expect(defaultDashboardForRoles([])).toBe("/mina-sidor");
    expect(defaultDashboardForRoles(["tenant"])).toBe("/mina-sidor");
    expect(isStaffAccount([])).toBe(false);
  });

  it("routes contractor accounts to the contractor portal", () => {
    expect(defaultDashboardForRoles(["contractor"])).toBe("/entreprenor");
    expect(isContractorAccount(["contractor"])).toBe(true);
    expect(isStaffAccount(["contractor"])).toBe(false);
  });

  it("treats primary and co-tenants as tenant portal users", () => {
    expect(isTenantPerson(["TENANT"])).toBe(true);
    expect(isTenantPerson(["CO_TENANT"])).toBe(true);
    expect(isTenantPerson(["APPLICANT"])).toBe(false);
  });

  it("only classifies owner roles as owner accounts", () => {
    expect(isOwnerAccount(["superadmin"])).toBe(true);
    expect(isOwnerAccount(["org-admin"])).toBe(false);
    expect(isOwnerAccount(["property-manager"])).toBe(false);
  });
});
