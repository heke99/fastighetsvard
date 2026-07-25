import { withApiAuth, parsePagination, paginatedResponse } from "@/lib/api/helpers";
import { serializeInvoice } from "@/lib/api/serializers";
import { listApiInvoices } from "@/lib/repositories/external-api-records";

export const GET = withApiAuth("invoices:read", async (req, ctx) => {
  const url = new URL(req.url);
  const pagination = parsePagination(req);
  const status = url.searchParams.get("status");
  const personId = url.searchParams.get("person_id");
  const contractId = url.searchParams.get("contract_id");
  const dueFrom = url.searchParams.get("due_from");
  const dueTo = url.searchParams.get("due_to");
  const sort = url.searchParams.get("sort") ?? "-invoice_date";

  const order =
    sort === "due_date" ? { column: "dueDate" as const, ascending: true }
    : sort === "-due_date" ? { column: "dueDate" as const, ascending: false }
    : sort === "invoice_date" ? { column: "invoiceDate" as const, ascending: true }
    : { column: "invoiceDate" as const, ascending: false };

  const { items, total } = await listApiInvoices({
    organizationId: ctx.organizationId,
    status: status?.toUpperCase(),
    personId,
    contractId,
    dueFrom,
    dueTo,
    order,
    skip: pagination.skip,
    take: pagination.take,
  });

  return paginatedResponse(items.map(serializeInvoice), total, pagination, ctx);
});
