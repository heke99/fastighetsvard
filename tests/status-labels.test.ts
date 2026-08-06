import { describe, expect, it } from "vitest";
import type { MaintenanceStatus } from "@/lib/database-types";
import {
  getMaintenanceStatusLabel,
  isMaintenanceStatus,
  maintenanceStatusLabels,
} from "@/lib/status-labels";

const statuses: MaintenanceStatus[] = [
  "RECEIVED",
  "CONFIRMED",
  "ASSESSING",
  "NEEDS_INFO",
  "ASSIGNED",
  "BOOKED",
  "IN_PROGRESS",
  "WAITING_TENANT",
  "WAITING_CONTRACTOR",
  "WAITING_MATERIAL",
  "DONE",
  "QUALITY_CHECK",
  "CLOSED",
  "REJECTED",
  "REOPENED",
];

describe("maintenance status labels", () => {
  it("covers every canonical maintenance status", () => {
    expect(Object.keys(maintenanceStatusLabels).sort()).toEqual([...statuses].sort());
    for (const status of statuses) {
      expect(getMaintenanceStatusLabel(status)).not.toBe("");
      expect(isMaintenanceStatus(status)).toBe(true);
    }
  });

  it("uses neutral wording for staff and integrations", () => {
    expect(getMaintenanceStatusLabel("WAITING_TENANT")).toBe("Väntar på hyresgäst");
    expect(getMaintenanceStatusLabel("WAITING_TENANT", "staff")).toBe("Väntar på hyresgäst");
  });

  it("uses direct wording only in tenant-facing surfaces", () => {
    expect(getMaintenanceStatusLabel("WAITING_TENANT", "tenant")).toBe("Väntar på dig");
    expect(getMaintenanceStatusLabel("WAITING_CONTRACTOR", "tenant")).toBe("Väntar på entreprenör");
  });

  it("rejects unknown runtime values", () => {
    expect(isMaintenanceStatus("UNKNOWN")).toBe(false);
    expect(isMaintenanceStatus(null)).toBe(false);
  });
});
