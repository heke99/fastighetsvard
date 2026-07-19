"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "./Logo";

interface HeaderUser {
  name: string;
  isStaff: boolean;
}

const publicNav = [
  { href: "/", label: "Startsida" },
  { href: "/lediga-bostader", label: "Lediga bostäder" },
  { href: "/till-salu", label: "Till salu" },
  { href: "/lokaler", label: "Lokaler" },
  { href: "/parkering", label: "Parkeringar" },
  { href: "/vara-fastigheter", label: "Våra fastigheter" },
  { href: "/felanmalan", label: "Felanmälan" },
  { href: "/kontakt", label: "Kontakt" },
];

const userNav = [
  { href: "/mina-sidor", label: "Mina sidor" },
  { href: "/mina-sidor/ansokningar", label: "Mina ansökningar" },
  { href: "/mina-sidor/avtal", label: "Mina avtal" },
  { href: "/mina-sidor/fakturor", label: "Mina fakturor" },
  { href: "/mina-sidor/felanmalan", label: "Mina felanmälningar" },
  { href: "/mina-sidor/meddelanden", label: "Meddelanden" },
  { href: "/mina-sidor/profil", label: "Profil" },
];

export function SiteHeader({ user }: { user: HeaderUser | null }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const mobileRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Stäng menyer vid navigering.
  useEffect(() => {
    setMobileOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  // Escape stänger mobilmeny; fokusfälla i mobil meny.
  useEffect(() => {
    if (!mobileOpen) return;
    closeButtonRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
      if (e.key === "Tab" && mobileRef.current) {
        const focusables = mobileRef.current.querySelectorAll<HTMLElement>(
          'a, button, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  // Klick utanför stänger användarmenyn.
  useEffect(() => {
    if (!userMenuOpen) return;
    function onClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [userMenuOpen]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 backdrop-blur">
      <a
        href="#huvudinnehall"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-brand-700 focus:px-3 focus:py-2 focus:text-white"
      >
        Hoppa till huvudinnehåll
      </a>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />

        <nav aria-label="Huvudmeny" className="hidden xl:block">
          <ul className="flex items-center gap-1">
            {publicNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition hover:bg-stone-100 hover:text-brand-800 ${
                    isActive(item.href)
                      ? "bg-brand-50 text-brand-800"
                      : "text-stone-600"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-2 xl:flex">
          {user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                className="btn-secondary"
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                onClick={() => setUserMenuOpen((o) => !o)}
              >
                <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-800">
                  {user.name.charAt(0).toUpperCase()}
                </span>
                {user.name}
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </button>
              {userMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-56 rounded-xl border border-stone-200 bg-white py-2 shadow-lg"
                >
                  {userNav.map((item) => (
                    <Link
                      key={item.href}
                      role="menuitem"
                      href={item.href}
                      className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
                    >
                      {item.label}
                    </Link>
                  ))}
                  {user.isStaff && (
                    <Link
                      role="menuitem"
                      href="/admin"
                      className="block border-t border-stone-100 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-stone-50"
                    >
                      Administration
                    </Link>
                  )}
                  <form action="/api/auth/logout" method="POST" className="border-t border-stone-100">
                    <button
                      role="menuitem"
                      type="submit"
                      className="block w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                    >
                      Logga ut
                    </button>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/logga-in" className="btn-secondary">
                Logga in
              </Link>
              <Link href="/skapa-konto" className="btn-primary">
                Skapa konto
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="btn-secondary xl:hidden"
          aria-expanded={mobileOpen}
          aria-controls="mobilmeny"
          onClick={() => setMobileOpen(true)}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Meny
        </button>
      </div>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-stone-900/50 xl:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <div
        id="mobilmeny"
        ref={mobileRef}
        role="dialog"
        aria-modal="true"
        aria-label="Mobilmeny"
        className={`fixed inset-y-0 right-0 z-50 w-80 max-w-[90vw] transform overflow-y-auto bg-white shadow-xl transition-transform xl:hidden ${
          mobileOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-stone-200 p-4">
          <span className="text-sm font-semibold text-stone-900">Meny</span>
          <button
            ref={closeButtonRef}
            type="button"
            className="btn-secondary"
            onClick={() => setMobileOpen(false)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Stäng
          </button>
        </div>
        <nav aria-label="Mobilmeny" className="p-4">
          <ul className="space-y-1">
            {publicNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={`block rounded-md px-3 py-2.5 text-sm font-medium ${
                    isActive(item.href)
                      ? "bg-brand-50 text-brand-800"
                      : "text-stone-700 hover:bg-stone-50"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-stone-200 pt-4">
            {user ? (
              <ul className="space-y-1">
                {userNav.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="block rounded-md px-3 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
                {user.isStaff && (
                  <li>
                    <Link
                      href="/admin"
                      className="block rounded-md px-3 py-2.5 text-sm font-semibold text-brand-700 hover:bg-stone-50"
                    >
                      Administration
                    </Link>
                  </li>
                )}
                <li>
                  <form action="/api/auth/logout" method="POST">
                    <button
                      type="submit"
                      className="block w-full rounded-md px-3 py-2.5 text-left text-sm font-medium text-red-700 hover:bg-red-50"
                    >
                      Logga ut
                    </button>
                  </form>
                </li>
              </ul>
            ) : (
              <div className="flex flex-col gap-2">
                <Link href="/logga-in" className="btn-secondary w-full">
                  Logga in
                </Link>
                <Link href="/skapa-konto" className="btn-primary w-full">
                  Skapa konto
                </Link>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
