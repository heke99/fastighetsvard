import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { nextNumber } from "@/lib/counters";
import { generateToken, sha256 } from "@/lib/crypto";
import type { Database, Person } from "@/lib/database-types";
import { sendInvitationEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/app-url";

/**
 * Hantering av befintliga hyresgäster som registreras i efterhand.
 * En person är EN person – vid registrering matchas alltid mot befintliga
 * personer (e-post, personnummer) innan en ny skapas.
 */

export interface ExistingTenantInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  personalNumber?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  unitId: string;
  contractNumber?: string;
  contractStartDate: Date;
  contractEndDate?: Date;
  rent: number;
  deposit?: number;
  noticePeriodMonths?: number;
  invoiceReference?: string;
  externalSystem?: string;
  externalCustomerId?: string;
  externalContractId?: string;
}

export interface PersonMatch {
  person: Person;
  matchedBy: "email" | "personalNumber";
}

/** Dubblettkontroll: hitta befintlig person via e-post eller personnummer. */
export async function findExistingPerson(
  organizationId: string,
  input: { email?: string | null; personalNumber?: string | null },
  tx?: Database.TransactionClient
): Promise<PersonMatch | null> {
  const client = tx ?? db;
  if (input.email) {
    const byEmail = await client.person.findFirst({
      where: { organizationId, email: input.email.toLowerCase().trim() },
    });
    if (byEmail) return { person: byEmail, matchedBy: "email" };
  }
  if (input.personalNumber) {
    const normalized = input.personalNumber.replace(/[^0-9]/g, "");
    if (normalized.length >= 10) {
      const byPnr = await client.person.findFirst({
        where: { organizationId, personalNumber: normalized },
      });
      if (byPnr) return { person: byPnr, matchedBy: "personalNumber" };
    }
  }
  return null;
}

export async function findOrCreatePerson(
  tx: Database.TransactionClient,
  organizationId: string,
  input: {
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    personalNumber?: string | null;
    address?: string | null;
    postalCode?: string | null;
    city?: string | null;
  }
): Promise<{ person: Person; created: boolean }> {
  const match = await findExistingPerson(organizationId, input, tx);
  if (match) {
    // Komplettera saknade fält – skriv aldrig över befintliga uppgifter tyst.
    const updates: Database.PersonUpdateInput = {};
    if (!match.person.phone && input.phone) updates.phone = input.phone;
    if (!match.person.address && input.address) updates.address = input.address;
    if (!match.person.personalNumber && input.personalNumber) {
      updates.personalNumber = input.personalNumber.replace(/[^0-9]/g, "");
    }
    const person = Object.keys(updates).length
      ? await tx.person.update({ where: { id: match.person.id }, data: updates })
      : match.person;
    return { person, created: false };
  }
  const person = await tx.person.create({
    data: {
      organizationId,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email?.toLowerCase().trim() || null,
      phone: input.phone || null,
      personalNumber: input.personalNumber?.replace(/[^0-9]/g, "") || null,
      address: input.address || null,
      postalCode: input.postalCode || null,
      city: input.city || null,
    },
  });
  return { person, created: true };
}

export async function ensurePersonRole(
  tx: Database.TransactionClient,
  personId: string,
  role: "TENANT" | "APPLICANT" | "CO_APPLICANT" | "GUARANTOR" | "BUYER" | "CONTACT" | "HOUSEHOLD_MEMBER"
) {
  await tx.personRole.upsert({
    where: { personId_role: { personId, role } },
    create: { personId, role },
    update: {},
  });
}

/**
 * Registrera befintlig hyresgäst med redan aktivt avtal (efterhandsregistrering).
 * Skapar/matchar person, skapar aktivt avtal, markerar objektet som uthyrt och
 * mappar externa referenser. Allt i en transaktion.
 */
