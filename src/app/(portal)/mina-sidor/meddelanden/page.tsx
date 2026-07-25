import { redirect } from "next/navigation";
import { getBranding } from "@/lib/branding";
import { getCurrentUser } from "@/lib/auth";
import {
  listMyMessagesAndNotifications,
  markMyMessagesAndNotificationsRead,
} from "@/lib/repositories/portal-records";

export const metadata = { title: "Meddelanden" };

export default async function MessagesPage() {
  const brand = getBranding();
  const user = await getCurrentUser();
  if (!user?.personId) redirect("/logga-in");

  const { messages, notifications } =
    await listMyMessagesAndNotifications(user.personId);

  // Markera som lästa när sidan öppnas.
  await markMyMessagesAndNotificationsRead(user.personId);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-stone-900">Meddelanden</h1>
        <p className="mt-1 text-stone-500">Meddelanden och notiser från {brand.brandName}.</p>
      </header>

      {messages.length === 0 && notifications.length === 0 ? (
        <div className="card p-10 text-center text-stone-500">Du har inga meddelanden.</div>
      ) : (
        <>
          {messages.length > 0 && (
            <section aria-labelledby="meddelanden" className="card divide-y divide-stone-100">
              <h2 id="meddelanden" className="px-5 pt-4 font-semibold text-stone-900">Meddelanden</h2>
              {messages.map((m) => (
                <article key={m.id} className="p-5">
                  <header className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-stone-900">{m.subject}</h3>
                    <time dateTime={String(m.createdAt)} className="text-xs text-stone-400">
                      {new Date(m.createdAt).toLocaleString("sv-SE")}
                    </time>
                  </header>
                  <p className="text-sm text-stone-500">
                    Från: {m.sender ? `${m.sender.firstName} ${m.sender.lastName}` : brand.brandName}
                  </p>
                  <p className="mt-2 whitespace-pre-line text-sm text-stone-700">{m.body}</p>
                </article>
              ))}
            </section>
          )}
          {notifications.length > 0 && (
            <section aria-labelledby="notiser" className="card divide-y divide-stone-100">
              <h2 id="notiser" className="px-5 pt-4 font-semibold text-stone-900">Notiser</h2>
              {notifications.map((n) => (
                <div key={n.id} className="flex items-start justify-between gap-3 p-5">
                  <div>
                    <p className="font-medium text-stone-900">{n.title}</p>
                    <p className="mt-0.5 text-sm text-stone-600">{n.body}</p>
                  </div>
                  <time dateTime={String(n.createdAt)} className="shrink-0 text-xs text-stone-400">
                    {new Date(n.createdAt).toLocaleDateString("sv-SE")}
                  </time>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
