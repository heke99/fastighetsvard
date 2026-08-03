import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata = { title: "Glömt lösenord" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ utgangen?: string }>;
}) {
  const { utgangen } = await searchParams;
  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-stone-900">Glömt lösenord</h1>
      <p className="mt-1 text-stone-500">
        Ange din e-postadress så skickar vi en länk för att välja ett nytt lösenord.
      </p>
      {utgangen === "1" && (
        <div role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">
          Återställningslänken saknas eller har gått ut. Begär en ny länk nedan.
        </div>
      )}
      <ForgotPasswordForm />
    </div>
  );
}
