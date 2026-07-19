"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission, AuthError } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {
  registerExistingTenant,
  createInvitation,
  parseTenantCsv,
  previewTenantImport,
  runTenantImport,
} from "@/lib/services/tenants";
import { changeListingStatus, slugify, unpublishListingsForUnit } from "@/lib/services/listings";
import { changeApplicationStatus, sendOffer } from "@/lib/services/applications";
import { changeContractStatus } from "@/lib/services/contracts";
import { changeMaintenanceStatus, createWorkOrder, changeWorkOrderStatus } from "@/lib/services/maintenance";
import { runSyncJob, resolveReviewItem } from "@/lib/integrations/sync";
import { redeliver } from "@/lib/services/webhooks";
import { generateApiKey, generateToken, encryptSecret } from "@/lib/crypto";
import { createManagedAuthUser, deleteManagedAuthUser } from "@/lib/supabase/users";
import type {
  ApplicationStatus, ContractStatus, ListingStatus,
  MaintenanceStatus, WorkOrderStatus, UnitType, ListingCategory,
} from "@/lib/database-types";

export interface AdminFormState {
  status: "idle" | "error" | "success";
  message?: string;
  data?: Record<string, unknown>;
}

function errState(e: unknown): AdminFormState {
  if (e instanceof AuthError) return { status: "error", message: e.message };
  return { status: "error", message: e instanceof Error ? e.message : "Ett fel inträffade." };
}

// ---------------------------------------------------------------------------
// Fastigheter & objekt
// ---------------------------------------------------------------------------

const propertySchema = z.object({
  name: z.string().min(1, "Namn krävs."),
  designation: z.string().optional(),
  address: z.string().min(1, "Adress krävs."),
  postalCode: z.string().optional(),
  city: z.string().min(1, "Ort krävs."),
  municipality: z.string().optional(),
  yearBuilt: z.string().optional(),
  energyClass: z.string().optional(),
  emergencyPhone: z.string().optional(),
});

export async function createPropertyAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  try {
    const user = await requirePermission("properties", "create");
    const data = propertySchema.parse(Object.fromEntries(formData.entries()));
    const property = await db.property.create({
      data: {
        organizationId: user.organizationId!,
        name: data.name,
        designation: data.designation || null,
        address: data.address,
        postalCode: data.postalCode || null,
        city: data.city,
        municipality: data.municipality || null,
        yearBuilt: data.yearBuilt ? parseInt(data.yearBuilt, 10) : null,
        energyClass: data.energyClass || null,
        emergencyPhone: data.emergencyPhone || null,
      },
    });
    await audit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "create",
      entityType: "property",
      entityId: property.id,
      after: { name: data.name, city: data.city },
    });
    revalidatePath("/admin/fastigheter");
    return { status: "success", message: `Fastigheten ${data.name} skapades.` };
  } catch (e) {
    return errState(e);
  }
}

const unitSchema = z.object({
  propertyId: z.string().min(1, "Välj fastighet."),
  unitNumber: z.string().min(1, "Objektsnummer krävs."),
  apartmentNumber: z.string().optional(),
  type: z.string().min(1),
  address: z.string().min(1, "Adress krävs."),
  postalCode: z.string().optional(),
  city: z.string().min(1, "Ort krävs."),
  area: z.string().optional(),
  floorLevel: z.string().optional(),
  rooms: z.string().optional(),
  livingArea: z.string().optional(),
  rent: z.string().optional(),
  price: z.string().optional(),
  deposit: z.string().optional(),
  noticePeriodMonths: z.string().optional(),
  description: z.string().optional(),
});

