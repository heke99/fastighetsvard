"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { login, getClientIp, AuthError } from "@/lib/auth";
import { registerAccount, activateInvitation } from "@/lib/services/accounts";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getAppUrl } from "@/lib/app-url";
import { sendPasswordResetEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface AuthFormState {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
}

function safeNext(next: unknown): string {
  if (typeof next === "string" && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/mina-sidor";
}

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { status: "error", message: "Ange e-post och lösenord." };
  try {
    await login(email, password, await getClientIp());
  } catch (error) {
    if (error instanceof AuthError) return { status: "error", message: error.message };
    return { status: "error", message: "Inloggningen misslyckades." };
  }
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

export async function registerAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] = issue.message;
    return { status: "error", message: "Kontrollera fälten nedan.", fieldErrors };
  }
  if (parsed.data.password !== parsed.data.passwordConfirm) {
    return { status: "error", message: "Kontrollera fälten nedan.", fieldErrors: { passwordConfirm: "Lösenorden stämmer inte överens." } };
  }
  try {
    await registerAccount({
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      password: parsed.data.password,
    }, await getClientIp());
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Registreringen misslyckades." };
  }
  redirect("/mina-sidor");
}

export async function activateAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");
  if (password.length < 10) return { status: "error", fieldErrors: { password: "Lösenordet måste vara minst 10 tecken." }, message: "Kontrollera fälten." };
  if (password !== passwordConfirm) return { status: "error", fieldErrors: { passwordConfirm: "Lösenorden stämmer inte överens." }, message: "Kontrollera fälten." };
  try {
    await activateInvitation(token, password, await getClientIp());
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Aktiveringen misslyckades." };
  }
  redirect("/mina-sidor");
}

export async function requestPasswordResetAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  if (!email) return { status: "error", message: "Ange din e-postadress." };

  const profile = await db.user.findUnique({ where: { email } });
  if (profile) {
    const admin = createAdminClient();
    const redirectTo = `${getAppUrl()}/auth/callback?next=/aterstall-losenord`;
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    if (!error && data.properties?.action_link) {
      await sendPasswordResetEmail(email, data.properties.action_link);
      await audit({
        organizationId: profile.organizationId,
        userId: profile.id,
        action: "password_reset_requested",
        entityType: "user",
        entityId: profile.id,
      });
    }
  }
  return { status: "success", message: "Om e-postadressen finns hos oss har vi skickat en återställningslänk." };
}

export async function resetPasswordAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 10) return { status: "error", message: "Lösenordet måste vara minst 10 tecken." };
  const supabase = await createServerSupabaseClient();
  const { data: current } = await supabase.auth.getUser();
  if (!current.user) return { status: "error", message: "Återställningssessionen saknas eller har gått ut." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { status: "error", message: error.message };

  const profile = await db.user.findUnique({ where: { authUserId: current.user.id } });
  if (profile) {
    await audit({
      organizationId: profile.organizationId,
      userId: profile.id,
      action: "password_reset",
      entityType: "user",
      entityId: profile.id,
    });
  }
  redirect("/logga-in?aterstallt=1");
}
