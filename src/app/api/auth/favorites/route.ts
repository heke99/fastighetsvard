import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({ listingId: z.string().min(1) });

/** Toggla favorit för inloggad användare. */
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
      { error: { code: "validation_error", message: "listingId krävs." } },
      { status: 422 }
    );
  }
  const { listingId } = parsed.data;
  const listing = await db.listing.findFirst({
    where: { id: listingId, organizationId: user.organizationId },
  });
  if (!listing) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Annonsen hittades inte." } },
      { status: 404 }
    );
  }

  const existing = await db.favorite.findUnique({
    where: { personId_listingId: { personId: user.personId, listingId } },
  });
  if (existing) {
    await db.favorite.delete({ where: { id: existing.id } });
    return NextResponse.json({ favorite: false });
  }
  await db.favorite.create({
    data: { organizationId: user.organizationId, personId: user.personId, listingId },
  });
  return NextResponse.json({ favorite: true });
}
