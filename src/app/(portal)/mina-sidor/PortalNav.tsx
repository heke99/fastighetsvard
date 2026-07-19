"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/mina-sidor", label: "Översikt", exact: true },
  { href: "/mina-sidor/boende", label: "Mitt boende" },
  { href: "/mina-sidor/avtal", label: "Mina avtal" },
  { href: "/mina-sidor/fakturor", label: "Mina fakturor" },
  { href: "/mina-sidor/ansokningar", label: "Mina ansökningar" },
  { href: "/lediga-bostader", label: "Sök bostad" },
  { href: "/mina-sidor/favoriter", label: "Mina favoriter" },
  { href: "/mina-sidor/bevakningar", label: "Mina bevakningar" },
  { href: "/mina-sidor/felanmalan", label: "Felanmälan" },
  { href: "/mina-sidor/dokument", label: "Dokument" },
  { href: "/mina-sidor/meddelanden", label: "Meddelanden" },
  { href: "/mina-sidor/profil", label: "Min profil" },
];

export function PortalNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Mina sidor">
      <ul className="card divide-y divide-stone-100 overflow-hidden lg:sticky lg:top-24">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`block px-4 py-2.5 text-sm font-medium transition ${
                  active
                    ? "border-l-4 border-brand-700 bg-brand-50 pl-3 text-brand-800"
                    : "text-stone-700 hover:bg-stone-50"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
        <li>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="block w-full px-4 py-2.5 text-left text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Logga ut
            </button>
          </form>
        </li>
      </ul>
    </nav>
  );
}
