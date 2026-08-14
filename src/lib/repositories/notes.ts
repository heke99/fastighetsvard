import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Action, Resource } from "@/lib/permissions";

/** Domänobjekt som kan förses med interna anteckningar. */
export const NOTE_ENTITY_TYPES = [
  "PROPERTY",
  "UNIT",
  "LISTING",
  "PERSON",
  "APPLICATION",
  "CONTRACT",
  "MAINTENANCE_REQUEST",
  "WORK_ORDER",
] as const;

export type NoteEntityType = (typeof NOTE_ENTITY_TYPES)[number];

/**
 * Anteckningar ärver behörighet från objektet de sitter på. Den som får läsa
 * respektive uppdatera objektet får läsa respektive skriva dess anteckningar.
 * Samma avbildning finns i `public.note_entity_permission` i databasen.
 */
const NOTE_RESOURCE: Record<NoteEntityType, Resource> = {
  PROPERTY: "properties",
  UNIT: "units",
  LISTING: "listings",
  PERSON: "persons",
  APPLICATION: "applications",
  CONTRACT: "contracts",
  MAINTENANCE_REQUEST: "maintenance",
  WORK_ORDER: "workorders",
};

export function noteResource(entityType: NoteEntityType): Resource {
  return NOTE_RESOURCE[entityType];
}

export function isNoteEntityType(value: string): value is NoteEntityType {
  return (NOTE_ENTITY_TYPES as readonly string[]).includes(value);
}

/** Behörighet som krävs för att skriva eller ta bort en anteckning. */
export const NOTE_WRITE_ACTION: Action = "update";

export interface NoteRecord {
  id: string;
  entityType: NoteEntityType;
  entityId: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string } | null;
}

interface NoteRow {
  id: string;
  entityType: NoteEntityType;
  entityId: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  updatedAt: string;
  authorUserId: string | null;
}

async function hydrateAuthors(rows: NoteRow[]): Promise<NoteRecord[]> {
  const authorIds = [...new Set(rows.map((row) => row.authorUserId).filter((id): id is string => Boolean(id)))];
  const names = new Map<string, string>();

  if (authorIds.length > 0) {
    const { data, error } = await createAdminClient()
      .from("User")
      .select("id,firstName,lastName,email")
      .in("id", authorIds);
    if (error) throw new Error(`Anteckningarnas författare kunde inte läsas (${error.code}).`);
    for (const user of data ?? []) {
      const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
      names.set(user.id, name || user.email);
    }
  }

  return rows.map((row) => ({
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    body: row.body,
    isInternal: row.isInternal,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    author: row.authorUserId
      ? { id: row.authorUserId, name: names.get(row.authorUserId) ?? "Okänd användare" }
      : null,
  }));
}

/** Anteckningar för ett enskilt objekt, nyaste först. */
export async function listNotes(input: {
  organizationId: string;
  entityType: NoteEntityType;
  entityId: string;
  limit?: number;
}): Promise<NoteRecord[]> {
  const { data, error } = await createAdminClient()
    .from("Note")
    .select("id,entityType,entityId,body,isInternal,createdAt,updatedAt,authorUserId")
    .eq("organizationId", input.organizationId)
    .eq("entityType", input.entityType)
    .eq("entityId", input.entityId)
    .is("deletedAt", null)
    .order("createdAt", { ascending: false })
    .limit(input.limit ?? 50);
  if (error) throw new Error(`Anteckningarna kunde inte läsas (${error.code}).`);
  return hydrateAuthors((data ?? []) as NoteRow[]);
}

