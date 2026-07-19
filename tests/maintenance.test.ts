import { describe, it, expect } from "vitest";
import {
  createMaintenanceRequest,
  changeMaintenanceStatus,
  createWorkOrder,
  changeWorkOrderStatus,
} from "@/lib/services/maintenance";
import {
  createTestOrg,
  createTestProperty,
  createTestUnit,
  createTestPerson,
  prisma,
} from "./helpers";

describe("felanmälan", () => {
  it("skapar ärende med löpnummer, notis och historik", async () => {
    const org = await createTestOrg();
    const property = await createTestProperty(org.id);
    const unit = await createTestUnit(org.id, property.id, "FEL-1");
    const person = await createTestPerson(org.id);

    const r1 = await createMaintenanceRequest(org.id, {
      unitId: unit.id,
      propertyId: property.id,
      personId: person.id,
      category: "VVS",
      title: "Droppande kran",
      description: "Kranen i köket droppar konstant.",
    });
    const r2 = await createMaintenanceRequest(org.id, {
      unitId: unit.id,
      personId: person.id,
      category: "El",
      title: "Trasig lampa i trapphus",
      description: "Lampan på våning 2 är trasig.",
      isEmergency: true,
    });

    expect(r2.requestNumber).toBe(r1.requestNumber + 1);
    expect(r2.priority).toBe("URGENT"); // akut ger automatiskt högsta prioritet

    const notifications = await prisma.notification.count({
      where: { personId: person.id, eventType: "maintenance_received" },
    });
    expect(notifications).toBe(2);
  });

  it("blockerar ogiltiga statusövergångar i backend", async () => {
    const org = await createTestOrg();
    const person = await createTestPerson(org.id);
    const request = await createMaintenanceRequest(org.id, {
      personId: person.id,
      category: "Övrigt",
      title: "Test",
      description: "Testbeskrivning",
    });

    // RECEIVED → CLOSED är inte tillåtet direkt.
    await expect(
      changeMaintenanceStatus(org.id, request.id, "CLOSED")
    ).rejects.toThrow(/ogiltig statusövergång/i);

    // Rätt väg fungerar.
    await changeMaintenanceStatus(org.id, request.id, "CONFIRMED");
    await changeMaintenanceStatus(org.id, request.id, "ASSIGNED");
    await changeMaintenanceStatus(org.id, request.id, "IN_PROGRESS");
    const done = await changeMaintenanceStatus(org.id, request.id, "DONE");
    expect(done.status).toBe("DONE");
  });
});

describe("arbetsorder och entreprenörsisolering", () => {
  it("entreprenör kan bara ändra sina egna arbetsorder", async () => {
    const org = await createTestOrg();
    const supplierA = await prisma.supplier.create({
      data: { organizationId: org.id, name: "Rör AB" },
    });
    const supplierB = await prisma.supplier.create({
      data: { organizationId: org.id, name: "El AB" },
    });

    const workOrder = await createWorkOrder(org.id, {
      supplierId: supplierA.id,
      title: "Byt blandare",
      description: "Byt köksblandare i lgh 1101.",
    });
    expect(workOrder.status).toBe("OFFERED");

    // Entreprenör B försöker acceptera A:s order → hittas inte.
    await expect(
      changeWorkOrderStatus(org.id, workOrder.id, "ACCEPTED", { supplierId: supplierB.id })
    ).rejects.toThrow(/hittades inte/i);

    // Entreprenör A accepterar.
    const accepted = await changeWorkOrderStatus(org.id, workOrder.id, "ACCEPTED", {
      supplierId: supplierA.id,
    });
    expect(accepted.status).toBe("ACCEPTED");

    // Entreprenören kan inte godkänna sin egen order (endast förvaltaren).
    await changeWorkOrderStatus(org.id, workOrder.id, "IN_PROGRESS", { supplierId: supplierA.id });
    await changeWorkOrderStatus(org.id, workOrder.id, "DONE", {
      supplierId: supplierA.id,
      timeReported: 2.5,
      cost: 1800,
    });
    await expect(
      changeWorkOrderStatus(org.id, workOrder.id, "APPROVED", { supplierId: supplierA.id })
    ).rejects.toThrow(/kan inte sätta denna status/i);

    // Förvaltaren godkänner.
    const approved = await changeWorkOrderStatus(org.id, workOrder.id, "APPROVED", {});
    expect(approved.status).toBe("APPROVED");
    expect(Number(approved.timeReported)).toBe(2.5);
    expect(Number(approved.cost)).toBe(1800);
  });

  it("arbetsorder kan inte flyttas till ogiltig status", async () => {
    const org = await createTestOrg();
    const workOrder = await createWorkOrder(org.id, {
      title: "Internt jobb",
      description: "Fixa dörr.",
    });
    expect(workOrder.status).toBe("CREATED");
    await expect(
      changeWorkOrderStatus(org.id, workOrder.id, "INVOICED")
    ).rejects.toThrow(/ogiltig statusövergång/i);
  });
});
