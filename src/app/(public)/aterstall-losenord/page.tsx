import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./ResetPasswordForm";
export const metadata = { title: "Återställ lösenord" };
export const dynamic = "force-dynamic";
export default async function ResetPasswordPage() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/glomt-losenord?utgangen=1");
  return <div className="mx-auto max-w-md px-4 py-12 sm:px-6"><h1 className="text-2xl font-bold text-stone-900">Välj nytt lösenord</h1><ResetPasswordForm /></div>;
}