export async function createUnitAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  try {
    const user = await requirePermission("units", "create");
    const data = unitSchema.parse(Object.fromEntries(formData.entries()));
    const property = await db.property.findFirst({
      where: { id: data.propertyId, organizationId: user.organizationId! },
    });
    if (!property) return { status: "error", message: "Fastigheten hittades inte." };

    const existing = await db.unit.findFirst({
      where: { organizationId: user.organizationId!, unitNumber: data.unitNumber },
    });
    if (existing) return { status: "error", message: `Objektsnummer ${data.unitNumber} finns redan.` };

    const features = (name: string) => formData.get(name) === "1";
    const unit = await db.unit.create({
      data: {
        organizationId: user.organizationId!,
        propertyId: property.id,
        unitNumber: data.unitNumber,
        apartmentNumber: data.apartmentNumber || null,
        type: data.type as UnitType,
        status: "NOT_PUBLISHED",
        address: data.address,
        postalCode: data.postalCode || null,
        city: data.city,
        area: data.area || null,
        floorLevel: data.floorLevel ? parseInt(data.floorLevel, 10) : null,
        rooms: data.rooms ? parseFloat(data.rooms.replace(",", ".")) : null,
        livingArea: data.livingArea ? parseFloat(data.livingArea.replace(",", ".")) : null,
        rent: data.rent ? parseFloat(data.rent.replace(",", ".")) : null,
        price: data.price ? parseFloat(data.price.replace(",", ".")) : null,
        deposit: data.deposit ? parseFloat(data.deposit.replace(",", ".")) : null,
        noticePeriodMonths: data.noticePeriodMonths ? parseInt(data.noticePeriodMonths, 10) : 3,
        description: data.description || null,
        hasElevator: features("hasElevator"),
        hasBalcony: features("hasBalcony"),
        hasPatio: features("hasPatio"),
        hasStorage: features("hasStorage"),
        hasParking: features("hasParking"),
        furnished: features("furnished"),
        accessible: features("accessible"),
        petsAllowed: features("petsAllowed"),
      },
    });
    await audit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "create",
      entityType: "unit",
      entityId: unit.id,
      after: { unitNumber: data.unitNumber },
    });
    revalidatePath("/admin/objekt");
    return { status: "success", message: `Objekt ${data.unitNumber} skapades.` };
  } catch (e) {
    return errState(e);
  }
}

// ---------------------------------------------------------------------------
// Annonser
// ---------------------------------------------------------------------------

const listingSchema = z.object({
  unitId: z.string().min(1, "Välj objekt."),
  title: z.string().min(3, "Rubrik krävs."),
  description: z.string().min(10, "Beskrivning krävs."),
  category: z.string().min(1),
  rent: z.string().optional(),
  price: z.string().optional(),
  moveInDate: z.string().optional(),
  applicationDeadline: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  featured: z.string().optional(),
});

export async function createListingAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  try {
    const user = await requirePermission("listings", "create");
    const data = listingSchema.parse(Object.fromEntries(formData.entries()));
    const unit = await db.unit.findFirst({
      where: { id: data.unitId, organizationId: user.organizationId! },
    });
    if (!unit) return { status: "error", message: "Objektet hittades inte." };

    const baseSlug = slugify(`${data.title}-${unit.unitNumber}`);
    let slug = baseSlug;
    let i = 1;
    while (await db.listing.findFirst({ where: { organizationId: user.organizationId!, slug } })) {
      slug = `${baseSlug}-${++i}`;
    }

    const listing = await db.listing.create({
      data: {
        organizationId: user.organizationId!,
        unitId: unit.id,
        title: data.title,
        slug,
        description: data.description,
        category: data.category as ListingCategory,
        rent: data.rent ? parseFloat(data.rent.replace(",", ".")) : unit.rent,
        price: data.price ? parseFloat(data.price.replace(",", ".")) : unit.price,
        moveInDate: data.moveInDate ? new Date(data.moveInDate) : unit.availableFrom,
        applicationDeadline: data.applicationDeadline ? new Date(data.applicationDeadline) : null,
        contactName: data.contactName || null,
        contactEmail: data.contactEmail || null,
        contactPhone: data.contactPhone || null,
        featured: data.featured === "1",
        seoTitle: data.title,
        seoDescription: data.description.slice(0, 160),
      },
    });
    await audit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "create",
      entityType: "listing",
      entityId: listing.id,
      after: { title: data.title, slug },
    });
    revalidatePath("/admin/annonser");
    return { status: "success", message: `Annonsen skapades (utkast). Publicera den när den är klar.` };
  } catch (e) {
    return errState(e);
  }
}

