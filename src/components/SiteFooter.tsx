import Link from "next/link";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-stone-200 bg-brand-950 text-stone-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div>
          <Logo variant="light" />
          <p className="mt-4 text-sm leading-relaxed">
            Östgöta El Teknik äger, förvaltar och hyr ut bostäder, lokaler i Östergötland.
          </p>
        </div>
        <nav aria-label="Bostäder">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white">Utbud</h2>
          <ul className="space-y-2 text-sm">
            <li><Link className="hover:text-white" href="/lediga-bostader">Lediga bostäder</Link></li>
            <li><Link className="hover:text-white" href="/till-salu">Bostäder till salu</Link></li>
            <li><Link className="hover:text-white" href="/lokaler">Lediga lokaler</Link></li>
            <li><Link className="hover:text-white" href="/vara-fastigheter">Våra fastigheter</Link></li>
          </ul>
        </nav>
        <nav aria-label="För hyresgäster">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white">För hyresgäster</h2>
          <ul className="space-y-2 text-sm">
            <li><Link className="hover:text-white" href="/mina-sidor">Mina sidor</Link></li>
            <li><Link className="hover:text-white" href="/felanmalan">Felanmälan</Link></li>
            <li><Link className="hover:text-white" href="/vanliga-fragor">Vanliga frågor</Link></li>
            <li><Link className="hover:text-white" href="/kontakt">Kontakt</Link></li>
          </ul>
        </nav>
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white">Kontakt</h2>
          <address className="not-italic">
            <ul className="space-y-2 text-sm">
              <li>Östgöta El Teknik AB</li>
              <li>VASAVÄGEN 19, 595 40 Mjölby,</li>
              <li>
                <a className="hover:text-white" href="tel:+4613100000">070 0650690</a>
              </li>
              <li>
                <a className="hover:text-white" href="mailto:info@ostgotaelteknik.se">
                  info@ostgotaelteknik.se
                </a>
              </li>
              <li className="pt-2 text-xs text-stone-400">
                Akuta fel utanför kontorstid: <a className="underline hover:text-white" href="tel:+4613100001">013-10 00 01</a>
              </li>
            </ul>
          </address>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-xs text-stone-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Östgöta El Teknik AB. Org.nr 559350-5620. Alla rättigheter förbehållna.</p>
          <div className="flex gap-4">
            <Link className="hover:text-white" href="/integritetspolicy">Integritetspolicy</Link>
            <Link className="hover:text-white" href="/tillganglighet">Tillgänglighet</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
