import { cleanEnvValue, normalizeHttpUrl, requireEnvValue } from "@/lib/env-value";

export function getSupabaseUrl(): string {
  return normalizeHttpUrl(
    requireEnvValue("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL)
  );
}

export function getSupabasePublishableKey(): string {
  return requireEnvValue(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ??
      cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

export function getSupabaseSecretKey(): string {
  return requireEnvValue(
    "SUPABASE_SECRET_KEY",
    cleanEnvValue(process.env.SUPABASE_SECRET_KEY) ??
      cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

export function hasSupabaseSecretKey(): boolean {
  return Boolean(
    cleanEnvValue(process.env.SUPABASE_SECRET_KEY) ??
      cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}
