"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteSavedSearchButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    await fetch(`/api/auth/saved-searches?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={pending}
      className="btn-secondary text-red-700 hover:bg-red-50"
    >
      {pending ? "Tar bort …" : "Ta bort"}
    </button>
  );
}