export async function changeListingStatusAction(formData: FormData): Promise<void> {
  const user = await requirePermission("listings", "update");
  const listingId = String(formData.get("listingId"));
  const toStatus = String(formData.get("toStatus")) as ListingStatus;
  await changeListingStatus(user.organizationId!, listingId, toStatus, user.id);
  revalidatePath("/admin/annonser");
}

// ---------------------------------------------------------------------------
// Befintlig hyresgäst
// ---------------------------------------------------------------------------

const existingTenantSchema = z.object({
  firstName: z.string().min(1, "Förnamn krävs."),
  lastName: z.string().min(1, "Efternamn krävs."),
  email: z.string().email("Ogiltig e-post.").optional().or(z.literal("")),
  phone: z.string().optional(),
  personalNumber: z.string().optional(),
  unitId: z.string().min(1, "Välj objekt."),
  contractNumber: z.string().optional(),
  contractStartDate: z.string().min(1, "Startdatum krävs."),
  contractEndDate: z.string().optional(),
  rent: z.string().min(1, "Hyra krävs."),
  deposit: z.string().optional(),
  noticePeriodMonths: z.string().optional(),
  invoiceReference: z.string().optional(),
  externalSystem: z.string().optional(),
  externalCustomerId: z.string().optional(),
  externalContractId: z.string().optional(),
  sendInvitation: z.string().optional(),
});

export async function registerExistingTenantAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  try {
    const user = await requirePermission("contracts", "create");
    const data = existingTenantSchema.parse(Object.fromEntries(formData.entries()));
    const rent = parseFloat(data.rent.replace(",", "."));
    if (!isFinite(rent) || rent <= 0) return { status: "error", message: "Ogiltig hyra." };

    const result = await registerExistingTenant(
      user.organizationId!,
      {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email || undefined,
        phone: data.phone || undefined,
        personalNumber: data.personalNumber || undefined,
        unitId: data.unitId,
        contractNumber: data.contractNumber || undefined,
        contractStartDate: new Date(data.contractStartDate),
        contractEndDate: data.contractEndDate ? new Date(data.contractEndDate) : undefined,
        rent,
        deposit: data.deposit ? parseFloat(data.deposit.replace(",", ".")) : undefined,
        noticePeriodMonths: data.noticePeriodMonths ? parseInt(data.noticePeriodMonths, 10) : undefined,
        invoiceReference: data.invoiceReference || undefined,
        externalSystem: data.externalSystem || undefined,
        externalCustomerId: data.externalCustomerId || undefined,
        externalContractId: data.externalContractId || undefined,
      },
      user.id
    );

    let invitationInfo = "";
    if (data.sendInvitation === "1" && data.email) {
      try {
        const { activationUrl } = await createInvitation(user.organizationId!, result.person.id, user.id);
        invitationInfo = ` Inbjudan skickad – aktiveringslänk: ${activationUrl}`;
      } catch (e) {
        invitationInfo = ` (Inbjudan kunde inte skapas: ${e instanceof Error ? e.message : "fel"})`;
      }
    }

    revalidatePath("/admin/hyresgaster");
    return {
      status: "success",
      message: `Avtal ${result.contract.contractNumber} registrerat för ${result.person.firstName} ${result.person.lastName}${result.personCreated ? " (ny person)" : " (befintlig person matchades)"}.${invitationInfo}`,
    };
  } catch (e) {
    return errState(e);
  }
}

export async function sendInvitationAction(formData: FormData): Promise<void> {
  const user = await requirePermission("persons", "update");
  const personId = String(formData.get("personId"));
  await createInvitation(user.organizationId!, personId, user.id);
  revalidatePath("/admin/hyresgaster");
}

export async function previewImportAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  try {
    const user = await requirePermission("imports", "create");
    const csv = String(formData.get("csv") ?? "");
    if (!csv.trim()) return { status: "error", message: "Klistra in CSV-innehåll." };
    const { rows, errors } = parseTenantCsv(csv);
    if (errors.length) return { status: "error", message: errors.join(" ") };
    const results = await previewTenantImport(user.organizationId!, rows);
    return {
      status: "success",
      message: `Förhandsgranskning klar: ${results.length} rader.`,
      data: { results, csv },
    };
  } catch (e) {
    return errState(e);
  }
}