export async function registerExistingTenant(
  organizationId: string,
  input: ExistingTenantInput,
  actorUserId?: string
) {
  return db.$transaction(async (tx) => {
    const unit = await tx.unit.findFirst({
      where: { id: input.unitId, organizationId },
    });
    if (!unit) throw new Error("Objektet hittades inte.");

    const activeContract = await tx.contract.findFirst({
      where: {
        unitId: unit.id,
        status: { in: ["ACTIVE", "SIGNED", "SENT_FOR_SIGNING", "PARTIALLY_SIGNED"] },
      },
    });
    if (activeContract) {
      throw new Error(
        `Objektet har redan ett aktivt avtal (${activeContract.contractNumber}).`
      );
    }

    const { person, created } = await findOrCreatePerson(tx, organizationId, input);
    await ensurePersonRole(tx, person.id, "TENANT");

    const contractNumber =
      input.contractNumber?.trim() ||
      `HK-${new Date().getFullYear()}-${await nextNumber(tx, organizationId, "contract")}`;

    const existingNumber = await tx.contract.findFirst({
      where: { organizationId, contractNumber },
    });
    if (existingNumber) {
      throw new Error(`Avtalsnummer ${contractNumber} finns redan.`);
    }

    const contract = await tx.contract.create({
      data: {
        organizationId,
        unitId: unit.id,
        contractNumber,
        type: unit.type === "PARKING" ? "PARKING" : unit.type === "STORAGE" ? "STORAGE" : "RESIDENTIAL",
        status: "ACTIVE",
        startDate: input.contractStartDate,
        endDate: input.contractEndDate ?? null,
        noticePeriodMonths: input.noticePeriodMonths ?? 3,
        rent: input.rent,
        deposit: input.deposit ?? null,
        invoiceReference: input.invoiceReference ?? null,
        isImported: true,
        activatedAt: input.contractStartDate,
        parties: {
          create: [{ personId: person.id, role: "TENANT", signedAt: input.contractStartDate, signatureMethod: "manual" }],
        },
        versions: {
          create: [{
            versionNumber: 1,
            content: {
              rent: input.rent,
              startDate: input.contractStartDate.toISOString(),
              imported: true,
            },
            createdByUserId: actorUserId ?? null,
          }],
        },
        statusHistory: {
          create: [{ toStatus: "ACTIVE", comment: "Importerat befintligt avtal", changedByUserId: actorUserId ?? null }],
        },
      },
    });

    await tx.unit.update({ where: { id: unit.id }, data: { status: "RENTED" } });

    // Externa referenser (bokföringssystem) – unika per (system, typ, externt id).
    if (input.externalSystem && input.externalCustomerId) {
      await tx.externalReference.upsert({
        where: {
          organizationId_externalSystem_entityType_externalId: {
            organizationId,
            externalSystem: input.externalSystem,
            entityType: "customer",
            externalId: input.externalCustomerId,
          },
        },
        create: {
          organizationId,
          externalSystem: input.externalSystem,
          entityType: "customer",
          externalId: input.externalCustomerId,
          personId: person.id,
        },
        update: { personId: person.id },
      });
    }
    if (input.externalSystem && input.externalContractId) {
      await tx.externalReference.upsert({
        where: {
          organizationId_externalSystem_entityType_externalId: {
            organizationId,
            externalSystem: input.externalSystem,
            entityType: "contract",
            externalId: input.externalContractId,
          },
        },
        create: {
          organizationId,
          externalSystem: input.externalSystem,
          entityType: "contract",
          externalId: input.externalContractId,
          contractId: contract.id,
        },
        update: { contractId: contract.id },
      });
    }

    await audit(
      {
        organizationId,
        userId: actorUserId,
        action: "register_existing_tenant",
        entityType: "contract",
        entityId: contract.id,
        after: { personId: person.id, personCreated: created, unitId: unit.id, contractNumber },
      },
      tx
    );

    return { person, contract, personCreated: created };
  });
}

/** Skapa inbjudan till Mina sidor för en person (befintlig hyresgäst). */
export async function createInvitation(
  organizationId: string,
  personId: string,
  actorUserId?: string
) {
  const person = await db.person.findFirst({
    where: { id: personId, organizationId },
    include: { user: true },
  });
  if (!person) throw new Error("Personen hittades inte.");
  if (!person.email) throw new Error("Personen saknar e-postadress.");
  if (person.user) throw new Error("Personen har redan ett konto.");

  const token = generateToken(32);
  const invitation = await db.invitation.create({
    data: {
      organizationId,
      personId,
      email: person.email,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14), // 14 dagar
    },
  });
  await audit({
    organizationId,
    userId: actorUserId,
    action: "invitation_created",
    entityType: "invitation",
    entityId: invitation.id,
    after: { personId, email: person.email },
  });
  const url = `${getAppUrl()}/aktivera/${token}`;
  await sendInvitationEmail(person.email, url);
  return { invitation, activationUrl: url };
}

export interface TenantImportRow {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  personalNumber?: string;
  unitNumber: string;
  contractNumber?: string;
  contractStartDate: string;
  rent: string;
  externalCustomerId?: string;
  externalSystem?: string;
}

export interface ImportRowResult {
  row: number;
  status: "created" | "skipped" | "error";
  message: string;
  contractId?: string;
  personId?: string;
}

/** Tolka CSV-innehåll (kommaseparerat eller semikolon) med rubrikrad. */
export function parseTenantCsv(content: string): { rows: TenantImportRow[]; errors: string[] } {
  const errors: string[] = [];
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { rows: [], errors: ["Filen saknar datarader."] };
  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(delimiter).map((h) => h.trim());
  const required = ["firstName", "lastName", "unitNumber", "contractStartDate", "rent"];
  for (const r of required) {
    if (!headers.includes(r)) errors.push(`Kolumn saknas: ${r}`);
  }
  if (errors.length) return { rows: [], errors };

  const rows: TenantImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map((v) => v.trim());
    const row = Object.fromEntries(headers.map((h, idx) => [h, values[idx] ?? ""]));
    rows.push(row as unknown as TenantImportRow);
  }
  return { rows, errors };
}

