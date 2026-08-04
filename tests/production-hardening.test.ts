import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("production hardening phase 1", () => {
  it("har en enda canonical migrationskedja", () => {
    const files = readdirSync(resolve("supabase/migrations"))
      .filter((name) => name.endsWith(".sql"))
      .sort();
    expect(files).toHaveLength(30);
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

  it("separerar FaddeBo-varumärket från juridisk organisation", () => {
    const sql = read("supabase/migrations/20260725010000_faddebo_brand.sql");
    const branding = read("src/lib/branding.ts");
    expect(sql).toContain('CREATE TABLE public."Brand"');
    expect(sql).toContain('"Brand_one_primary_per_organization_key"');
    expect(sql).toContain('CREATE POLICY "brand_public_active_read"');
    expect(sql).toContain("'FaddeBo'");
    expect(sql).toContain("'Östgöta El Teknik AB'");
    expect(sql).toContain("'559350-5620'");
    expect(branding).toContain('value("BRAND_NAME"');
    expect(branding).toContain('"FaddeBo"');
    expect(branding).toContain('"Östgöta El Teknik AB"');
  });

  it("kör administrativa statusövergångar atomiskt i PostgreSQL", () => {
    const sql = read("supabase/migrations/20260725020000_canonical_admin_commands.sql");
    const applications = read("src/lib/services/applications.ts");
    const listings = read("src/lib/services/listings.ts");
    const contracts = read("src/lib/services/contracts.ts");
    for (const fn of [
      "change_application_status",
      "change_listing_status",
      "complete_unit_listings",
      "change_contract_status",
    ]) {
      expect(sql).toContain(`FUNCTION public.${fn}`);
    }
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("dedicated_contract_command_required");
    expect(sql).toContain("write_audit_event");
    expect(sql).toContain("enqueue_outbox_event");
    expect(applications).not.toContain("db.$transaction");
    expect(listings.slice(listings.indexOf("export async function changeListingStatus")))
      .not.toContain("db.$transaction");
    expect(contracts).not.toContain("db.$transaction");
    expect(contracts).toContain("activateSignedRentalContract");
  });

  it("läser publik katalog via begränsade vyer och databasfilter", () => {
    const sql = read("supabase/migrations/20260725030000_public_catalog_repositories.sql");
    const repository = read("src/lib/repositories/public-catalog.ts");
    const publicPages = [
      "src/app/(public)/page.tsx",
      "src/app/(public)/annons/[slug]/page.tsx",
      "src/app/(public)/annons/[slug]/ansok/page.tsx",
      "src/app/(public)/vara-fastigheter/page.tsx",
      "src/components/ListingSearch.tsx",
    ].map(read).join("\n");
    expect(sql).toContain("WITH (security_barrier = true)");
    expect(sql).toContain("published_listing_catalog");
    expect(sql).toContain("public_property_catalog");
    expect(sql).toContain("current_person_has_active_application");
    expect(repository).toContain('.from("published_listing_catalog")');
    expect(repository).toContain('.eq("brandSlug", brandSlug())');
    expect(repository).toContain(".range(");
    expect(publicPages).not.toContain("@/lib/db");
  });

  it("kör underhållskommandon atomiskt i PostgreSQL", () => {
    const sql = read("supabase/migrations/20260725040000_canonical_maintenance_commands.sql");
    const service = read("src/lib/services/maintenance.ts");
    for (const fn of [
      "create_maintenance_request",
      "change_maintenance_status",
      "create_work_order",
      "change_work_order_status",
    ]) {
      expect(sql).toContain(`FUNCTION public.${fn}`);
    }
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("invalid_maintenance_transition");
    expect(sql).toContain("invalid_work_order_transition");
    expect(service).not.toContain("@/lib/db");
    expect(service).not.toContain("$transaction");
  });

  it("växlar portalens favoriter atomiskt", () => {
    const sql = read("supabase/migrations/20260725050000_portal_commands.sql");
    const route = read("src/app/api/auth/favorites/route.ts");
    expect(sql).toContain("FUNCTION public.toggle_favorite");
    expect(sql).toContain("ON CONFLICT");
    expect(sql).toContain("current_app_person_id");
    expect(route).not.toContain("@/lib/db");
    expect(route).toContain("toggleMyFavorite");
    expect(sql).toContain("FUNCTION public.current_user_context");
    expect(sql).toContain("FUNCTION public.record_current_login");
    expect(sql).toContain('REVOKE UPDATE ON TABLE public."User" FROM authenticated');
    expect(read("src/lib/auth.ts")).not.toContain('from "./db"');
  });

  it("provisionerar personalprofil atomiskt efter Auth-skapande", () => {
    const sql = read("supabase/migrations/20260725060000_staff_provisioning.sql");
    const actions = read("src/app/admin/actions.ts");
    const authUsers = read("src/lib/supabase/users.ts");
    expect(sql).toContain("FUNCTION public.provision_staff_user");
    expect(sql).toContain("service_role_required");
    expect(actions).toContain("provisionStaffUser");
    expect(actions).not.toContain("await db.$transaction");
    expect(authUsers).toContain('claim_mode: input.claimMode ?? "staff_invitation"');
  });

  it("importerar och allokerar externa betalningar atomiskt", () => {
    const sql = read("supabase/migrations/20260725070000_external_payment_command.sql");
    const sync = read("src/lib/integrations/sync.ts");
    expect(sql).toContain("FUNCTION public.apply_external_payment");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain('INSERT INTO public."PaymentAllocation"');
    expect(sql).toContain("ON CONFLICT");
    expect(sync).toContain("applyExternalPayment");
    expect(sync).not.toContain("await db.$transaction");
  });

  it("registrerar befintlig hyresgäst och avtal atomiskt", () => {
    const sql = read("supabase/migrations/20260725080000_existing_tenant_command.sql");
    const tenants = read("src/lib/services/tenants.ts");
    expect(sql).toContain("FUNCTION public.register_existing_tenant");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain('INSERT INTO public."ContractParty"');
    expect(sql).toContain('UPDATE public."Unit" SET "status" = \'RENTED\'');
    expect(tenants).toContain("registerExistingTenantCommand");
    expect(tenants).not.toContain("db.$transaction");
  });

  it("matchar eller skapar externa kunder atomiskt", () => {
    const sql = read("supabase/migrations/20260725090000_external_customer_command.sql");
    expect(sql).toContain("FUNCTION public.upsert_external_customer");
    expect(read("src/app/api/v1/customers/route.ts")).toContain("upsertApiCustomer");
    expect(read("src/app/api/v1/customers/route.ts")).not.toContain("@/lib/db");
  });

  it("beräknar adminmått i databasen", () => {
    const sql = read("supabase/migrations/20260725100000_admin_metrics.sql");
    expect(sql).toContain("FUNCTION public.admin_dashboard_metrics");
    expect(sql).toContain("FUNCTION public.admin_report_metrics");
    expect(read("src/app/admin/page.tsx")).not.toContain("@/lib/db");
    expect(read("src/app/admin/rapporter/page.tsx")).not.toContain("@/lib/db");
  });

  it("har avvecklat legacyadaptern och flyttat integrationskommandon till PostgreSQL", () => {
    expect(existsSync(resolve("src/lib/db.ts"))).toBe(false);
    expect(existsSync(resolve("src/lib/database-schema.json"))).toBe(false);
    expect(read("supabase/migrations/20260725130000_webhook_delivery_commands.sql"))
      .toContain("FOR UPDATE SKIP LOCKED");
    expect(read("supabase/migrations/20260725140000_external_invoice_commands.sql"))
      .toContain("FUNCTION public.persist_external_invoice");
    expect(read("src/lib/integrations/sync.ts")).not.toContain("@/lib/db");
  });
  it("hardens FaddeBo account roles, contact addresses and public navigation", () => {
    const sql = read("supabase/migrations/20260803230000_faddebo_accounts_and_roles.sql");
    const header = read("src/components/SiteHeader.tsx");
    const footer = read("src/components/SiteFooter.tsx");
    const home = read("src/app/(public)/page.tsx");
    const roleRouting = read("src/lib/role-routing.ts");
    const adminDashboard = read("src/app/admin/page.tsx");
    const config = read("next.config.ts");
    const authRepair = read("supabase/migrations/20260804003100_faddebo_owner_auth_repair.sql");
    const ownerSql = read("supabase/manual/01_CREATE_FADDEBO_OWNER.sql");
    const branding = read("src/lib/branding.ts");
    const email = read("src/lib/email.ts");
    const authActions = read("src/app/(public)/auth-actions.ts");

    expect(sql).toContain("info@faddebo.se");
    expect(sql).toContain("privileged_role_assignment_denied");
    expect(sql).toContain("users:create");
    expect(sql).toContain("Fastighetsvärd / förvaltare");
    expect(roleRouting).toContain('"property-manager"');
    expect(roleRouting).toContain('OWNER_ROLE_SLUGS = ["superadmin"]');
    expect(header).not.toContain('{ href: "/till-salu"');
    expect(header).not.toContain('{ href: "/parkering"');
    expect(footer).not.toContain('href="/till-salu"');
    expect(footer).not.toContain('href="/parkering"');
    expect(adminDashboard).not.toContain('label: "Till salu"');
    expect(home).toContain("FaddeBo förvaltar bostäder och lokaler i Vadstena, Boxholm och Skänninge");
    expect(config).toContain('{ source: "/till-salu", destination: "/lediga-bostader"');
    expect(config).toContain('{ source: "/parkering", destination: "/lediga-bostader"');
    expect(authRepair).toContain('ALTER COLUMN "passwordHash" DROP NOT NULL');
    expect(authRepair).toContain('ALTER COLUMN %I SET DEFAULT CURRENT_TIMESTAMP');
    expect(ownerSql).toContain('"permission" = \'*\'');
    expect(ownerSql).toContain("Auto Confirm User");
    expect(branding).toContain('const GENERAL_EMAIL = "info@faddebo.se"');
    expect(branding).toContain('const FAULT_REPORT_EMAIL = "felanmalan@faddebo.se"');
    expect(email).toContain('FaddeBo <info@faddebo.se>');
    expect(authActions).toContain("resetPasswordForEmail");
  });

});
