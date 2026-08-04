/**
 * Rollbaserad behörighet (RBAC).
 *
 * Permissions har formen "<resurs>:<åtgärd>", t.ex. "invoices:read".
 * Wildcard "*" ger alla behörigheter (superadmin).
 * "<resurs>:*" ger alla åtgärder på en resurs.
 */

export const RESOURCES = [
  "organizations",
  "persons",
  "users",
  "roles",
  "properties",
  "buildings",
  "units",
  "listings",
  "applications",
  "viewings",
  "offers",
  "contracts",
  "terminations",
  "inspections",
  "invoices",
  "payments",
  "maintenance",
  "workorders",
  "suppliers",
  "documents",
  "messages",
  "notifications",
  "integrations",
  "webhooks",
  "apikeys",
  "imports",
  "reports",
  "audit",
  "settings",
] as const;

export const ACTIONS = [
  "read",
  "create",
  "update",
  "delete",
  "approve",
  "export",
] as const;

export type Resource = (typeof RESOURCES)[number];
export type Action = (typeof ACTIONS)[number];
export type Permission = `${Resource}:${Action}` | `${Resource}:*` | "*";

export function hasPermission(
  granted: string[],
  resource: Resource,
  action: Action
): boolean {
  return (
    granted.includes("*") ||
    granted.includes(`${resource}:*`) ||
    granted.includes(`${resource}:${action}`)
  );
}

export function isValidPermission(permission: string): permission is Permission {
  if (permission === "*") return true;
  const [resource, action, ...extra] = permission.split(":");
  return (
    extra.length === 0 &&
    RESOURCES.includes(resource as Resource) &&
    (action === "*" || ACTIONS.includes(action as Action))
  );
}

export interface SystemRoleDefinition {
  slug: string;
  name: string;
  description: string;
  permissions: string[];
}

/** Systemroller som skapas av migrationerna. Egna roller kan skapas per organisation. */
export const SYSTEM_ROLES: SystemRoleDefinition[] = [
  {
    slug: "superadmin",
    name: "Ägare / superadmin",
    description: "Full ägarbehörighet i hela FaddeBo, inklusive personal och roller.",
    permissions: ["*"],
  },
  {
    slug: "org-admin",
    name: "Bolagsadmin",
    description: "Administrerar bolagets användare och samtliga verksamhetsflöden.",
    permissions: [
      "persons:*", "users:*", "roles:*", "properties:*", "buildings:*",
      "units:*", "listings:*", "applications:*", "viewings:*", "offers:*",
      "contracts:*", "terminations:*", "inspections:*", "invoices:*",
      "payments:*", "maintenance:*", "workorders:*", "suppliers:*",
      "documents:*", "messages:*", "notifications:*", "integrations:*",
      "webhooks:*", "apikeys:*", "imports:*", "reports:*", "audit:read",
      "settings:*",
    ],
  },
  {
    slug: "property-owner",
    name: "Fastighetsägare",
    description: "Läs- och rapportbehörighet för fastighetsägare.",
    permissions: [
      "properties:read", "buildings:read", "units:read", "listings:read",
      "contracts:read", "invoices:read", "payments:read", "reports:*",
      "maintenance:read", "workorders:read", "audit:read",
    ],
  },
  {
    slug: "property-manager",
    name: "Fastighetsvärd / förvaltare",
    description: "Operativ helhetsbehörighet för uthyrning, hyresgäster och förvaltning.",
    permissions: [
      "persons:*", "properties:*", "buildings:*", "units:*", "listings:*",
      "applications:*", "viewings:*", "offers:*", "contracts:*",
      "terminations:*", "inspections:*", "maintenance:*", "workorders:*",
      "suppliers:*", "documents:*", "messages:*", "invoices:read",
      "payments:read", "imports:*", "reports:read",
    ],
  },
  {
    slug: "caretaker",
    name: "Kvartersvärd",
    description: "Boendeservice, felanmälningar och arbetsorder.",
    permissions: [
      "properties:read", "buildings:read", "units:read", "maintenance:*",
      "workorders:*", "messages:*", "persons:read", "documents:read",
    ],
  },
  {
    slug: "leasing-agent",
    name: "Uthyrare",
    description: "Annonser, ansökningar, visningar, erbjudanden och avtal.",
    permissions: [
      "persons:*", "units:read", "units:update", "listings:*",
      "applications:*", "viewings:*", "offers:*", "contracts:*",
      "documents:*", "messages:*", "reports:read",
    ],
  },
  {
    slug: "sales-manager",
    name: "Försäljningsansvarig",
    description: "Försäljning och kommersiella objekt.",
    permissions: [
      "persons:read", "units:read", "units:update", "listings:*",
      "viewings:*", "offers:*", "contracts:*", "documents:*",
      "messages:*", "reports:read",
    ],
  },
  {
    slug: "finance",
    name: "Ekonom",
    description: "Fakturor, betalningar, integrationer och ekonomirapporter.",
    permissions: [
      "persons:read", "contracts:read", "invoices:*", "payments:*",
      "integrations:*", "reports:*", "audit:read",
    ],
  },
  {
    slug: "customer-service",
    name: "Kundtjänst",
    description: "Kundservice, ärenden, meddelanden och relevanta läsvyer.",
    permissions: [
      "persons:read", "persons:update", "units:read", "listings:read",
      "applications:read", "applications:update", "contracts:read",
      "invoices:read", "maintenance:*", "messages:*", "documents:read",
    ],
  },
  {
    slug: "facility-worker",
    name: "Fastighetsskötare",
    description: "Utför och uppdaterar felanmälningar och arbetsorder.",
    permissions: [
      "maintenance:read", "maintenance:update", "workorders:read",
      "workorders:update", "units:read",
    ],
  },
  {
    slug: "inspector",
    name: "Besiktningsman",
    description: "Besiktningar och tillhörande dokument.",
    permissions: [
      "inspections:*", "units:read", "contracts:read", "documents:create",
      "documents:read",
    ],
  },
  {
    slug: "contractor",
    name: "Entreprenör",
    description: "Ser och uppdaterar endast leverantörens egna arbetsorder.",
    permissions: ["workorders:read", "workorders:update"],
  },
  {
    slug: "report-viewer",
    name: "Rapportläsare",
    description: "Läsbehörighet till rapporter.",
    permissions: ["reports:read"],
  },
];