/** Validera importrader utan att skriva något (förhandsgranskning). */
export async function previewTenantImport(
  organizationId: string,
  rows: TenantImportRow[]
): Promise<ImportRowResult[]> {
  const results: ImportRowResult[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNo = i + 1;
    if (!row.firstName || !row.lastName) {
      results.push({ row: rowNo, status: "error", message: "Namn saknas." });
      continue;
    }
    const rent = parseFloat(String(row.rent).replace(",", "."));
    if (!isFinite(rent) || rent <= 0) {
      results.push({ row: rowNo, status: "error", message: "Ogiltig hyra." });
      continue;
    }
    const startDate = new Date(row.contractStartDate);
    if (isNaN(startDate.getTime())) {
      results.push({ row: rowNo, status: "error", message: "Ogiltigt startdatum." });
      continue;
    }
    const unit = await db.unit.findFirst({
      where: { organizationId, unitNumber: row.unitNumber },
    });
    if (!unit) {
      results.push({ row: rowNo, status: "error", message: `Objekt ${row.unitNumber} finns inte.` });
      continue;
    }
    const active = await db.contract.findFirst({
      where: { unitId: unit.id, status: { in: ["ACTIVE", "SIGNED"] } },
    });
    if (active) {
      results.push({ row: rowNo, status: "skipped", message: `Objekt ${row.unitNumber} har redan aktivt avtal.` });
      continue;
    }
    const match = await findExistingPerson(organizationId, row);
    results.push({
      row: rowNo,
      status: "created",
      message: match
        ? `OK – matchar befintlig person ${match.person.firstName} ${match.person.lastName} (${match.matchedBy}).`
        : "OK – ny person skapas.",
    });
  }
  return results;
}

/** Kör importen på riktigt. Varje rad i egen transaktion så att en felrad inte fäller övriga. */
export async function runTenantImport(
  organizationId: string,
  rows: TenantImportRow[],
  actorUserId?: string,
  fileName?: string
) {
  const job = await db.importJob.create({
    data: {
      organizationId,
      importType: "tenants",
      fileName: fileName ?? null,
      status: "RUNNING",
      totalRows: rows.length,
      createdByUserId: actorUserId ?? null,
      startedAt: new Date(),
    },
  });

  const results: ImportRowResult[] = [];
  let success = 0, errors = 0, skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNo = i + 1;
    try {
      const unit = await db.unit.findFirst({
        where: { organizationId, unitNumber: row.unitNumber },
      });
      if (!unit) {
        results.push({ row: rowNo, status: "error", message: `Objekt ${row.unitNumber} finns inte.` });
        errors++;
        continue;
      }
      const rent = parseFloat(String(row.rent).replace(",", "."));
      const startDate = new Date(row.contractStartDate);
      if (!isFinite(rent) || rent <= 0 || isNaN(startDate.getTime())) {
        results.push({ row: rowNo, status: "error", message: "Ogiltig hyra eller datum." });
        errors++;
        continue;
      }
      const active = await db.contract.findFirst({
        where: { unitId: unit.id, status: { in: ["ACTIVE", "SIGNED"] } },
      });
      if (active) {
        results.push({ row: rowNo, status: "skipped", message: "Objektet har redan aktivt avtal." });
        skipped++;
        continue;
      }
      const { person, contract } = await registerExistingTenant(
        organizationId,
        {
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email || undefined,
          phone: row.phone || undefined,
          personalNumber: row.personalNumber || undefined,
          unitId: unit.id,
          contractNumber: row.contractNumber || undefined,
          contractStartDate: startDate,
          rent,
          externalSystem: row.externalSystem || undefined,
          externalCustomerId: row.externalCustomerId || undefined,
        },
        actorUserId
      );
      results.push({
        row: rowNo,
        status: "created",
        message: `Avtal ${contract.contractNumber} skapat.`,
        contractId: contract.id,
        personId: person.id,
      });
      success++;
    } catch (e) {
      results.push({ row: rowNo, status: "error", message: e instanceof Error ? e.message : "Okänt fel." });
      errors++;
    }
  }

  const updated = await db.importJob.update({
    where: { id: job.id },
    data: {
      status: errors > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
      successRows: success,
      errorRows: errors,
      skippedRows: skipped,
      rowResults: results as unknown as Database.InputJsonValue,
      finishedAt: new Date(),
    },
  });

  await audit({
    organizationId,
    userId: actorUserId,
    action: "tenant_import",
    entityType: "import_job",
    entityId: job.id,
    after: { total: rows.length, success, errors, skipped },
  });

  return { job: updated, results };
}
