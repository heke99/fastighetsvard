import { headers } from "next/headers";
import { cache } from "react";
import { hasPermission, type Resource, type Action } from "./permissions";
import { createServerSupabaseClient } from "./supabase/server";
import { getTrustedClientIp } from "./http-client-ip";
import {
  readCurrentUserContext,
  recordCurrentLogin,
} from "./repositories/auth-context";
import { isStaffAccount } from "./role-routing";
import { reconcileVerifiedAuthUser } from "./repositories/auth-reconciliation";

export class AuthError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "AuthError";
  }
}

export async function login(email: string, password: string, ip?: string) {
  const supabase = await createServerSupabaseClient();
  const normalizedEmail = email.toLowerCase().trim();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error || !data.user) {
    const message = error?.message?.toLowerCase() ?? "";
    if (message.includes("email not confirmed")) {
      throw new AuthError(
        "Bekräfta din e-postadress innan du loggar in.",
        "email_not_confirmed"
      );
    }
    throw new AuthError("Fel e-post eller lösenord.", "invalid_credentials");
  }

  let profile;
  try {
    profile = await readCurrentUserContext(supabase);
    if (!profile && (await reconcileVerifiedAuthUser(data.user.id))) {
      profile = await readCurrentUserContext(supabase);
    }
  } catch (profileError) {
    console.error("FaddeBo login profile lookup failed", profileError);
    await supabase.auth.signOut();
    throw new AuthError(
      "Kontot kunde inte kopplas till FaddeBo. Kontrollera Supabase-projektet och databasens migrationer.",
      "profile_lookup_failed"
    );
  }

  if (!profile) {
    await supabase.auth.signOut();
    throw new AuthError(
      "Kontot saknar en aktiv FaddeBo-profil. Bekräfta e-posten eller kontakta administratören.",
      "inactive"
    );
  }

  // Senast-inloggad och revisionsspår får aldrig göra en i övrigt giltig
  // inloggning obrukbar. Logga felet och låt sessionen fortsätta.
  try {
    await recordCurrentLogin(supabase, ip);
  } catch (auditError) {
    console.error("FaddeBo login audit update failed", auditError);
  }

  return { user: profile, session: data.session };
}

/** Supabase SSR skriver auth-cookies direkt vid signIn/signUp. */
export async function setSessionCookie(_token?: string) {}

export async function clearSessionCookie() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
}

export interface CurrentUser {
  id: string;
  email: string;
  organizationId: string | null;
  personId: string | null;
  supplierId: string | null;
  permissions: string[];
  roleSlugs: string[];
  roleNames: string[];
  person: {
    id: string;
    firstName: string;
    lastName: string;
    roles: string[];
  } | null;
}

/** Hämtar och verifierar Supabase Auth-användaren, därefter appens profil/RBAC. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  try {
    return await readCurrentUserContext(supabase);
  } catch (error) {
    console.error("FaddeBo current user context failed", error);
    return null;
  }
});

export async function logout() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Inloggning krävs.", "unauthenticated");
  return user;
}

export async function requirePermission(resource: Resource, action: Action): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasPermission(user.permissions, resource, action)) {
    throw new AuthError("Behörighet saknas.", "forbidden");
  }
  return user;
}

export async function requireStaff(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!isStaffAccount(user.roleSlugs)) {
    throw new AuthError("Behörighet saknas.", "forbidden");
  }
  return user;
}

export async function getClientIp(): Promise<string | undefined> {
  const requestHeaders = await headers();
  return getTrustedClientIp(requestHeaders);
}
