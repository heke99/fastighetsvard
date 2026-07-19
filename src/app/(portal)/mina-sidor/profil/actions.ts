"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";

export interface ProfileFormState {
  status: "idle" | "error" | "success";
  message?: string;
}

const schema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().max(30).optional(),
  address: z.string().max(200).optional(),
  postalCode: z.string().max(10).optional(),
  city: z.string().max(100).optional(),
});

export async function updateProfileAction(
  _prev: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const user = await getCurrentUser();
  if (!user?.personId) return { status: "error", message: "Inloggning krävs." };

  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { status: "error", message: "Kontrollera fälten." };
  }

  const before = await prisma.person.findUnique({ where: { id: user.personId } });
  await prisma.person.update({
    where: { id: user.personId },
    data: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      postalCode: parsed.data.postalCode || null,
      city: parsed.data.city || null,
    },
  });
  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "profile_updated",
    entityType: "person",
    entityId: user.personId,
    before: { phone: before?.phone, address: before?.address },
    after: parsed.data,
  });

  revalidatePath("/mina-sidor/profil");
  return { status: "success" };
}
