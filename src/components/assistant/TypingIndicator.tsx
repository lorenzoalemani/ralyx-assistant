/**
 * Animación de tres puntos que indica que la IA está generando una respuesta.
 */
export function TypingIndicator() {
  return (
    <div className="flex items-end gap-3">
      {/* Avatar del asistente */}
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/20">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <circle cx="7" cy="7" r="5" stroke="#7C5CFF" strokeWidth="1.5" />
          <path
            d="M5 7c0-.6.4-1 1-1h2M7 9V7"
            stroke="#7C5CFF"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Burbuja con puntos animados */}
      <div className="rounded-2xl rounded-bl-sm border border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span
            className="h-1.5 w-1.5 rounded-full bg-muted animate-bounce"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="h-1.5 w-1.5 rounded-full bg-muted animate-bounce"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="h-1.5 w-1.5 rounded-full bg-muted animate-bounce"
            style={{ animationDelay: "300ms" }}
          />
        </div>
      </div>
    </div>
  );
}