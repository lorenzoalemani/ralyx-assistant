"use client";

import { useState } from "react";
import { deleteKnowledgeEntry } from "@/lib/actions/knowledge";
import { KnowledgeEntryModal } from "./KnowledgeEntryModal";
import { type KnowledgeEntry } from "@/types/knowledge";

export function KnowledgeEntryCard({
  entry,
  businessId,
}: {
  entry: KnowledgeEntry;
  businessId: string;
}) {
  const [deleting, setDeleting] = useState(false);

  const formattedDate = new Date(entry.updated_at).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  async function handleDelete() {
    if (!confirm("¿Eliminar esta entrada? Esta acción no se puede deshacer.")) return;
    setDeleting(true);
    await deleteKnowledgeEntry(entry.id, businessId);
    // revalidatePath en el action re-renderiza la página automáticamente.
  }

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-4 transition-colors ${
        entry.active
          ? "border-border bg-surface hover:border-accent/30"
          : "border-border/50 bg-surface/50 opacity-60"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
              {entry.topic}
            </span>
            {!entry.active && (
              <span className="rounded-md bg-border px-2 py-0.5 text-xs text-muted">
                Inactiva
              </span>
            )}
          </div>
          <p className="font-display font-semibold text-foreground leading-tight">
            {entry.title}
          </p>
        </div>

        {/* Acciones */}
        <div className="flex shrink-0 items-center gap-1">
          <KnowledgeEntryModal
            mode="edit"
            businessId={businessId}
            entry={entry}
            trigger={
              <button className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-hover hover:text-foreground">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M9.5 2.5l2 2-7 7H2.5v-2l7-7z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            }
          />
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-40"
          >
            {deleting ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted/40 border-t-muted block" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M2 3.5h10M5 3.5V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v1M5.5 6v4M8.5 6v4M3 3.5l.7 7.5a.5.5 0 00.5.5h5.6a.5.5 0 00.5-.5L11 3.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Contenido */}
      <p className="text-sm text-muted line-clamp-3 whitespace-pre-line">
        {entry.content}
      </p>

      {/* Footer */}
      <p className="text-xs text-muted/50">
        Actualizada el {formattedDate}
        {entry.source !== "manual" && ` · ${entry.source}`}
      </p>
    </div>
  );
}
