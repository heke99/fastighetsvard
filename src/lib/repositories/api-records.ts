import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

type Filter = {
  column: string;
  operator: "eq" | "gte" | "lte" | "ilike";
  value: string | number | boolean;
};

export async function listOrganizationRecords(input: {
  table: string;
  columns: string;
  organizationId: string;
  filters?: Filter[];
  order: { column: string; ascending: boolean };
  skip: number;
  take: number;
}): Promise<{ items: Record<string, any>[]; total: number }> {
  const admin = createAdminClient();
  let query = admin
    .from(input.table)
    .select(input.columns, { count: "exact" })
    .eq("organizationId", input.organizationId);
  for (const filter of input.filters ?? []) {
    if (filter.operator === "eq") query = query.eq(filter.column, filter.value);
    if (filter.operator === "gte") query = query.gte(filter.column, filter.value);
    if (filter.operator === "lte") query = query.lte(filter.column, filter.value);
    if (filter.operator === "ilike") query = query.ilike(filter.column, String(filter.value));
  }
  const { data, error, count } = await query
    .order(input.order.column, { ascending: input.order.ascending })
    .order("id", { ascending: true })
    .range(input.skip, input.skip + input.take - 1);
  if (error) throw new Error(`API-läsning av ${input.table} misslyckades (${error.code}).`);
  return {
    items: (data ?? []) as unknown as Record<string, any>[],
    total: count ?? 0,
  };
}