export async function runImportAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  try {
    const user = await requirePermission("imports", "create");
    const csv = String(formData.get("csv") ?? "");
    const { rows, errors } = parseTenantCsv(csv);
    if (errors.length) return { status: "error", message: errors.join(" ") };
    const { job, results } = await runTenantImport(user.organizationId!, rows, user.id, "import.csv");
    revalidatePath("/admin/hyresgaster");
    return {
      status: "success",
      message: `Import klar: ${job.successRows} skapade, ${job.skippedRows} överhoppade, ${job.errorRows} fel.`,
      data: { results },
    };
  } catch (e) {
    return errState(e);
  }
}

// ---------------------------------------------------------------------------
// Ansökningar & erbjudanden
// ---------------------------------------------------------------------------

export async function changeApplicationStatusAction(formData: FormData): Promise<void> {
  const user = await requirePermission("applications", "update");
  const applicationId = String(formData.get("applicationId"));
  const toStatus = String(formData.get("toStatus")) as ApplicationStatus;
  await changeApplicationStatus(user.organizationId!, applicationId, toStatus, {
    actorUserId: user.id,
  });
  revalidatePath("/admin/ansokningar");
}

export async function sendOfferAction(formData: FormData): Promise<void> {
  const user = await requirePermission("offers", "create");
  const applicationId = String(formData.get("applicationId"));
  await sendOffer(user.organizationId!, applicationId, { actorUserId: user.id });
  revalidatePath("/admin/ansokningar");
}

// ---------------------------------------------------------------------------
// Avtal
// ---------------------------------------------------------------------------

export async function changeContractStatusAction(formData: FormData): Promise<void> {
  const user = await requirePermission("contracts", "update");
  const contractId = String(formData.get("contractId"));
  const toStatus = String(formData.get("toStatus")) as ContractStatus;
  await changeContractStatus(user.organizationId!, contractId, toStatus, {
    actorUserId: user.id,
  });
  // Automatisk avpublicering när objektet blir uthyrt.
  if (toStatus === "ACTIVE") {
    const contract = await db.contract.findFirst({
      where: { id: contractId, organizationId: user.organizationId! },
    });
    if (contract) {
      await db.unit.update({ where: { id: contract.unitId }, data: { status: "RENTED" } });
      await unpublishListingsForUnit(user.organizationId!, contract.unitId, "Objektet uthyrt");
    }
  }
  revalidatePath("/admin/avtal");
}

// ---------------------------------------------------------------------------
// Felanmälan & arbetsorder
// ---------------------------------------------------------------------------

export async function changeMaintenanceStatusAction(formData: FormData): Promise<void> {
  const user = await requirePermission("maintenance", "update");
  const requestId = String(formData.get("requestId"));
  const toStatus = String(formData.get("toStatus")) as MaintenanceStatus;
  await changeMaintenanceStatus(user.organizationId!, requestId, toStatus, {
    actorUserId: user.id,
  });
  revalidatePath("/admin/felanmalan");
}

const workOrderSchema = z.object({
  requestId: z.string().optional(),
  supplierId: z.string().optional(),
  title: z.string().min(3, "Rubrik krävs."),
  description: z.string().min(3, "Beskrivning krävs."),
  priority: z.string().optional(),
  accessInfo: z.string().optional(),
  scheduledAt: z.string().optional(),
});

