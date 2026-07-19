import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { ActivateForm } from "./ActivateForm";

export const metadata = { title: "Aktivera konto" };
export const dynamic = "force-dynamic";

export default async function ActivatePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await db.invitation.findUnique({
    where: { tokenHash: sha256(token) },
    include: { person: { select: { firstName: true } } },
  });
  const valid = invitation && !invitation.acceptedAt && invitation.expiresAt > new Date();

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-stone-900">Aktivera ditt konto</h1>
      {valid ? (
        <>
          <p className="mt-1 text-stone-500">
            Hej {invitation.person.firstName}! Välj ett lösenord för att aktivera
            ditt konto på Mina sidor. Här ser du sedan ditt avtal, dina fakturor och
            kan göra felanmälningar.
          </p>
          <ActivateForm token={token} />
        </>
      ) : (
        <div role="alert" className="card mt-6 p-6 text-sm text-stone-700">
          <p className="font-semibold text-red-700">Inbjudan är ogiltig eller har gått ut.</p>
          <p className="mt-2">
            Kontakta oss på{" "}
            <a href="mailto:info@ostgotaelteknik.se" className="text-brand-700 underline">
              info@ostgotaelteknik.se
            </a>{" "}
            så skickar vi en ny inbjudan.
          </p>
        </div>
      )}
    </div>
  );
}
