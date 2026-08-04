import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { cleanEnvValue, normalizeHttpUrl } from "@/lib/env-value";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const rawUrl = cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key =
    cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ??
    cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!rawUrl || !key) return response;

  let url: string;
  try {
    url = normalizeHttpUrl(rawUrl);
  } catch (error) {
    console.error("FaddeBo middleware Supabase URL is invalid", error);
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}
