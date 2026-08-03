import Link from "next/link";
import { LoginForm } from "./LoginForm";
import { ResendConfirmationForm } from "./ResendConfirmationForm";

export const metadata = { title: "Logga in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string;
    verifiering?: string;
    authfel?: string;
    aterstallt?: string;
  }>;
}) {
  const { next, verifiering, authfel, aterstallt } = await searchParams;
  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-stone-900">Logga in</h1>
      <p className="mt-1 text-stone-500">
        Till Mina sidor – för hyresgäster och bostadssökande.
      </p>
      {verifiering === "skickad" && (
        <div className="mt-5 rounded-lg bg-brand-50 p-3 text-sm text-brand-800">
          <p role="status" className="font-medium">
            Kontrollera din e-post och öppna bekräftelselänken innan du loggar in.
          </p>
          <ResendConfirmationForm />
        </div>
      )}
      {authfel === "1" && (
        <div role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">
          Länken kunde inte verifieras eller har gått ut. Begär en ny länk och försök igen.
        </div>
      )}
      {aterstallt === "1" && (
        <div role="status" className="mt-5 rounded-lg bg-brand-50 p-3 text-sm font-medium text-brand-800">
          Ditt lösenord är uppdaterat. Logga in med det nya lösenordet.
        </div>
      )}
      <LoginForm next={next} />
      <div className="mt-6 space-y-2 text-sm">
        <p>
          <Link href="/glomt-losenord" className="font-medium text-brand-700 hover:underline">
            Glömt lösenord?
          </Link>
        </p>
        <p className="text-stone-600">
          Inget konto?{" "}
          <Link href="/skapa-konto" className="font-medium text-brand-700 hover:underline">
            Skapa konto
          </Link>
        </p>
      </div>
    </div>
  );
}
