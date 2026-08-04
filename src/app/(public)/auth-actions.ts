"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { login, getClientIp, AuthError } from "@/lib/auth";
import { registerAccount, activateInvitation } from "@/lib/services/accounts";
import { audit } from "@/lib/audit";
import { getAppUrl } from "@/lib/app-url";
import { sendPasswordResetEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  findUserByAuthId,
  findUserForPasswordReset,
} from "@/lib/repositories/account-lookups";
import { defaultDashboardForRoles } from "@/lib/role-routing";

export interface AuthFormState {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
}

function safeNext(next: unknown, fallback = "/mina-sidor"): string {
  if (typeof next === "string" && next.startsWith("/") && !next.startsWith("//")) return next;
  return fallback;
}

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { status: "error", message: "Ange e-post och lösenord." };
  let dashboard = "/mina-sidor";
  try {
    const result = await login(email, password, await getClientIp());
    dashboard = defaultDashboardForRoles(result.user.roleSlugs);
  } catch (error) {
    if (error instanceof AuthError) return { status: "error", message: error.message };
    return { status: "error", message: "Inloggningen misslyckades." };
  }
  redirect(safeNext(formData.get("next"), dashboard));
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
    });
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Registreringen misslyckades." };
  }
  redirect("/logga-in?verifiering=skickad");
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

  const profile = await findUserForPasswordReset(email);
  if (profile) {
    const redirectTo = `${getAppUrl()}/auth/callback?next=/aterstall-losenord`;
    let dispatched = false;

    try {
      if (process.env.RESEND_API_KEY?.trim()) {
        try {
          const admin = createAdminClient();
          const { data, error } = await admin.auth.admin.generateLink({
            type: "recovery",
            email,
            options: { redirectTo },
          });
          if (error || !data.properties?.action_link) {
            throw new Error(error?.message ?? "Återställningslänken kunde inte skapas.");
          }
          await sendPasswordResetEmail(email, data.properties.action_link);
          dispatched = true;
        } catch (resendError) {
          console.error("FaddeBo Resend password reset failed; trying Supabase SMTP", resendError);
        }
      }

      if (!dispatched) {
        // Supabase Auth SMTP is both the no-Resend path and a delivery fallback
        // when Resend is temporarily unavailable or misconfigured.
        const supabase = await createServerSupabaseClient();
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) throw new Error(error.message);
        dispatched = true;
      }

      if (dispatched) {
        await audit({
          organizationId: profile.organizationId,
          userId: profile.id,
          action: "password_reset_requested",
          entityType: "user",
          entityId: profile.id,
        });
      }
    } catch (error) {
      // Keep the public response non-enumerating, but preserve an operational
      // error in server logs so a missing SMTP/Resend setup is visible.
      console.error("FaddeBo password reset dispatch failed", error);
    }
  }
  return { status: "success", message: "Om e-postadressen finns hos oss har vi skickat en återställningslänk." };
}

export async function resendConfirmationAction(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  if (!z.string().email().safeParse(email).success) {
    return { status: "error", message: "Ange en giltig e-postadress." };
  }

  const supabase = await createServerSupabaseClient();
  await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${getAppUrl()}/auth/callback?next=/mina-sidor` },
  });

  return {
    status: "success",
    message: "Om kontot väntar på verifiering har vi skickat ett nytt bekräftelsemejl.",
  };
}

export async function resetPasswordAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");
  if (password.length < 10) return { status: "error", message: "Lösenordet måste vara minst 10 tecken." };
  if (password !== passwordConfirm) return { status: "error", message: "Lösenorden stämmer inte överens." };
  const supabase = await createServerSupabaseClient();
  const { data: current } = await supabase.auth.getUser();
  if (!current.user) return { status: "error", message: "Återställningssessionen saknas eller har gått ut." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { status: "error", message: error.message };

  const profile = await findUserByAuthId(current.user.id);
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