export async function createWorkOrderAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  try {
    const user = await requirePermission("workorders", "create");
    const data = workOrderSchema.parse(Object.fromEntries(formData.entries()));
    const workOrder = await createWorkOrder(
      user.organizationId!,
      {
        requestId: data.requestId || undefined,
        supplierId: data.supplierId || undefined,
        title: data.title,
        description: data.description,
        priority: (data.priority as "LOW" | "NORMAL" | "HIGH" | "URGENT") || undefined,
        accessInfo: data.accessInfo || undefined,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      },
      user.id
    );
    if (data.requestId) {
      const request = await db.maintenanceRequest.findFirst({
        where: { id: data.requestId, organizationId: user.organizationId! },
      });
      if (request && ["RECEIVED", "CONFIRMED", "ASSESSING"].includes(request.status)) {
        await changeMaintenanceStatus(user.organizationId!, data.requestId, "ASSIGNED", {
          actorUserId: user.id,
          comment: `Arbetsorder #${workOrder.orderNumber} skapad`,
        });
      }
    }
    revalidatePath("/admin/arbetsorder");
    revalidatePath("/admin/felanmalan");
    return { status: "success", message: `Arbetsorder #${workOrder.orderNumber} skapad.` };
  } catch (e) {
    return errState(e);
  }
}

export async function changeWorkOrderStatusAction(formData: FormData): Promise<void> {
  const user = await requirePermission("workorders", "update");
  const workOrderId = String(formData.get("workOrderId"));
  const toStatus = String(formData.get("toStatus")) as WorkOrderStatus;
  await changeWorkOrderStatus(user.organizationId!, workOrderId, toStatus, {
    actorUserId: user.id,
  });
  revalidatePath("/admin/arbetsorder");
}

const supplierSchema = z.object({
  name: z.string().min(1, "Namn krävs."),
  orgNumber: z.string().optional(),
  email: z.string().email("Ogiltig e-post.").optional().or(z.literal("")),
  phone: z.string().optional(),
  specialty: z.string().optional(),
  contractorEmail: z.string().email("Ogiltig e-post.").optional().or(z.literal("")),
  contractorPassword: z.string().optional(),
});

export async function createSupplierAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  try {
    const user = await requirePermission("suppliers", "create");
    const data = supplierSchema.parse(Object.fromEntries(formData.entries()));
    const supplier = await db.supplier.create({
      data: {
        organizationId: user.organizationId!,
        name: data.name,
        orgNumber: data.orgNumber || null,
        email: data.email || null,
        phone: data.phone || null,
        specialty: data.specialty || null,
      },
    });

    let extra = "";
    if (data.contractorEmail && data.contractorPassword) {
      if (data.contractorPassword.length < 10) {
        return { status: "error", message: "Entreprenörens lösenord måste vara minst 10 tecken." };
      }
      const contractorRole = await db.role.findFirst({
        where: { slug: "contractor", organizationId: null },
      });
      const authUser = await createManagedAuthUser({
        email: data.contractorEmail,
        password: data.contractorPassword,
      });
      let contractorUser;
      try {
        contractorUser = await db.user.create({
          data: {
            authUserId: authUser.id,
            organizationId: user.organizationId!,
            email: data.contractorEmail.toLowerCase(),
            supplierId: supplier.id,
            emailVerifiedAt: new Date(),
            isActive: true,
          },
        });
      } catch (error) {
        await deleteManagedAuthUser(authUser.id);
        throw error;
      }
      if (contractorRole) {
        await db.userRole.create({
          data: { userId: contractorUser.id, roleId: contractorRole.id },
        });
      }
      extra = ` Entreprenörskonto skapat: ${data.contractorEmail}.`;
    }

    await audit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "create",
      entityType: "supplier",
      entityId: supplier.id,
      after: { name: data.name },
    });
    revalidatePath("/admin/entreprenorer");
    return { status: "success", message: `Entreprenören ${data.name} skapades.${extra}` };
  } catch (e) {
    return errState(e);
  }
}

// ---------------------------------------------------------------------------
// Integrationer & synk
// ---------------------------------------------------------------------------

const connectionSchema = z.object({
  provider: z.string().min(1),
  name: z.string().min(1, "Namn krävs."),
  credentials: z.string().optional(),
  webhookSecret: z.string().optional(),
});

