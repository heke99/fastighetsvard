import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const otpTypes = new Set<EmailOtpType>([
  "signup",
  "invite",
  "recovery",
  "magiclink",
  "email_change",
  "email",
]);

function safeNext(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/mina-sidor";
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const rawType = url.searchParams.get("type") as EmailOtpType | null;
  const supabase = await createServerSupabaseClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
    console.error("FaddeBo Supabase PKCE callback failed", error.message);
  }

  if (tokenHash && rawType && otpTypes.has(rawType)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: rawType });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
    console.error("FaddeBo Supabase token callback failed", error.message);
  }

  return NextResponse.redirect(new URL("/logga-in?authfel=1", url.origin));
}
