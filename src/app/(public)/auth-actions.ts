"use server";

import { sendPasswordResetEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/app-url";

import { redirect } from "next/navigation";
import { z } from "zod";
import { login, setSessionCookie, getClientIp, AuthError } from "@/lib/auth";
import { registerAccount, activateInvitation } from "@/lib/services/accounts";
import { prisma } from "@/lib/db";
import { generateToken, sha256 } from "@/lib/crypto";
import { hashPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";

export interface AuthFormState {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
}

function safeNext(next: unknown): string {
  if (typeof next === "string" && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/mina-sidor";
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { status: "error", message: "Ange e-post och lösenord." };
  }
  let token: string;
  try {
    const result = await login(email, password, await getClientIp());
    token = result.token;
  } catch (e) {
    if (e instanceof AuthError) return { status: "error", message: e.message };
    return { status: "error", message: "Inloggningen misslyckades." };
  }
  await setSessionCookie(token);
  redirect(safeNext(formData.get("next")));
}

const registerSchema = z.object({
  firstName: z.string().min(1, "Ange förnamn.").max(100),
  lastName: z.string().min(1, "Ange efternamn.").max(100),
  email: z.string().email("Ogiltig e-postadress."),
  phone: z.string().max(30).optional(),
  password: z.string().min(10, "Lösenordet måste vara minst 10 tecken."),
  passwordConfirm: z.string(),
  consent: z.literal("1", { errorMap: () => ({ message: "Du måste godkänna behandling av personuppgifter." }) }),
});

export async function registerAction(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] = issue.message;
    return { status: "error", message: "Kontrollera fälten nedan.", fieldErrors };
  }
  if (parsed.data.password !== parsed.data.passwordConfirm) {
    return {
      status: "error",
      message: "Kontrollera fälten nedan.",
      fieldErrors: { passwordConfirm: "Lösenorden stämmer inte överens." },
    };
  }
  let token: string;
  try {
    const result = await registerAccount(
      {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email: parsed.data.email,
        phone: parsed.data.phone,
        password: parsed.data.password,
      },
      await getClientIp()
    );
    token = result.token;
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Registreringen misslyckades." };
  }
  await setSessionCookie(token);
  redirect("/mina-sidor");
}

export async function activateAction(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");
  if (password.length < 10) {
    return { status: "error", fieldErrors: { password: "Lösenordet måste vara minst 10 tecken." }, message: "Kontrollera fälten." };
  }
  if (password !== passwordConfirm) {
    return { status: "error", fieldErrors: { passwordConfirm: "Lösenorden stämmer inte överens." }, message: "Kontrollera fälten." };
  }
  let sessionToken: string;
  try {
    const result = await activateInvitation(token, password, await getClientIp());
    sessionToken = result.token;
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Aktiveringen misslyckades." };
  }
  await setSessionCookie(sessionToken);
  redirect("/mina-sidor");
}

export async function requestPasswordResetAction(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  if (!email) return { status: "error", message: "Ange din e-postadress." };

  const user = await prisma.user.findUnique({ where: { email } });
  // Samma svar oavsett om kontot finns – förhindrar user enumeration.
  if (user) {
    const token = generateToken(32);
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    const url = `${getAppUrl()}/aterstall-losenord/${token}`;
    await sendPasswordResetEmail(email, url);
    await audit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "password_reset_requested",
      entityType: "user",
      entityId: user.id,
    });
  }
  return {
    status: "success",
    message: "Om e-postadressen finns hos oss har vi skickat en återställningslänk.",
  };
}

export async function resetPasswordAction(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 10) {
    return { status: "error", message: "Lösenordet måste vara minst 10 tecken." };
  }
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { status: "error", message: "Länken är ogiltig eller har gått ut." };
  }
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: record.userId },
      data: {
        passwordHash: await hashPassword(password),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    await tx.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    // Återkalla alla befintliga sessioner vid lösenordsbyte.
    await tx.session.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await audit(
      {
        organizationId: record.user.organizationId,
        userId: record.userId,
        action: "password_reset",
        entityType: "user",
        entityId: record.userId,
      },
      tx
    );
  });
  redirect("/logga-in?aterstallt=1");
}
