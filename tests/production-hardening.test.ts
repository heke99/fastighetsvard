import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("production hardening phase 1", () => {
  it("har en enda canonical migrationskedja", () => {
    const files = readdirSync(resolve("supabase/migrations"))
      .filter((name) => name.endsWith(".sql"))
      .sort();
    expect(files).toHaveLength(15);
    expect(files).not.toContain("20260719192014_initial.sql");
    expect(files.some((name) => name.includes("repair_"))).toBe(false);
    expect(files).toEqual([...files].sort());
  });

  it("har atomiska kärnoperationer och concurrency-constraints", () => {
    const sql = read("supabase/migrations/20260724010000_core_domain_hardening.sql");
    for (const fn of [
      "submit_rental_application", "send_rental_offer", "accept_rental_offer",
      "record_contract_signature", "activate_signed_contract",
      "request_contract_termination", "complete_internal_transfer",
      "claim_outbox_jobs", "claim_idempotent_operation", "fail_idempotent_operation",
    ]) {
      expect(sql).toContain(`FUNCTION public.${fn}`);
    }
    expect(sql).toContain("FOR UPDATE SKIP LOCKED");
    expect(sql).toContain('CONSTRAINT "Contract_non_overlapping_binding_periods"');
    expect(sql).toContain('CREATE UNIQUE INDEX "Reservation_one_active_per_unit_key"');
    expect(sql).toContain('CREATE UNIQUE INDEX "Application_one_active_main_per_listing_key"');
  });

  it("självregistrering kräver verifiering och får inte e-postclaima importerad person", () => {
    const source = read("src/lib/services/accounts.ts");
    const register = source.slice(source.indexOf("export async function registerAccount"), source.indexOf("export async function activateInvitation"));
    expect(register).toContain("auth.signUp");
    expect(register).not.toContain("email_confirm: true");
    expect(register).not.toContain("person.findFirst");
    expect(source).toContain("claimInvitation");
  });

  it("signaturen verifieras med single-use OTP och dokumenthash", () => {
    const sql = read("supabase/migrations/20260724015000_verified_email_otp_signing.sql");
    const service = read("src/lib/services/contracts.ts");
    expect(sql).toContain('CREATE TABLE public."SigningChallenge"');
    expect(sql).toContain("verify_signing_challenge");
    expect(sql).toContain('v_version."documentHash"');
    expect(service).toContain("verifyEmailSigningChallenge");
    expect(service).toContain("SIGNING_OTP_PEPPER");
    expect(service).toContain("hmacSha256");
    expect(sql).toContain("attemptsRemaining");
    expect(service).not.toContain("export async function signContract(");
  });

  it("API-idempotens claimas atomiskt i PostgreSQL", () => {
    const helper = read("src/lib/api/helpers.ts");
    expect(helper).toContain('rpc("claim_idempotent_operation"');
    expect(helper).toContain('rpc("complete_idempotent_operation"');
    expect(helper).toContain('rpc("fail_idempotent_operation"');
    expect(helper).not.toContain("db.idempotencyRecord.findUnique");
  });

  it("privata Storage-filer är path-bundna", () => {
    const sql = read("supabase/migrations/20260724020000_auth_rls_storage_hardening.sql");
    expect(sql).toContain('CREATE POLICY "private_storage_owner_or_staff_read"');
    expect(sql).toContain('(storage.foldername(name))[1] = public.current_app_organization_id()');
    expect(sql).toContain('(storage.foldername(name))[2] = public.current_app_person_id()');
  });

  it("har schema- och RLS-verifiering", () => {
    expect(existsSync(resolve("supabase/tests/verify_schema.sql"))).toBe(true);
    expect(existsSync(resolve("supabase/tests/verify_rls.sql"))).toBe(true);
    expect(existsSync(resolve("supabase/manual/20260724_preflight_backfill_report.sql"))).toBe(true);
  });
});