export async function createConnectionAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  try {
    const user = await requirePermission("integrations", "create");
    const data = connectionSchema.parse(Object.fromEntries(formData.entries()));
    if (data.credentials) {
      try {
        JSON.parse(data.credentials);
      } catch {
        return { status: "error", message: "Credentials måste vara giltig JSON." };
      }
    }
    const connection = await db.integrationConnection.create({
      data: {
        organizationId: user.organizationId!,
        provider: data.provider,
        name: data.name,
        credentialsEncrypted: data.credentials ? encryptSecret(data.credentials) : null,
        webhookSecret: data.webhookSecret || `whsec_${generateToken(24)}`,
      },
    });
    await audit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "create",
      entityType: "integration_connection",
      entityId: connection.id,
      after: { provider: data.provider, name: data.name },
    });
    revalidatePath("/admin/integrationer");
    return {
      status: "success",
      message: `Integrationen skapades. Webhook-hemlighet: ${connection.webhookSecret}`,
    };
  } catch (e) {
    return errState(e);
  }
}

export async function runSyncAction(formData: FormData): Promise<void> {
  const user = await requirePermission("integrations", "update");
  const connectionId = String(formData.get("connectionId"));
  const jobType = String(formData.get("jobType")) as "customers" | "invoices" | "payments" | "full";
  await runSyncJob(user.organizationId!, connectionId, jobType, user.id);
  revalidatePath("/admin/integrationer");
}

export async function resolveReviewItemAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  try {
    const user = await requirePermission("integrations", "update");
    const reviewItemId = String(formData.get("reviewItemId"));
    const reject = formData.get("reject") === "1";
    const personId = String(formData.get("personId") ?? "");
    await resolveReviewItem(user.organizationId!, reviewItemId, {
      personId: personId || undefined,
      actorUserId: user.id,
      reject,
      note: String(formData.get("note") ?? "") || undefined,
    });
    revalidatePath("/admin/integrationer");
    return { status: "success", message: reject ? "Posten avvisades." : "Posten matchades och kördes om." };
  } catch (e) {
    return errState(e);
  }
}

// ---------------------------------------------------------------------------
// Webhooks & API-nycklar
// ---------------------------------------------------------------------------

export async function redeliverWebhookAction(formData: FormData): Promise<void> {
  const user = await requirePermission("webhooks", "update");
  const deliveryId = String(formData.get("deliveryId"));
  // Ägarkontroll sker i redeliver via organizationId på leveransen.
  const delivery = await db.webhookDelivery.findFirst({
    where: { id: deliveryId, organizationId: user.organizationId! },
  });
  if (delivery) await redeliver(deliveryId, user.id);
  revalidatePath("/admin/webhooks");
}

export async function toggleSubscriptionAction(formData: FormData): Promise<void> {
  const user = await requirePermission("webhooks", "update");
  const subscriptionId = String(formData.get("subscriptionId"));
  const sub = await db.webhookSubscription.findFirst({
    where: { id: subscriptionId, organizationId: user.organizationId! },
  });
  if (sub) {
    await db.webhookSubscription.update({
      where: { id: sub.id },
      data: {
        isActive: !sub.isActive,
        disabledAt: sub.isActive ? new Date() : null,
        disabledReason: sub.isActive ? "Avstängd manuellt" : null,
        consecutiveFailures: 0,
      },
    });
  }
  revalidatePath("/admin/webhooks");
}

const apiKeySchema = z.object({
  name: z.string().min(1, "Namn krävs."),
  scopes: z.string().min(1, "Ange minst en behörighet."),
  allowedIps: z.string().optional(),
});

export async function createApiKeyAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  try {
    const user = await requirePermission("apikeys", "create");
    const data = apiKeySchema.parse(Object.fromEntries(formData.entries()));
    const { key, prefix, hash } = generateApiKey();
    const apiKey = await db.apiKey.create({
      data: {
        organizationId: user.organizationId!,
        name: data.name,
        keyPrefix: prefix,
        keyHash: hash,
        scopes: data.scopes.split(",").map((s) => s.trim()).filter(Boolean),
        allowedIps: data.allowedIps
          ? data.allowedIps.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
      },
    });
    await audit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "create",
      entityType: "api_key",
      entityId: apiKey.id,
      after: { name: data.name, scopes: apiKey.scopes },
    });
    revalidatePath("/admin/api-nycklar");
    return {
      status: "success",
      message: "API-nyckeln skapades. Kopiera den nu – den visas bara en gång:",
      data: { key },
    };
  } catch (e) {
    return errState(e);
  }
}

