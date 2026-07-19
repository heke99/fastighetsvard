import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ListingCard, type ListingWithUnit } from "@/components/ListingCard";

export const metadata = { title: "Mina favoriter" };

export default async function FavoritesPage() {
  const user = await getCurrentUser();
  if (!user?.personId) redirect("/logga-in");

  const favorites = await db.favorite.findMany({
    where: { personId: user.personId },
    include: {
      listing: {
        include: {
          unit: { include: { media: { where: { kind: "IMAGE" }, take: 1, orderBy: { sortOrder: "asc" } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-stone-900">Mina favoriter</h1>
        <p className="mt-1 text-stone-500">Annonser du har sparat.</p>
      </header>
      {favorites.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-semibold text-stone-700">Du har inga sparade favoriter.</p>
          <Link href="/lediga-bostader" className="btn-primary mt-4">Sök bostad</Link>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {favorites.map((f) => (
            <ListingCard key={f.id} listing={f.listing as ListingWithUnit} isFavorite />
          ))}
        </div>
      )}
    </div>
  );
}
