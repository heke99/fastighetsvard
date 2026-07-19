"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const groups: { title: string; items: { href: string; label: string }[] }[] = [
  {
    title: "Översikt",
    items: [{ href: "/admin", label: "Dashboard" }],
  },
  {
    title: "Fastigheter",
    items: [
      { href: "/admin/fastigheter", label: "Fastigheter" },
      { href: "/admin/objekt", label: "Objekt" },
      { href: "/admin/annonser", label: "Annonser" },
    ],
  },
  {
    title: "Uthyrning",
    items: [
      { href: "/admin/hyresgaster", label: "Hyresgäster & personer" },
      { href: "/admin/ansokningar", label: "Ansökningar" },
      { href: "/admin/avtal", label: "Avtal" },
      { href: "/admin/uppsagningar", label: "Uppsägningar" },
    ],
  },
  {
    title: "Ekonomi",
    items: [
      { href: "/admin/fakturor", label: "Fakturor" },
      { href: "/admin/integrationer", label: "Integrationer & synk" },
    ],
  },
  {
    title: "Förvaltning",
    items: [
      { href: "/admin/felanmalan", label: "Felanmälningar" },
      { href: "/admin/arbetsorder", label: "Arbetsorder" },
      { href: "/admin/entreprenorer", label: "Entreprenörer" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/admin/webhooks", label: "Webhooks" },
      { href: "/admin/api-nycklar", label: "API-nycklar" },
      { href: "/admin/anvandare", label: "Användare & roller" },
      { href: "/admin/rapporter", label: "Rapporter" },
      { href: "/admin/revisionslogg", label: "Revisionslogg" },
    ],
  },
];

export function AdminNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav aria-label="Adminmeny" className="w-60 shrink-0 space-y-5 p-4">
      {groups.map((group) => (
        <div key={group.title}>
          <h2 className="mb-1.5 px-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
            {group.title}
          </h2>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active =
                item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`block rounded-md px-2 py-1.5 text-sm font-medium transition ${
                      active ? "bg-brand-50 text-brand-800" : "text-stone-600 hover:bg-stone-100"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      <div className="hidden border-r border-stone-200 bg-white lg:block">{nav}</div>
      <div className="fixed bottom-4 left-4 z-40 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="btn-primary shadow-lg"
        >
          {open ? "Stäng meny" : "Adminmeny"}
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-30 bg-stone-900/40 lg:hidden" onClick={() => setOpen(false)}>
          <div
            className="h-full w-72 overflow-y-auto bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {nav}
          </div>
        </div>
      )}
    </>
  );
}
