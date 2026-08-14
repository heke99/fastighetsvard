"use client";

import { useActionState } from "react";
import { createNoteAction, deleteNoteAction } from "@/app/admin/actions";
import type { AdminFormState } from "@/app/admin/actions";
import type { NoteEntityType, NoteRecord } from "@/lib/repositories/notes";

const initialState: AdminFormState = { status: "idle" };

const dateFormatter = new Intl.DateTimeFormat("sv-SE", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Stockholm",
});

function formatTimestamp(value: string): string {
  const parsed = new Date(value.endsWith("Z") ? value : `${value}Z`);
  return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed);
}

function DeleteNoteButton({ noteId }: { noteId: string }) {
  const [state, formAction, pending] = useActionState(deleteNoteAction, initialState);
  return (
    <form action={formAction} className="shrink-0">
      <input type="hidden" name="noteId" value={noteId} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs font-medium text-stone-500 underline hover:text-red-700 disabled:opacity-60"
      >
        {pending ? "Tar bort …" : "Ta bort"}
      </button>
      {state.status === "error" && (
        <span role="alert" className="ml-2 text-xs text-red-700">{state.message}</span>
      )}
    </form>
  );
}

/**
 * Interna anteckningar för ett domänobjekt. Anteckningarna är alltid interna
 * och visas aldrig i hyresgäst- eller sökandeportalen.
 */
export function NotesPanel({
  entityType,
  entityId,
  notes,
  canWrite,
  heading = "Interna anteckningar",
}: {
  entityType: NoteEntityType;
  entityId: string;
  notes: NoteRecord[];
  canWrite: boolean;
  heading?: string;
}) {
  const [state, formAction, pending] = useActionState(createNoteAction, initialState);
  const fieldId = `note-${entityType}-${entityId}`;

  return (
    <section aria-label={heading} className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">{heading}</h3>

      {notes.length === 0 ? (
        <p className="text-sm text-stone-500">
          Inga anteckningar ännu.{canWrite ? " Skriv den första nedan." : ""}
        </p>
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-lg border border-stone-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="whitespace-pre-wrap text-sm text-stone-800">{note.body}</p>
                {canWrite && <DeleteNoteButton noteId={note.id} />}
              </div>
              <p className="mt-2 text-xs text-stone-500">
                {note.author?.name ?? "Okänd användare"} · {formatTimestamp(note.createdAt)}
                {note.updatedAt !== note.createdAt ? ` · redigerad ${formatTimestamp(note.updatedAt)}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="entityType" value={entityType} />
          <input type="hidden" name="entityId" value={entityId} />
          <label htmlFor={fieldId} className="sr-only">Ny anteckning</label>
          <textarea
            id={fieldId}
            name="body"
            rows={3}
            required
            maxLength={8000}
            className="input"
            placeholder="Intern anteckning – visas aldrig för hyresgäst eller sökande."
          />
          {state.status === "error" && (
            <p role="alert" className="text-xs font-medium text-red-700">{state.message}</p>
          )}
          {state.status === "success" && (
            <p role="status" className="text-xs font-medium text-brand-800">{state.message}</p>
          )}
          <button type="submit" disabled={pending} className="btn-primary text-sm">
            {pending ? "Sparar …" : "Spara anteckning"}
          </button>
        </form>
      )}
    </section>
  );
}
