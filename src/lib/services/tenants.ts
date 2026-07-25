import { audit } from "@/lib/audit";
import { generateToken, sha256 } from "@/lib/crypto";
import type { Person } from "@/lib/database-types";
import { sendInvitationEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/app-url";
import { registerExistingTenantCommand } from "@/lib/repositories/tenant-operations";
import {
  createImportJobRecord,
  createInvitationRecord,
  findTenantPerson,
  finishImportJobRecord,
  getImportUnitState,
} from "@/lib/repositories/tenant-import-records";

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
  input: { email?: string | null; personalNumber?: string | null }
): Promise<PersonMatch | null> {
  return (await findTenantPerson(organizationId, input)) as PersonMatch | null;
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
  return registerExistingTenantCommand({
    organizationId,
    ...input,
    actorUserId,
  });
}

/** Skapa inbjudan till Mina sidor för en person (befintlig hyresgäst). */
export async function createInvitation(
  organizationId: string,
  personId: string,
  actorUserId?: string
) {
  const token = generateToken(32);
  const invitation = await createInvitationRecord({
    organizationId,
    personId,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
    actorUserId,
  });
  const url = `${getAppUrl()}/aktivera/${token}`;
  await sendInvitationEmail(invitation.email, url);
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
    const { unit, hasActiveContract } = await getImportUnitState(organizationId, row.unitNumber);
    if (!unit) {
      results.push({ row: rowNo, status: "error", message: `Objekt ${row.unitNumber} finns inte.` });
      continue;
    }
    if (hasActiveContract) {
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
  const job = await createImportJobRecord({
    organizationId,
    totalRows: rows.length,
    actorUserId,
    fileName,
  });

  const results: ImportRowResult[] = [];
  let success = 0, errors = 0, skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNo = i + 1;
    try {
      const { unit, hasActiveContract } = await getImportUnitState(organizationId, row.unitNumber);
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
      if (hasActiveContract) {
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

  const updated = await finishImportJobRecord(organizationId, job.id, {
    status: errors > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
    successRows: success,
    errorRows: errors,
    skippedRows: skipped,
    rowResults: results,
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
