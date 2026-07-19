import { db } from "@/lib/db";
import { withApiAuth, parsePagination, paginatedResponse } from "@/lib/api/helpers";
import { serializeInvoice } from "@/lib/api/serializers";
import type { Database, InvoiceStatus } from "@/lib/database-types";

export const GET = withApiAuth("invoices:read", async (req, ctx) => {
  const url = new URL(req.url);
  const pagination = parsePagination(req);
  const status = url.searchParams.get("status");
  const personId = url.searchParams.get("person_id");
  const contractId = url.searchParams.get("contract_id");
  const dueFrom = url.searchParams.get("due_from");
  const dueTo = url.searchParams.get("due_to");
  const sort = url.searchParams.get("sort") ?? "-invoice_date";

  const where: Database.InvoiceWhereInput = {
    organizationId: ctx.organizationId,
    ...(status ? { status: status.toUpperCase() as InvoiceStatus } : {}),
    ...(personId ? { personId } : {}),
    ...(contractId ? { contractId } : {}),
    ...(dueFrom || dueTo
      ? {
          dueDate: {
            ...(dueFrom ? { gte: new Date(dueFrom) } : {}),
            ...(dueTo ? { lte: new Date(dueTo) } : {}),
          },
        }
      : {}),
  };

  const orderBy: Database.InvoiceOrderByWithRelationInput =
    sort === "due_date" ? { dueDate: "asc" }
    : sort === "-due_date" ? { dueDate: "desc" }
    : sort === "invoice_date" ? { invoiceDate: "asc" }
    : { invoiceDate: "desc" };

  const [items, total] = await Promise.all([
    db.invoice.findMany({
      where,
      include: { lines: true, externalReferences: true },
      orderBy,
      skip: pagination.skip,
      take: pagination.take,
    }),
    db.invoice.count({ where }),
  ]);

  return paginatedResponse(items.map(serializeInvoice), total, pagination, ctx);
});
