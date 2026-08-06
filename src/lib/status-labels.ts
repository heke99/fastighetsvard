import type { MaintenanceStatus } from "@/lib/database-types";

export type MaintenanceStatusAudience = "staff" | "tenant";

/**
 * Canonical, neutral labels used for staff views, logs and integrations.
 * Audience-specific wording is applied by getMaintenanceStatusLabel().
 */
export const maintenanceStatusLabels: Record<MaintenanceStatus, string> = {
  RECEIVED: "Inkommen",
  CONFIRMED: "Bekräftad",
  ASSESSING: "Under bedömning",
  NEEDS_INFO: "Komplettering krävs",
  ASSIGNED: "Tilldelad",
  BOOKED: "Bokad",
  IN_PROGRESS: "Pågående",
  WAITING_TENANT: "Väntar på hyresgäst",
  WAITING_CONTRACTOR: "Väntar på entreprenör",
  WAITING_MATERIAL: "Väntar på material",
  DONE: "Färdig",
  QUALITY_CHECK: "Kvalitetskontroll",
  CLOSED: "Stängd",
  REJECTED: "Avvisad",
  REOPENED: "Återöppnad",
};

export function getMaintenanceStatusLabel(
  status: MaintenanceStatus,
  audience: MaintenanceStatusAudience = "staff"
): string {
  if (status === "WAITING_TENANT" && audience === "tenant") {
    return "Väntar på dig";
  }
  return maintenanceStatusLabels[status];
}

export function isMaintenanceStatus(value: unknown): value is MaintenanceStatus {
  return typeof value === "string" && value in maintenanceStatusLabels;
}
