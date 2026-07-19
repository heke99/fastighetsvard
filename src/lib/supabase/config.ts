function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} saknas i miljövariablerna.`);
  return value;
}

export function getSupabasePublicConfig() {
  return {
    url: required("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  };
}

export function getSupabaseServerConfig() {
  return {
    ...getSupabasePublicConfig(),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  };
}
