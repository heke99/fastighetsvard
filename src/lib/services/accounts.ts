import { prisma } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";
import { sha256 } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { ensurePersonRole } from "@/lib/services/tenants";

/** Plattformen körs för en organisation: Östgöta El Teknik. */
export async function getDefaultOrganization() {
  const org = await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) throw new Error("Ingen organisation är konfigurerad. Kör seed-skriptet.");
  return org;
}

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
}

/**
 * Registrera nytt konto. Om en person med samma e-post redan finns (t.ex.
 * en befintlig hyresgäst som administratören lagt in) kopplas kontot till
 * den personen i stället för att skapa en dubblett.
 */
export async function registerAccount(input: RegisterInput, ip?: string) {
  const email = input.email.toLowerCase().trim();
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error("Det finns redan ett konto med denna e-postadress.");
  }
  const org = await getDefaultOrganization();

  const user = await prisma.$transaction(async (tx) => {
    let person = await tx.person.findFirst({
      where: { organizationId: org.id, email },
    });
    if (person) {
      const linked = await tx.user.findFirst({ where: { personId: person.id } });
      if (linked) throw new Error("Det finns redan ett konto kopplat till denna person.");
    } else {
      person = await tx.person.create({
        data: {
          organizationId: org.id,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          email,
          phone: input.phone ?? null,
        },
      });
    }
    await ensurePersonRole(tx, person.id, "APPLICANT");

    const created = await tx.user.create({
      data: {
        organizationId: org.id,
        personId: person.id,
        email,
        passwordHash: await hashPassword(input.password),
      },
    });

    await tx.notification.create({
      data: {
        organizationId: org.id,
        personId: person.id,
        eventType: "account_created",
        title: "Välkommen till Östgöta El Teknik",
        body: "Ditt konto är skapat. Här på Mina sidor ser du ansökningar, avtal, fakturor och felanmälningar.",
      },
    });

    await audit(
      {
        organizationId: org.id,
        userId: created.id,
        action: "account_registered",
        entityType: "user",
        entityId: created.id,
        ip,
      },
      tx
    );
    return created;
  });

  const { token } = await createSession(user.id, ip);
  return { user, token };
}

/**
 * Aktivera konto via inbjudan (befintlig hyresgäst).
 */
export async function activateInvitation(token: string, password: string, ip?: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: sha256(token) },
    include: { person: true },
  });
  if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
    throw new Error("Inbjudan är ogiltig eller har gått ut.");
  }
  const existingUser = await prisma.user.findUnique({ where: { email: invitation.email } });
  if (existingUser) throw new Error("Det finns redan ett konto med denna e-postadress.");

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        organizationId: invitation.organizationId,
        personId: invitation.personId,
        email: invitation.email,
        passwordHash: await hashPassword(password),
        emailVerifiedAt: new Date(), // e-post verifierad via inbjudningslänken
      },
    });
    await tx.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });
    await audit(
      {
        organizationId: invitation.organizationId,
        userId: created.id,
        action: "invitation_accepted",
        entityType: "invitation",
        entityId: invitation.id,
        ip,
      },
      tx
    );
    return created;
  });

  const { token: sessionToken } = await createSession(user.id, ip);
  return { user, token: sessionToken };
}