export async function revokeApiKeyAction(formData: FormData): Promise<void> {
  const user = await requirePermission("apikeys", "delete");
  const apiKeyId = String(formData.get("apiKeyId"));
  const key = await db.apiKey.findFirst({
    where: { id: apiKeyId, organizationId: user.organizationId! },
  });
  if (key) {
    await db.apiKey.update({
      where: { id: key.id },
      data: { isActive: false, revokedAt: new Date() },
    });
    await audit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "api_key_revoked",
      entityType: "api_key",
      entityId: key.id,
    });
  }
  revalidatePath("/admin/api-nycklar");
}

// ---------------------------------------------------------------------------
// Användare & roller
// ---------------------------------------------------------------------------

const staffUserSchema = z.object({
  email: z.string().email("Ogiltig e-post."),
  firstName: z.string().min(1, "Förnamn krävs."),
  lastName: z.string().min(1, "Efternamn krävs."),
  password: z.string().min(10, "Minst 10 tecken."),
  roleId: z.string().min(1, "Välj roll."),
});

export async function createStaffUserAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  try {
    const user = await requirePermission("users", "create");
    const data = staffUserSchema.parse(Object.fromEntries(formData.entries()));
    const email = data.email.toLowerCase();
    const exists = await db.user.findUnique({ where: { email } });
    if (exists) return { status: "error", message: "E-postadressen används redan." };

    const role = await db.role.findFirst({
      where: { id: data.roleId, OR: [{ organizationId: user.organizationId! }, { organizationId: null }] },
    });
    if (!role) return { status: "error", message: "Rollen hittades inte." };

    await db.$transaction(async (tx) => {
      const person = await tx.person.create({
        data: {
          organizationId: user.organizationId!,
          firstName: data.firstName,
          lastName: data.lastName,
          email,
        },
      });
      const authUser = await createManagedAuthUser({
        email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
      });
      let created;
      try {
        created = await tx.user.create({
          data: {
            authUserId: authUser.id,
            organizationId: user.organizationId!,
            personId: person.id,
            email,
            emailVerifiedAt: new Date(),
            isActive: true,
          },
        });
      } catch (error) {
        await deleteManagedAuthUser(authUser.id);
        throw error;
      }
      await tx.userRole.create({ data: { userId: created.id, roleId: role.id } });
      await audit(
        {
          organizationId: user.organizationId,
          userId: user.id,
          action: "create",
          entityType: "user",
          entityId: created.id,
          after: { email, role: role.slug },
        },
        tx
      );
    });
    revalidatePath("/admin/anvandare");
    return { status: "success", message: `Användaren ${email} skapades med rollen ${role.name}.` };
  } catch (e) {
    return errState(e);
  }
}

const roleSchema = z.object({
  name: z.string().min(1, "Namn krävs."),
  permissions: z.string().min(1, "Ange minst en behörighet."),
});

export async function createRoleAction(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  try {
    const user = await requirePermission("roles", "create");
    const data = roleSchema.parse(Object.fromEntries(formData.entries()));
    const slug = slugify(data.name);
    const exists = await db.role.findFirst({
      where: { organizationId: user.organizationId!, slug },
    });
    if (exists) return { status: "error", message: "En roll med detta namn finns redan." };
    const role = await db.role.create({
      data: {
        organizationId: user.organizationId!,
        name: data.name,
        slug,
        permissions: {
          create: data.permissions
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean)
            .map((permission) => ({ permission })),
        },
      },
    });
    await audit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "create",
      entityType: "role",
      entityId: role.id,
      after: { name: data.name },
    });
    revalidatePath("/admin/anvandare");
    return { status: "success", message: `Rollen ${data.name} skapades.` };
  } catch (e) {
    return errState(e);
  }
}

export async function processWebhookQueueAction(): Promise<void> {
  await requirePermission("webhooks", "update");
  const { processPendingDeliveries } = await import("@/lib/services/webhooks");
  await processPendingDeliveries();
  revalidatePath("/admin/webhooks");
}
