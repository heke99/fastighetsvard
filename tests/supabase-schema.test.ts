import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

describe("Supabase-native projekt", () => {
  it("har ingen Prisma-runtime", () => {
    const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
    expect(pkg.dependencies?.["@prisma/client"]).toBeUndefined();
    expect(pkg.devDependencies?.prisma).toBeUndefined();
  });

  it("har komplett delad SQL-migration, RLS och Supabase Auth-koppling", () => {
    const migrationDir = resolve("supabase/migrations");
    const files = readdirSync(migrationDir)
      .filter((name) => name.endsWith(".sql"))
      .sort();

    expect(files.length).toBeGreaterThanOrEqual(33);
    expect(files).toContain("20260804090000_faddebo_account_lifecycle.sql");

    const sql = files
      .map((file) => readFileSync(resolve(migrationDir, file), "utf8"))
      .join("\n");

    expect(sql).toContain("REFERENCES auth.users(id)");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("storage.buckets");
    expect(sql).toContain('CREATE TABLE public."Organization"');
    expect(sql).toContain('CREATE TABLE public."Counter"');
    expect(sql).toContain('CREATE TABLE public."Brand"');
  });
});
