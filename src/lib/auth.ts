import { cookies, headers } from "next/headers";
import { cache } from "react";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { sha256, generateToken } from "./crypto";
import { hasPermission, type Resource, type Action } from "./permissions";
import { audit } from "./audit";

const SESSION_COOKIE = "oet_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 dagar
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export class AuthError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "AuthError";
  }
}

export async function createSession(userId: string, ip?: string, userAgent?: string) {
  const token = generateToken(32);
  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      ip,
      userAgent,
    },
  });
  return { token, session };
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Inloggning med brute force-skydd: kontot låses i 15 minuter efter
 * 5 misslyckade försök. Revisionsloggas.
 */
export async function login(email: string, password: string, ip?: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });
  if (!user || !user.isActive) {
    throw new AuthError("Fel e-post eller lösenord.", "invalid_credentials");
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AuthError(
      "Kontot är tillfälligt låst efter för många misslyckade försök. Försök igen senare.",
      "locked"
    );
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const attempts = user.failedLoginAttempts + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil:
          attempts >= MAX_FAILED_ATTEMPTS
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
            : null,
      },
    });
    await audit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "login_failed",
      entityType: "user",
      entityId: user.id,
      ip,
    });
    throw new AuthError("Fel e-post eller lösenord.", "invalid_credentials");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  const { token } = await createSession(user.id, ip);
  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "login",
    entityType: "user",
    entityId: user.id,
    ip,
  });
  return { user, token };
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

/** Hämtar inloggad användare från sessionscookien. Cachas per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      user: {
        include: {
          person: { include: { roles: true } },
          userRoles: { include: { role: { include: { permissions: true } } } },
        },
      },
    },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  if (!session.user.isActive) return null;

  const permissions = new Set<string>();
  const roleSlugs: string[] = [];
  for (const ur of session.user.userRoles) {
    roleSlugs.push(ur.role.slug);
    for (const p of ur.role.permissions) permissions.add(p.permission);
  }

  return {
    id: session.user.id,
    email: session.user.email,
    organizationId: session.user.organizationId,
    personId: session.user.personId,
    supplierId: session.user.supplierId,
    permissions: [...permissions],
    roleSlugs,
    person: session.user.person
      ? {
          id: session.user.person.id,
          firstName: session.user.person.firstName,
          lastName: session.user.person.lastName,
          roles: session.user.person.roles.map((r) => r.role),
        }
      : null,
  };
});

export async function logout() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.updateMany({
      where: { tokenHash: sha256(token) },
      data: { revokedAt: new Date() },
    });
  }
  store.delete(SESSION_COOKIE);
}

/** Server-side authorization – UI-behörighet räcker aldrig. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Inloggning krävs.", "unauthenticated");
  return user;
}

export async function requirePermission(
  resource: Resource,
  action: Action
): Promise<CurrentUser> {
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
  if (!user.roleSlugs.some((r) => staffRoles.includes(r))) {
    throw new AuthError("Behörighet saknas.", "forbidden");
  }
  return user;
}

export async function getClientIp(): Promise<string | undefined> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    undefined
  );
}
