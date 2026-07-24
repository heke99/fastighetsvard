import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { getAppUrl } from "@/lib/app-url";
import { claimInvitation } from "@/lib/repositories/rental-operations";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/** Plattformen körs för en organisation. Används av kontrollerade adminflöden. */
export async function getDefaultOrganization() {
  const org = await db.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) throw new Error("Ingen organisation är konfigurerad. Kör Supabase-seedningen.");
  return org;
}

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
}

async function signIn(email: string, password: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error("Kontot aktiverades men automatisk inloggning misslyckades.");
  return data.session;
}

/**
 * Vanlig självregistrering går alltid genom Supabase verifieringsmejl.
 * Appens User/Person skapas först av databastriggern när email_confirmed_at finns.
 * Därmed kan självregistrering aldrig claima en importerad person via e-postmatchning.
 */
export async function registerAccount(input: RegisterInput) {
  const email = input.email.toLowerCase().trim();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      emailRedirectTo: `${getAppUrl()}/auth/callback?next=/mina-sidor`,
      data: {
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
        phone: input.phone?.trim() || null,
        claim_mode: "self_signup",
      },
    },
  });

  if (error) throw new Error(error.message || "Kunde inte skapa konto.");
  if (!data.user) throw new Error("Kunde inte skapa konto.");
  if (data.session) {
    // E-postverifiering ska vara aktiverad i Supabase. En oväntad direkt session
    // får inte användas som appkonto innan databastriggern har verifierat användaren.
    await supabase.auth.signOut();
    throw new Error("E-postverifiering är inte aktiverad i Supabase-projektet. Registreringen stoppades.");
  }

  return { authUserId: data.user.id, verificationPending: true as const };
}

/**
 * Aktivera en importerad person via en person-, organisations- och e-postbunden
 * engångsinbjudan. Den slutliga claimen sker atomiskt i PostgreSQL.
 */
export async function activateInvitation(token: string, password: string, _ip?: string) {
  const tokenHash = sha256(token);
  const invitation = await db.invitation.findUnique({
    where: { tokenHash },
    include: { person: true },
  });
  if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
    throw new Error("Inbjudan är ogiltig eller har gått ut.");
  }

  const admin = createAdminClient();
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: invitation.email,
    password,
    // Detta är inte vanlig självregistrering. E-postinnehavet verifieras genom
    // den single-use token som skickades till den bundna adressen.
    email_confirm: true,
    user_metadata: {
      first_name: invitation.person.firstName,
      last_name: invitation.person.lastName,
      claim_mode: "invitation",
      invitation_id: invitation.id,
    },
  });
  if (authError || !authData.user) throw new Error(authError?.message ?? "Kunde inte aktivera kontot.");

  try {
    const claimed = await claimInvitation({ tokenHash, authUserId: authData.user.id });
    const session = await signIn(invitation.email, password);
    return { user: claimed, session };
  } catch (error) {
    await admin.auth.admin.deleteUser(authData.user.id).catch(() => undefined);
    throw error;
  }
}
