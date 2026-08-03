"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { hasPermission, type Action, type Resource } from "@/lib/permissions";

interface NavItem {
  href: string;
  label: string;
  permission?: { resource: Resource; action: Action };
}

const groups: { title: string; items: NavItem[] }[] = [
  {
    title: "Översikt",
    items: [{ href: "/admin", label: "Dashboard" }],
  },
  {
    title: "Fastigheter",
    items: [
      { href: "/admin/fastigheter", label: "Fastigheter", permission: { resource: "properties", action: "read" } },
      { href: "/admin/objekt", label: "Objekt", permission: { resource: "units", action: "read" } },
      { href: "/admin/annonser", label: "Annonser", permission: { resource: "listings", action: "read" } },
    ],
  },
  {
    title: "Uthyrning",
    items: [
      { href: "/admin/hyresgaster", label: "Hyresgäster & personer", permission: { resource: "persons", action: "read" } },
      { href: "/admin/ansokningar", label: "Ansökningar", permission: { resource: "applications", action: "read" } },
      { href: "/admin/avtal", label: "Avtal", permission: { resource: "contracts", action: "read" } },
      { href: "/admin/uppsagningar", label: "Uppsägningar", permission: { resource: "terminations", action: "read" } },
    ],
  },
  {
    title: "Ekonomi",
    items: [
      { href: "/admin/fakturor", label: "Fakturor", permission: { resource: "invoices", action: "read" } },
      { href: "/admin/integrationer", label: "Integrationer & synk", permission: { resource: "integrations", action: "read" } },
    ],
  },
  {
    title: "Förvaltning",
    items: [
      { href: "/admin/felanmalan", label: "Felanmälningar", permission: { resource: "maintenance", action: "read" } },
      { href: "/admin/arbetsorder", label: "Arbetsorder", permission: { resource: "workorders", action: "read" } },
      { href: "/admin/entreprenorer", label: "Entreprenörer", permission: { resource: "suppliers", action: "read" } },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/admin/webhooks", label: "Webhooks", permission: { resource: "webhooks", action: "read" } },
      { href: "/admin/api-nycklar", label: "API-nycklar", permission: { resource: "apikeys", action: "read" } },
      { href: "/admin/anvandare", label: "Användare & roller", permission: { resource: "users", action: "read" } },
      { href: "/admin/rapporter", label: "Rapporter", permission: { resource: "reports", action: "read" } },
      { href: "/admin/revisionslogg", label: "Revisionslogg", permission: { resource: "audit", action: "read" } },
    ],
  },
];

export function AdminNav({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.permission || hasPermission(permissions, item.permission.resource, item.permission.action)
      ),
    }))
    .filter((group) => group.items.length > 0);

  const nav = (
    <nav aria-label="Adminmeny" className="w-60 shrink-0 space-y-5 p-4">
      {visibleGroups.map((group) => (
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
          onClick={() => setOpen((value) => !value)}
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
            onClick={(event) => event.stopPropagation()}
          >
            {nav}
          </div>
        </div>
      )}
    </>
  );
}