/** Anteckningar för flera objekt av samma typ, grupperade per objekt. */
export async function listNotesForEntities(input: {
  organizationId: string;
  entityType: NoteEntityType;
  entityIds: string[];
}): Promise<Map<string, NoteRecord[]>> {
  const grouped = new Map<string, NoteRecord[]>();
  if (input.entityIds.length === 0) return grouped;

  const { data, error } = await createAdminClient()
    .from("Note")
    .select("id,entityType,entityId,body,isInternal,createdAt,updatedAt,authorUserId")
    .eq("organizationId", input.organizationId)
    .eq("entityType", input.entityType)
    .in("entityId", input.entityIds)
    .is("deletedAt", null)
    .order("createdAt", { ascending: false })
    .limit(1000);
  if (error) throw new Error(`Anteckningarna kunde inte läsas (${error.code}).`);

  for (const note of await hydrateAuthors((data ?? []) as NoteRow[])) {
    const bucket = grouped.get(note.entityId);
    if (bucket) bucket.push(note);
    else grouped.set(note.entityId, [note]);
  }
  return grouped;
}

const ENTITY_TABLE: Record<NoteEntityType, string> = {
  PROPERTY: "Property",
  UNIT: "Unit",
  LISTING: "Listing",
  PERSON: "Person",
  APPLICATION: "Application",
  CONTRACT: "Contract",
  MAINTENANCE_REQUEST: "MaintenanceRequest",
  WORK_ORDER: "WorkOrder",
};

/**
 * Verifierar att objektet finns i samma organisation. Utan kontrollen skulle en
 * behörig användare kunna skriva anteckningar mot främmande UUID:n.
 */
export async function assertNoteTargetExists(input: {
  organizationId: string;
  entityType: NoteEntityType;
  entityId: string;
}): Promise<void> {
  const { data, error } = await createAdminClient()
    .from(ENTITY_TABLE[input.entityType])
    .select("id")
    .eq("id", input.entityId)
    .eq("organizationId", input.organizationId)
    .maybeSingle();
  if (error) throw new Error(`Objektet kunde inte verifieras (${error.code}).`);
  if (!data) throw new Error("Objektet finns inte i din organisation.");
}

/**
 * Läser en anteckning för behörighetskontroll. Behörigheten måste avgöras av
 * anteckningens egen entitetstyp, aldrig av en typ som skickas in i formuläret.
 */
export async function getNoteEntity(input: {
  organizationId: string;
  noteId: string;
}): Promise<{ entityType: NoteEntityType; entityId: string } | null> {
  const { data, error } = await createAdminClient()
    .from("Note")
    .select("entityType,entityId")
    .eq("id", input.noteId)
    .eq("organizationId", input.organizationId)
    .is("deletedAt", null)
    .maybeSingle();
  if (error) throw new Error(`Anteckningen kunde inte läsas (${error.code}).`);
  return data ? { entityType: data.entityType as NoteEntityType, entityId: data.entityId } : null;
}

export async function createNote(input: {
  organizationId: string;
  entityType: NoteEntityType;
  entityId: string;
  body: string;
  authorUserId: string;
  isInternal?: boolean;
}): Promise<{ id: string }> {
  const { data, error } = await createAdminClient()
    .from("Note")
    .insert({
      organizationId: input.organizationId,
      entityType: input.entityType,
      entityId: input.entityId,
      body: input.body,
      isInternal: input.isInternal ?? true,
      authorUserId: input.authorUserId,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Anteckningen kunde inte sparas (${error.code}).`);
  return { id: data.id };
}

/**
 * Anteckningar tas bort mjukt. Historiken bakom ett beslut ska gå att följa i
 * revisionsloggen även efter att texten dolts i gränssnittet.
 */
export async function softDeleteNote(input: {
  organizationId: string;
  noteId: string;
}): Promise<{ entityType: NoteEntityType; entityId: string } | null> {
  const { data, error } = await createAdminClient()
    .from("Note")
    .update({ deletedAt: new Date().toISOString() })
    .eq("id", input.noteId)
    .eq("organizationId", input.organizationId)
    .is("deletedAt", null)
    .select("entityType,entityId")
    .maybeSingle();
  if (error) throw new Error(`Anteckningen kunde inte tas bort (${error.code}).`);
  return data ? { entityType: data.entityType as NoteEntityType, entityId: data.entityId } : null;
}
