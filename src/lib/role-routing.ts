/**
 * Canonical role routing shared by login, public navigation, portal and admin.
 * Keep role slugs here so the same account is classified consistently everywhere.
 */
export const STAFF_ROLE_SLUGS = [
  "superadmin",
  "org-admin",
  "property-owner",
  "property-manager",
  "caretaker",
  "leasing-agent",
  "sales-manager",
  "finance",
  "customer-service",
  "facility-worker",
  "inspector",
  "report-viewer",
] as const;

export const OWNER_ROLE_SLUGS = ["superadmin"] as const;
export const CONTRACTOR_ROLE_SLUGS = ["contractor"] as const;

export function hasAnyRole(roleSlugs: string[], acceptedRoles: readonly string[]): boolean {
  return roleSlugs.some((role) => acceptedRoles.includes(role));
}

export function isStaffAccount(roleSlugs: string[]): boolean {
  return hasAnyRole(roleSlugs, STAFF_ROLE_SLUGS);
}

export function isOwnerAccount(roleSlugs: string[]): boolean {
  return hasAnyRole(roleSlugs, OWNER_ROLE_SLUGS);
}

export function isTenantPerson(personRoles: string[]): boolean {
  return personRoles.some((role) => role === "TENANT" || role === "CO_TENANT");
}

export function isContractorAccount(roleSlugs: string[]): boolean {
  return hasAnyRole(roleSlugs, CONTRACTOR_ROLE_SLUGS);
}

export function defaultDashboardForRoles(
  roleSlugs: string[]
): "/admin" | "/entreprenor" | "/mina-sidor" {
  if (isStaffAccount(roleSlugs)) return "/admin";
  if (isContractorAccount(roleSlugs)) return "/entreprenor";
  return "/mina-sidor";
}
