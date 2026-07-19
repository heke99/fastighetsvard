import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata = { title: "Glömt lösenord" };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-stone-900">Glömt lösenord</h1>
      <p className="mt-1 text-stone-500">
        Ange din e-postadress så skickar vi en länk för att välja ett nytt lösenord.
      </p>
      <ForgotPasswordForm />
    </div>
  );
}
