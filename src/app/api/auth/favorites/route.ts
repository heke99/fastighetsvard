import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { toggleMyFavorite } from "@/lib/repositories/portal-records";

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
  try {
    const favorite = await toggleMyFavorite(listingId);
    return NextResponse.json({ favorite });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Favoriten kunde inte uppdateras.";
    const notFound = message.includes("listing_not_found") || message.includes("hittades inte");
    return NextResponse.json(
      { error: { code: notFound ? "not_found" : "favorite_failed", message } },
      { status: notFound ? 404 : 400 }
    );
  }
}
