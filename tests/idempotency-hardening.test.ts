import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

const helper = read("src/lib/api/helpers.ts");
const migration = read("supabase/migrations/20260806143000_idempotency_outcome_hardening.sql");

describe("API idempotency outcome hardening", () => {
  it("adds an uncertain state that cannot be claimed for automatic replay", () => {
    expect(migration).toContain("'UNCERTAIN'");
    expect(migration).toContain("operation_outcome_uncertain");
    expect(migration).toContain("mark_idempotent_operation_uncertain");
  });

  it("marks only execution failures as retryable failures", () => {
    const executeIndex = helper.indexOf("result = await execute()");
    const failIndex = helper.indexOf('client.rpc("fail_idempotent_operation"');
    const completeIndex = helper.indexOf('client.rpc("complete_idempotent_operation"');
    const uncertainIndex = helper.indexOf('client.rpc("mark_idempotent_operation_uncertain"');

    expect(executeIndex).toBeGreaterThan(-1);
    expect(failIndex).toBeGreaterThan(executeIndex);
    expect(completeIndex).toBeGreaterThan(failIndex);
    expect(uncertainIndex).toBeGreaterThan(completeIndex);
  });

  it("tells clients not to create a duplicate retry with a new key", () => {
    expect(helper).toContain("idempotency_completion_uncertain");
    expect(helper).toContain("Skicka inte om operationen med en ny nyckel");
  });
});
