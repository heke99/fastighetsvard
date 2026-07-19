import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { ensurePersonRole } from "@/lib/services/tenants";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/** Plattformen körs för en organisation: Östgöta El Teknik. */
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
  if (error) throw new Error("Kontot skapades men automatisk inloggning misslyckades.");
  return data.session;
}

export async function registerAccount(input: RegisterInput, ip?: string) {
  const email = input.email.toLowerCase().trim();
  if (await db.user.findUnique({ where: { email } })) {
    throw new Error("Det finns redan ett konto med denna e-postadress.");
  }
  const org = await getDefaultOrganization();
  const admin = createAdminClient();
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { first_name: input.firstName.trim(), last_name: input.lastName.trim() },
  });
  if (authError || !authData.user) throw new Error(authError?.message ?? "Kunde inte skapa konto.");

  try {
    let person = await db.person.findFirst({ where: { organizationId: org.id, email } });
    if (person) {
      if (await db.user.findFirst({ where: { personId: person.id } })) {
        throw new Error("Det finns redan ett konto kopplat till denna person.");
      }
    } else {
      person = await db.person.create({
        data: {
          organizationId: org.id,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          email,
          phone: input.phone ?? null,
        },
      });
    }
    await ensurePersonRole(db, person.id, "APPLICANT");

    const user = await db.user.create({
      data: {
        authUserId: authData.user.id,
        organizationId: org.id,
        personId: person.id,
        email,
        emailVerifiedAt: new Date(),
        isActive: true,
      },
    });
    await db.notification.create({
      data: {
        organizationId: org.id,
        personId: person.id,
        eventType: "account_created",
        title: "Välkommen till Östgöta El Teknik",
        body: "Ditt konto är skapat. Här på Mina sidor ser du ansökningar, avtal, fakturor och felanmälningar.",
      },
    });
    await audit({
      organizationId: org.id,
      userId: user.id,
      action: "account_registered",
      entityType: "user",
      entityId: user.id,
      ip,
    });
    const session = await signIn(email, input.password);
    return { user, session };
  } catch (error) {
    await admin.auth.admin.deleteUser(authData.user.id).catch(() => undefined);
    throw error;
  }
}

/** Aktivera konto via inbjudan för en befintlig hyresgäst. */
export async function activateInvitation(token: string, password: string, ip?: string) {
  const invitation = await db.invitation.findUnique({
    where: { tokenHash: sha256(token) },
    include: { person: true },
  });
  if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
    throw new Error("Inbjudan är ogiltig eller har gått ut.");
  }
  if (await db.user.findUnique({ where: { email: invitation.email } })) {
    throw new Error("Det finns redan ett konto med denna e-postadress.");
  }

  const admin = createAdminClient();
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: invitation.email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: invitation.person.firstName,
      last_name: invitation.person.lastName,
    },
  });
  if (authError || !authData.user) throw new Error(authError?.message ?? "Kunde inte aktivera kontot.");

  try {
    const user = await db.user.create({
      data: {
        authUserId: authData.user.id,
        organizationId: invitation.organizationId,
        personId: invitation.personId,
        email: invitation.email,
        emailVerifiedAt: new Date(),
        isActive: true,
      },
    });
    await db.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
    await audit({
      organizationId: invitation.organizationId,
      userId: user.id,
      action: "invitation_accepted",
      entityType: "invitation",
      entityId: invitation.id,
      ip,
    });
    const session = await signIn(invitation.email, password);
    return { user, session };
  } catch (error) {
    await admin.auth.admin.deleteUser(authData.user.id).catch(() => undefined);
    throw error;
  }
}
