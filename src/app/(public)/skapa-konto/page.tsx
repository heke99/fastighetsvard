import Link from "next/link";
import { RegisterForm } from "./RegisterForm";

export const metadata = { title: "Skapa konto" };

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-stone-900">Skapa konto</h1>
      <p className="mt-1 text-stone-500">
        Med ett konto kan du söka bostäder, spara favoriter och följa dina
        ansökningar. Är du redan hyresgäst kopplas ditt konto automatiskt till
        ditt hyresförhållande via din e-postadress.
      </p>
      <RegisterForm />
      <p className="mt-6 text-sm text-stone-600">
        Har du redan ett konto?{" "}
        <Link href="/logga-in" className="font-medium text-brand-700 hover:underline">
          Logga in
        </Link>
      </p>
    </div>
  );
}
