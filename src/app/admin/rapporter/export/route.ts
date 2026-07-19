import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";

/** CSV-export av objekt- och uthyrningsrapport. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user?.organizationId || !hasPermission(user.permissions, "reports", "export")) {
    return NextResponse.json(
      { error: { code: "forbidden", message: "Behörighet saknas." } },
      { status: 403 }
    );
  }

  const units = await prisma.unit.findMany({
    where: { organizationId: user.organizationId },
    include: {
      property: { select: { name: true } },
      contracts: {
        where: { status: "ACTIVE" },
        include: { parties: { include: { person: true } } },
      },
    },
    orderBy: { unitNumber: "asc" },
  });

  const header = "objektsnummer;typ;adress;ort;status;hyra;hyresgast;avtalsnummer;fastighet";
  const lines = units.map((u) => {
    const contract = u.contracts[0];
    const tenant = contract?.parties.find((p) => p.role === "TENANT")?.person;
    return [
      u.unitNumber,
      u.type,
      u.address,
      u.city,
      u.status,
      u.rent ? Number(u.rent) : "",
      tenant ? `${tenant.firstName} ${tenant.lastName}` : "",
      contract?.contractNumber ?? "",
      u.property.name,
    ]
      .map((v) => String(v).replaceAll(";", ","))
      .join(";");
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "report_export",
    entityType: "report",
    after: { rows: units.length },
  });

  return new NextResponse("\uFEFF" + [header, ...lines].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="objektsrapport-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
