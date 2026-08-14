"use client";

import { useActionState } from "react";
import { deleteListingMediaAction, setListingMediaCoverAction } from "@/app/admin/actions";
import type { AdminFormState } from "@/app/admin/actions";

const initialState: AdminFormState = { status: "idle" };

export interface ListingMediaItem {
  id: string;
  kind: string;
  url: string;
  caption: string | null;
  sortOrder: number;
}

function MediaActions({ media, isCover }: { media: ListingMediaItem; isCover: boolean }) {
  const [deleteState, deleteAction, deletePending] = useActionState(deleteListingMediaAction, initialState);
  const [coverState, coverAction, coverPending] = useActionState(setListingMediaCoverAction, initialState);
  const message =
    deleteState.status === "error" ? deleteState.message : coverState.status === "error" ? coverState.message : null;

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        {!isCover && (
          <form action={coverAction}>
            <input type="hidden" name="mediaId" value={media.id} />
            <button
              type="submit"
              disabled={coverPending}
              className="text-xs font-medium text-brand-700 underline disabled:opacity-60"
            >
              {coverPending ? "Sätter …" : "Gör till omslag"}
            </button>
          </form>
        )}
        <form action={deleteAction}>
          <input type="hidden" name="mediaId" value={media.id} />
          <button
            type="submit"
            disabled={deletePending}
            className="text-xs font-medium text-red-700 underline disabled:opacity-60"
          >
            {deletePending ? "Tar bort …" : "Ta bort"}
          </button>
        </form>
      </div>
      {message && (
        <p role="alert" className="text-xs text-red-700">{message}</p>
      )}
    </div>
  );
}

/**
 * Bildhantering för ett objekts annonser: förhandsvisning, omslagsbild och
 * borttagning. Borttagningen tar bort både databasposten och filen i Storage.
 */
export function ListingMediaManager({ media }: { media: ListingMediaItem[] }) {
  if (media.length === 0) {
    return <p className="text-xs text-stone-500">Inga bilder uppladdade ännu.</p>;
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {media.map((item, index) => (
        <li key={item.id} className="space-y-1">
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.url}
              alt={item.caption ?? "Objektsbild"}
              loading="lazy"
              width={320}
              height={240}
              className="h-full w-full object-cover"
            />
            {index === 0 && (
              <span className="absolute left-1 top-1 rounded bg-brand-700 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                Omslag
              </span>
            )}
          </div>
          <p className="truncate text-xs text-stone-600" title={item.caption ?? ""}>
            {item.kind === "FLOORPLAN" ? "Planritning" : "Bild"}
            {item.caption ? ` · ${item.caption}` : ""}
          </p>
          <MediaActions media={item} isCover={index === 0} />
        </li>
      ))}
    </ul>
  );
}
