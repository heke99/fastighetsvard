import Link from "next/link";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Logga in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; verifiering?: string }>;
}) {
  const { next, verifiering } = await searchParams;
  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-stone-900">Logga in</h1>
      <p className="mt-1 text-stone-500">
        Till Mina sidor – för hyresgäster och bostadssökande.
      </p>
      {verifiering === "skickad" && (
        <div role="status" className="mt-5 rounded-lg bg-brand-50 p-3 text-sm font-medium text-brand-800">
          Kontrollera din e-post och öppna verifieringslänken innan du loggar in.
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