export const SYSTEM_ROLE_BY_SLUG = new Map(
  SYSTEM_ROLES.map((role) => [role.slug, role] as const)
);

export const PERSON_ROLE_LABELS: Record<string, string> = {
  APPLICANT: "Sökande",
  TENANT: "Hyresgäst",
  CO_APPLICANT: "Medsökande",
  GUARANTOR: "Borgensman",
  BUYER: "Köpare",
  CONTACT: "Kontakt",
  HOUSEHOLD_MEMBER: "Hushållsmedlem",
};

export function getRoleDisplayNames(roleSlugs: string[], roleNames: string[] = []): string[] {
  const names = roleNames.filter(Boolean);
  if (names.length > 0) return [...new Set(names)];
  return [...new Set(roleSlugs.map((slug) => SYSTEM_ROLE_BY_SLUG.get(slug)?.name ?? slug))];
}

export function getPersonRoleLabels(personRoles: string[]): string[] {
  return [...new Set(personRoles.map((role) => PERSON_ROLE_LABELS[role] ?? role))];
}

/** API-scopes för externa integrationer, per resurs. */
export const API_SCOPES = [
  "persons:read", "persons:write",
  "customers:read", "customers:write",
  "tenants:read",
  "properties:read", "properties:write",
  "buildings:read",
  "units:read", "units:write",
  "listings:read", "listings:write",
  "applications:read",
  "contracts:read", "contracts:write",
  "invoices:read", "invoices:write",
  "payments:read", "payments:write",
  "credit-notes:read", "credit-notes:write",
  "maintenance:read", "maintenance:write",
  "workorders:read",
  "documents:read",
  "notifications:read",
  "webhook-subscriptions:read", "webhook-subscriptions:write",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export function hasApiScope(granted: string[], scope: ApiScope): boolean {
  if (granted.includes("*")) return true;
  if (granted.includes(scope)) return true;
  const [resource] = scope.split(":");
  return granted.includes(`${resource}:*`);
}
