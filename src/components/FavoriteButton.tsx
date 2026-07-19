"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function FavoriteButton({
  listingId,
  initialFavorite,
}: {
  listingId: string;
  initialFavorite: boolean;
}) {
  const [favorite, setFavorite] = useState(initialFavorite);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const res = await fetch("/api/auth/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId }),
    });
    if (res.status === 401) {
      router.push(`/logga-in?next=/annons`);
      return;
    }
    if (res.ok) {
      const data = await res.json();
      startTransition(() => setFavorite(data.favorite));
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={favorite}
      aria-label={favorite ? "Ta bort favorit" : "Spara som favorit"}
      className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-sm transition hover:scale-110"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 21s-7.5-4.7-9.7-9.2C.8 8.6 2.4 5 5.7 5c2 0 3.4 1.1 4.3 2.6h4c.9-1.5 2.3-2.6 4.3-2.6 3.3 0 4.9 3.6 3.4 6.8C19.5 16.3 12 21 12 21Z"
          fill={favorite ? "#dc2626" : "none"}
          stroke={favorite ? "#dc2626" : "#57534e"}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
