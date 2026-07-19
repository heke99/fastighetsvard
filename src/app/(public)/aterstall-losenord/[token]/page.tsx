import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata = { title: "Återställ lösenord" };

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-stone-900">Välj nytt lösenord</h1>
      <ResetPasswordForm token={token} />
    </div>
  );
}
