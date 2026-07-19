import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";

/**
 * GET /api/auth/gdpr-export
 * Registerutdrag (dataportabilitet enligt GDPR art. 15/20) för inloggad person.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user?.personId) {
    return NextResponse.json(
      { error: { code: "unauthenticated", message: "Inloggning krävs." } },
      { status: 401 }
    );
  }

  const person = await db.person.findUnique({
    where: { id: user.personId },
    include: {
      roles: true,
      applicationMembers: { include: { application: { include: { listing: { select: { title: true } } } } } },
      contractParties: { include: { contract: { select: { contractNumber: true, status: true, startDate: true, rent: true } } } },
      invoices: { select: { invoiceNumber: true, status: true, invoiceDate: true, dueDate: true, totalAmount: true, paidAmount: true } },
      maintenanceRequests: { select: { requestNumber: true, title: true, status: true, createdAt: true } },
      favorites: { include: { listing: { select: { title: true } } } },
      savedSearches: { select: { name: true, criteria: true, createdAt: true } },
      notifications: { select: { eventType: true, title: true, createdAt: true } },
      documents: { select: { title: true, type: true, createdAt: true } },
    },
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "gdpr_export",
    entityType: "person",
    entityId: user.personId,
  });

  return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), data: person }, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="registerutdrag-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
