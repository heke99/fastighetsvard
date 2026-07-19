import type { Database } from "@/lib/database-types";

/**
 * Atomiskt löpnummer per organisation och nyckel (t.ex. "maintenance",
 * "workorder", "contract"). Använder upsert + increment i samma transaktion
 * som anroparen för att undvika race conditions.
 */
export async function nextNumber(
  tx: Database.TransactionClient,
  organizationId: string,
  key: string
): Promise<number> {
  const counter = await tx.counter.upsert({
    where: { organizationId_key: { organizationId, key } },
    create: { organizationId, key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return counter.value;
}
