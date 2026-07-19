import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Supabase-native projekt", () => {
  it("har ingen Prisma-runtime", () => {
    const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
    expect(pkg.dependencies?.["@prisma/client"]).toBeUndefined();
    expect(pkg.devDependencies?.prisma).toBeUndefined();
  });

  it("har SQL-migration, RLS och Supabase Auth-koppling", () => {
    const sql = readFileSync(resolve("supabase/migrations/20260719192014_initial.sql"), "utf8");
    expect(sql).toContain('REFERENCES auth.users(id)');
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("storage.buckets");
  });
});
