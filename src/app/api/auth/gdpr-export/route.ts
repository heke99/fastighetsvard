import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getMyGdprExport } from "@/lib/repositories/portal-records";

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

  const person = await getMyGdprExport(user.personId);

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
