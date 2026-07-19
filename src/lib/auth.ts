import { headers } from "next/headers";
import { cache } from "react";
import { db } from "./db";
import { hasPermission, type Resource, type Action } from "./permissions";
import { audit } from "./audit";
import { createServerSupabaseClient } from "./supabase/server";

export class AuthError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "AuthError";
  }
}

export async function login(email: string, password: string, ip?: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.toLowerCase().trim(),
    password,
  });
  if (error || !data.user) {
    throw new AuthError("Fel e-post eller lösenord.", "invalid_credentials");
  }

  const profile = await db.user.findUnique({ where: { authUserId: data.user.id } });
  if (!profile || !profile.isActive) {
    await supabase.auth.signOut();
    throw new AuthError("Kontot är inaktiverat.", "inactive");
  }

  await db.user.update({
    where: { authUserId: data.user.id },
    data: { lastLoginAt: new Date() },
  });
  await audit({
    organizationId: profile.organizationId,
    userId: profile.id,
    action: "login",
    entityType: "user",
    entityId: profile.id,
    ip,
  });
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

  const profile = await db.user.findUnique({
    where: { authUserId: data.user.id },
    include: {
      person: { include: { roles: true } },
      userRoles: { include: { role: { include: { permissions: true } } } },
    },
  });
  if (!profile || !profile.isActive) return null;

  const permissions = new Set<string>();
  const roleSlugs: string[] = [];
  for (const userRole of profile.userRoles ?? []) {
    roleSlugs.push(userRole.role.slug);
    for (const permission of userRole.role.permissions ?? []) {
      permissions.add(permission.permission);
    }
  }

  return {
    id: profile.id,
    email: profile.email,
    organizationId: profile.organizationId ?? null,
    personId: profile.personId ?? null,
    supplierId: profile.supplierId ?? null,
    permissions: [...permissions],
    roleSlugs,
    person: profile.person
      ? {
          id: profile.person.id,
          firstName: profile.person.firstName,
          lastName: profile.person.lastName,
          roles: (profile.person.roles ?? []).map((role: any) => role.role),
        }
      : null,
  };
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
  const staffRoles = [
    "superadmin", "org-admin", "property-owner", "property-manager",
    "caretaker", "leasing-agent", "sales-manager", "finance",
    "customer-service", "facility-worker", "inspector", "report-viewer",
  ];
  if (!user.roleSlugs.some((role) => staffRoles.includes(role))) {
    throw new AuthError("Behörighet saknas.", "forbidden");
  }
  return user;
}

export async function getClientIp(): Promise<string | undefined> {
  const requestHeaders = await headers();
  return requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    requestHeaders.get("x-real-ip") ?? undefined;
}
