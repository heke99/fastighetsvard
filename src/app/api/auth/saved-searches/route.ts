import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  createMySavedSearch,
  deleteMySavedSearch,
} from "@/lib/repositories/portal-records";

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
  const id = await createMySavedSearch({
    organizationId: user.organizationId,
    personId: user.personId,
    name: parsed.data.name,
    criteria: parsed.data.criteria,
  });
  return NextResponse.json({ data: { id } }, { status: 201 });
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
  const deleted = await deleteMySavedSearch(user.personId, id);
  return NextResponse.json({ data: { deleted } });
}
