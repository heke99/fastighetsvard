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

/** Systemroller som skapas vid seed. Superadmin kan skapa egna roller utöver dessa. */
export const SYSTEM_ROLES: {
  slug: string;
  name: string;
  permissions: string[];
}[] = [
  { slug: "superadmin", name: "Superadmin", permissions: ["*"] },
  {
    slug: "org-admin",
    name: "Bolagsadmin",
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
    permissions: [
      "properties:read", "buildings:read", "units:read", "listings:read",
      "contracts:read", "invoices:read", "payments:read", "reports:*",
      "maintenance:read", "workorders:read", "audit:read",
    ],
  },
  {
    slug: "property-manager",
    name: "Förvaltare",
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
    name: "Fastighetsvärd",
    permissions: [
      "properties:read", "buildings:read", "units:read", "maintenance:*",
      "workorders:*", "messages:*", "persons:read", "documents:read",
    ],
  },
  {
    slug: "leasing-agent",
    name: "Uthyrare",
    permissions: [
      "persons:*", "units:read", "units:update", "listings:*",
      "applications:*", "viewings:*", "offers:*", "contracts:*",
      "documents:*", "messages:*", "reports:read",
    ],
  },
  {
    slug: "sales-manager",
    name: "Försäljningsansvarig",
    permissions: [
      "persons:read", "units:read", "units:update", "listings:*",
      "viewings:*", "offers:*", "contracts:*", "documents:*",
      "messages:*", "reports:read",
    ],
  },
  {
    slug: "finance",
    name: "Ekonom",
    permissions: [
      "persons:read", "contracts:read", "invoices:*", "payments:*",
      "integrations:*", "reports:*", "audit:read",
    ],
  },
  {
    slug: "customer-service",
    name: "Kundtjänst",
    permissions: [
      "persons:read", "persons:update", "units:read", "listings:read",
      "applications:read", "applications:update", "contracts:read",
      "invoices:read", "maintenance:*", "messages:*", "documents:read",
    ],
  },
  {
    slug: "facility-worker",
    name: "Fastighetsskötare",
    permissions: ["maintenance:read", "maintenance:update", "workorders:read", "workorders:update", "units:read"],
  },
  {
    slug: "inspector",
    name: "Besiktningsman",
    permissions: ["inspections:*", "units:read", "contracts:read", "documents:create", "documents:read"],
  },
  {
    slug: "contractor",
    name: "Entreprenör",
    // Ser endast egna arbetsorder – filtreras dessutom på supplierId i queries.
    permissions: ["workorders:read", "workorders:update"],
  },
  {
    slug: "report-viewer",
    name: "Rapportläsare",
    permissions: ["reports:read"],
  },
];

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
