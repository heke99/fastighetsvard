import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Felanmälan" };
export const dynamic = "force-dynamic";

export default async function PublicMaintenancePage() {
  const user = await getCurrentUser();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl">Felanmälan</h1>
      <p className="mt-2 text-stone-600">
        Har det uppstått ett fel i din bostad, lokal eller i fastigheten? Anmäl
        det till oss så åtgärdar vi det så snart som möjligt.
      </p>

      <div className="card mt-6 border-l-4 border-l-red-500 p-5">
        <h2 className="font-semibold text-stone-900">Akuta fel</h2>
        <p className="mt-1 text-sm text-stone-600">
          Vid akuta fel som vattenläckor, elavbrott eller inbrott – ring oss direkt
          på <a href="tel:+4613100000" className="font-semibold text-brand-700">013-10 00 00</a> (kontorstid)
          eller <a href="tel:+4613100001" className="font-semibold text-brand-700">013-10 00 01</a> (jour, dygnet runt).
        </p>
      </div>

      <div className="card mt-4 p-5">
        <h2 className="font-semibold text-stone-900">Anmäl via Mina sidor</h2>
        <p className="mt-1 text-sm text-stone-600">
          Som hyresgäst gör du enklast din felanmälan via Mina sidor. Där kan du
          beskriva felet, bifoga bilder, välja om vi får använda huvudnyckel och
          följa ärendets status hela vägen till åtgärd.
        </p>
        <div className="mt-4">
          {user ? (
            <Link href="/mina-sidor/felanmalan/ny" className="btn-primary">
              Gör felanmälan
            </Link>
          ) : (
            <Link href="/logga-in?next=/mina-sidor/felanmalan/ny" className="btn-primary">
              Logga in och gör felanmälan
            </Link>
          )}
        </div>
      </div>

      <div className="card mt-4 p-5">
        <h2 className="font-semibold text-stone-900">Inte hyresgäst?</h2>
        <p className="mt-1 text-sm text-stone-600">
          Om du vill anmäla ett fel i en av våra fastigheter utan att vara hyresgäst,
          kontakta oss på{" "}
          <a href="mailto:felanmalan@ostgotaelteknik.se" className="font-medium text-brand-700 underline">
            felanmalan@ostgotaelteknik.se
          </a>{" "}
          och beskriv fastighet, plats och fel.
        </p>
      </div>
    </div>
  );
}
