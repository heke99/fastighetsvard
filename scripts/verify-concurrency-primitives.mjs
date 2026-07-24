import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/migrations/20260724010000_core_domain_hardening.sql", "utf8");
const required = [
  'SELECT * INTO v_offer FROM public."Offer" WHERE "id" = p_offer_id FOR UPDATE',
  'FOR UPDATE SKIP LOCKED',
  'CONSTRAINT "Contract_non_overlapping_binding_periods"',
  'CREATE UNIQUE INDEX "Reservation_one_active_per_unit_key"',
  'CREATE UNIQUE INDEX "Application_one_active_main_per_listing_key"',
  'CREATE UNIQUE INDEX "Offer_one_accepted_per_listing_key"',
  'CONSTRAINT "OperationIdempotency_scope_key" UNIQUE',
];
const missing = required.filter((needle) => !sql.includes(needle));
if (missing.length) {
  console.error("Concurrency primitives missing:\n" + missing.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}
console.log("Concurrency primitives verified statically. Run database integration tests against local Supabase for real parallel execution.");
