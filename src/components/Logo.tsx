import Link from "next/link";

export function Logo({ variant = "dark" }: { variant?: "dark" | "light" }) {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 shrink-0"
      aria-label="Östgöta El Teknik – till startsidan"
    >
      <span
        aria-hidden="true"
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-700 text-white"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M13 2 4.5 13.5h5L9 22l8.5-11.5h-5L13 2Z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="leading-tight">
        <span
          className={`block text-base font-bold tracking-tight ${
            variant === "light" ? "text-white" : "text-stone-900"
          }`}
        >
          Östgöta El Teknik
        </span>
        <span
          className={`block text-[11px] font-medium uppercase tracking-widest ${
            variant === "light" ? "text-brand-200" : "text-brand-700"
          }`}
        >
          Fastigheter
        </span>
      </span>
    </Link>
  );
}
