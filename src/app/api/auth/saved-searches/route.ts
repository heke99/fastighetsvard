import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(1).max(120),
  criteria: z.record(z.string()),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.personId || !user.organizationId) {
    return NextResponse.json(
      { error: { code: "unauthenticated", message: "Inloggning krävs." } },
      { status: 401 }
    );
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Ogiltiga fält." } },
      { status: 422 }
    );
  }
  const saved = await db.savedSearch.create({
    data: {
      organizationId: user.organizationId,
      personId: user.personId,
      name: parsed.data.name,
      criteria: parsed.data.criteria,
    },
  });
  return NextResponse.json({ data: { id: saved.id } }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.personId) {
    return NextResponse.json(
      { error: { code: "unauthenticated", message: "Inloggning krävs." } },
      { status: 401 }
    );
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "id krävs." } },
      { status: 422 }
    );
  }
  // Ägarkontroll: endast egna bevakningar kan tas bort.
  const deleted = await db.savedSearch.deleteMany({
    where: { id, personId: user.personId },
  });
  return NextResponse.json({ data: { deleted: deleted.count > 0 } });
}
