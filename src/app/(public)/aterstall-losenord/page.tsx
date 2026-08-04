import { createServerSupabaseClient } from "@/lib/supabase/server";
import { RecoverySessionGate } from "./RecoverySessionGate";

export const metadata = { title: "Återställ lösenord" };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-stone-900">Välj nytt lösenord</h1>
      <RecoverySessionGate hasServerSession={Boolean(data.user)} />
    </div>
  );
}
