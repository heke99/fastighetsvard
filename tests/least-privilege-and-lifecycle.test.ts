import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { detectImageMimeType } from "@/lib/repositories/listing-media";
import { describeBlockers } from "@/lib/repositories/deletion-operations";
import {
  NOTE_ENTITY_TYPES,
  isNoteEntityType,
  noteResource,
} from "@/lib/repositories/notes";
import { hasPermission } from "@/lib/permissions";

const read = (path: string) => readFileSync(resolve(path), "utf8");
const allMigrations = readdirSync(resolve("supabase/migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => read(`supabase/migrations/${name}`))
  .join("\n");

describe("least privilege for the PostgREST roles", () => {
  const sql = read("supabase/migrations/20260814083350_least_privilege_grants.sql");

  it("revokes execute from anon and authenticated on every public function", () => {
    expect(sql).toContain("REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated");
    expect(sql).toContain("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon");
  });

  it("never re-grants execute to anon", () => {
    expect(sql).not.toMatch(/GRANT EXECUTE ON FUNCTION[^;]*TO[^;]*\banon\b/);
  });

  it("keeps administrative commands off the authenticated allow list", () => {
    const allowList = sql.slice(sql.indexOf("allowed constant text[]"), sql.indexOf("BEGIN\n  FOR fn IN\n    SELECT p.oid::regprocedure AS signature\n    FROM pg_proc p\n    JOIN pg_namespace n ON n.oid = p.pronamespace\n    WHERE n.nspname = 'public'\n      AND p.prokind = 'f'\n      AND p.proname = ANY (allowed)"));
    for (const forbidden of [
      "provision_staff_user",
      "create_custom_role",
      "bootstrap_faddebo_owner",
      "register_existing_tenant",
      "write_audit_event",
      "enqueue_outbox_event",
      "claim_outbox_jobs",
      "consume_rate_limit",
      "claim_invitation",
    ]) {
      expect(allowList).not.toContain(`'${forbidden}'`);
    }
  });

  it("stops the default privileges that caused the leak", () => {
    expect(sql).toContain("ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated");
    expect(sql).toContain("ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon");
  });

  it("pins the search path of the shared trigger function", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.set_updated_at()");
    expect(sql).toContain("SET search_path TO 'public', 'pg_temp'");
  });
});

describe("deletion guards", () => {
  const sql = read("supabase/migrations/20260814095000_deletion_guards.sql");

  it("prevents contracts that left DRAFT from being deleted, cascade included", () => {
    expect(sql).toContain("BEFORE DELETE ON public.\"Contract\"");
    expect(sql).toContain("contract_delete_forbidden");
    expect(sql).toContain("OLD.\"status\" <> 'DRAFT'");
  });

  it("prevents deleting a unit that carries contract history", () => {
    expect(sql).toContain("BEFORE DELETE ON public.\"Unit\"");
    expect(sql).toContain("unit_delete_forbidden_contract_history");
  });

  it("describes blockers in plain Swedish for the confirmation dialog", () => {
    expect(describeBlockers([{ label: "avtal", count: 2 }, { label: "annonser", count: 1 }]))
      .toBe("2 avtal, annonser");
    expect(describeBlockers([])).toBe("");
  });
});

describe("internal notes", () => {
  it("keeps the SQL and TypeScript entity mapping in sync", () => {
    const sql = read("supabase/migrations/20260814094000_notes_and_media_lifecycle.sql");
    for (const entity of NOTE_ENTITY_TYPES) {
      expect(sql).toContain(`'${entity}'`);
    }
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public."Note"');
    expect(sql).toContain("note_entity_permission");
  });

  it("only creates a staff read policy, so tenants can never read notes", () => {
    const sql = read("supabase/migrations/20260814094000_notes_and_media_lifecycle.sql");
    expect(sql).toContain('CREATE POLICY "note_staff_read"');
    expect(sql).not.toMatch(/CREATE POLICY[^;]*"Note"[^;]*TO anon/);
    expect(sql).not.toContain('GRANT INSERT ON public."Note"');
    expect(sql).not.toContain('GRANT UPDATE ON public."Note"');
    expect(sql).not.toContain('GRANT DELETE ON public."Note"');
  });

  it("maps every note entity to the permission of the annotated object", () => {
    for (const entity of NOTE_ENTITY_TYPES) {
      expect(typeof noteResource(entity)).toBe("string");
    }
    expect(noteResource("MAINTENANCE_REQUEST")).toBe("maintenance");
    expect(noteResource("PERSON")).toBe("persons");
    expect(isNoteEntityType("PROPERTY")).toBe(true);
    expect(isNoteEntityType("ORGANIZATION")).toBe(false);
  });

  it("denies note writes to a tenant-like permission set", () => {
    const tenantPermissions: string[] = [];
    for (const entity of NOTE_ENTITY_TYPES) {
      expect(hasPermission(tenantPermissions, noteResource(entity), "update")).toBe(false);
    }
  });
});

describe("image upload validation", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const webp = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  ]);
  const avif = new Uint8Array([
    0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66,
  ]);

  it("detects the allowed image formats from the file content", () => {
    expect(detectImageMimeType(jpeg)).toBe("image/jpeg");
    expect(detectImageMimeType(png)).toBe("image/png");
    expect(detectImageMimeType(webp)).toBe("image/webp");
    expect(detectImageMimeType(avif)).toBe("image/avif");
  });

  it("rejects content that only claims to be an image", () => {
    const phpScript = new TextEncoder().encode("<?php system($_GET['c']); ?>");
    const svg = new TextEncoder().encode("<svg onload=alert(1)></svg>");
    expect(detectImageMimeType(phpScript)).toBeNull();
    expect(detectImageMimeType(svg)).toBeNull();
    expect(detectImageMimeType(new Uint8Array())).toBeNull();
  });

  it("records the storage key so images can actually be deleted", () => {
    expect(allMigrations).toContain('ALTER TABLE public."UnitMedia" ADD COLUMN IF NOT EXISTS "storageKey"');
    expect(read("src/lib/repositories/listing-media.ts")).toContain("storageKey,");
    expect(read("src/lib/repositories/media-operations.ts")).toContain("storage.from(BUCKET).remove");
  });
});

describe("foreign key indexes", () => {
  it("indexes the keys the admin and portal queries join on", () => {
    const sql = read("supabase/migrations/20260814083604_foreign_key_indexes.sql");
    for (const index of [
      '"Unit_propertyId_idx"',
      '"Listing_unitId_idx"',
      '"ContractParty_personId_idx"',
      '"MaintenanceRequest_unitId_idx"',
      '"WorkOrder_requestId_idx"',
      '"UserRole_roleId_idx"',
    ]) {
      expect(sql).toContain(index);
    }
  });
});
