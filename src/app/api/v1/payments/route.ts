import { db } from "@/lib/db";
import { withApiAuth, parsePagination, paginatedResponse } from "@/lib/api/helpers";
import { serializePayment } from "@/lib/api/serializers";
import type { Database } from "@/lib/database-types";

export const GET = withApiAuth("payments:read", async (req, ctx) => {
  const url = new URL(req.url);
  const pagination = parsePagination(req);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const where: Database.PaymentWhereInput = {
    organizationId: ctx.organizationId,
    ...(from || to
      ? {
          paidAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    db.payment.findMany({
      where,
      orderBy: { paidAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    db.payment.count({ where }),
  ]);

  return paginatedResponse(items.map(serializePayment), total, pagination, ctx);
});
