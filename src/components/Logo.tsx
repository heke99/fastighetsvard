import Image from "next/image";
import Link from "next/link";
import { getBranding } from "@/lib/branding";

export function Logo({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const brand = getBranding();
  const light = variant === "light";

  return (
    <Link
      href="/"
      className="flex shrink-0 items-center gap-2.5"
      aria-label={`${brand.brandName} – till startsidan`}
    >
      <span
        aria-hidden="true"
        className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full ${
          light ? "bg-white p-0.5" : "bg-white"
        }`}
      >
        <Image
          src="/brand/faddebo-mark.png"
          alt=""
          width={44}
          height={44}
          priority
          className="h-full w-full object-contain"
        />
      </span>
      <span className="leading-none">
        <span
          className={`block font-serif text-[1.12rem] tracking-[0.22em] ${
            light ? "text-white" : "text-[#153d20]"
          }`}
        >
          FADDEBO
        </span>
        <span
          className={`mt-1 block text-[9px] font-semibold uppercase tracking-[0.2em] ${
            light ? "text-brand-200" : "text-brand-700"
          }`}
        >
          {brand.tagline}
        </span>
      </span>
    </Link>
  );
}
