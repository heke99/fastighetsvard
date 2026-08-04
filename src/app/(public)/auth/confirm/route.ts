import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const allowedTypes = new Set<EmailOtpType>([
  "signup",
  "invite",
  "recovery",
  "magiclink",
  "email_change",
  "email",
]);

function safeNext(value: string | null, type: EmailOtpType): string {
  if (value?.startsWith("/") && !value.startsWith("//")) return value;
  if (type === "invite" || type === "recovery") return "/aterstall-losenord";
  return "/mina-sidor";
}

/**
 * Server-side verifiering för Supabase Auth-mejl. De FaddeBo-formgivna
 * mallarna länkar hit med TokenHash, så sessionen kan lagras i SSR-cookies
 * innan användaren skickas vidare.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const rawType = url.searchParams.get("type") as EmailOtpType | null;

  if (!tokenHash || !rawType || !allowedTypes.has(rawType)) {
    return NextResponse.redirect(new URL("/logga-in?authfel=ogiltig_lank", url.origin));
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: rawType,
  });

  if (error) {
    console.error("FaddeBo Supabase email verification failed", {
      type: rawType,
      message: error.message,
    });
    return NextResponse.redirect(new URL("/logga-in?authfel=utgangen_lank", url.origin));
  }

  return NextResponse.redirect(new URL(safeNext(url.searchParams.get("next"), rawType), url.origin));
}
