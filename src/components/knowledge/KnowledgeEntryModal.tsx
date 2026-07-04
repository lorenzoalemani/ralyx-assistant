"use client";

import {
  useState,
  useRef,
  useEffect,
  type FormEvent,
} from "react";
import {
  createKnowledgeEntry,
  updateKnowledgeEntry,
} from "@/lib/actions/knowledge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormError } from "@/components/ui/FormError";
import { type KnowledgeEntry, SUGGESTED_TOPICS } from "@/types/knowledge";

interface BaseProps {
  businessId: string;
  trigger: React.ReactNode;
}

interface CreateProps extends BaseProps {
  mode: "create";
  entry?: never;
}

interface EditProps extends BaseProps {
  mode: "edit";
  entry: KnowledgeEntry;
}

type Props = CreateProps | EditProps;

export function KnowledgeEntryModal({ businessId, trigger, mode, entry }: Props) {
  const isEdit = mode === "edit";

  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const [topic,   setTopic]   = useState(entry?.topic   ?? "");
  const [title,   setTitle]   = useState(entry?.title   ?? "");
  const [content, setContent] = useState(entry?.content ?? "");
  const [active,  setActive]  = useState(entry?.active  ?? true);
  const [customTopic, setCustomTopic] = useState(false);

  const inputRef   = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  function resetForm() {
    setTopic(entry?.topic     ?? "");
    setTitle(entry?.title     ?? "");
    setContent(entry?.content ?? "");
    setActive(entry?.active   ?? true);
    setError(null);
    setCustomTopic(false);
  }

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      resetForm();
    }
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = isEdit
      ? await updateKnowledgeEntry({
          id: entry.id,
          business_id: businessId,
          topic,
          title,
          content,
          active,
        })
      : await createKnowledgeEntry({
          business_id: businessId,
          topic,
          title,
          content,
        });

    setLoading(false);
    if (!result.success) { setError(result.error); return; }
    setOpen(false);
  }

  const isSuggestedTopic = SUGGESTED_TOPICS.includes(topic as typeof SUGGESTED_TOPICS[number]);
  const showCustomInput  = customTopic || (isEdit && !isSuggestedTopic && topic !== "");

  return (
    <>
      <div onClick={() => setOpen(true)}>{trigger}</div>

      {open && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === overlayRef.current) setOpen(false); }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-glow max-h-[90vh] overflow-y-auto">
            <div className="mb-5">
              <h2 className="font-display text-lg font-semibold text-foreground">
                {isEdit ? "Editar entrada" : "Nueva entrada"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {isEdit
                  ? "Modificá el contenido de esta entrada."
                  : "Agregá información que la IA usará para responder a tus clientes."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {error && <FormError message={error} />}

              {/* Tópico */}
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-muted">Tópico</span>

                {!showCustomInput ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {SUGGESTED_TOPICS.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTopic(t)}
                          className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                            topic === t
                              ? "bg-accent text-white"
                              : "border border-border text-muted hover:border-accent/50 hover:text-foreground"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => { setCustomTopic(true); setTopic(""); }}
                        className="rounded-lg border border-dashed border-border px-3 py-1.5 text-sm text-muted transition-colors hover:border-accent/50 hover:text-foreground"
                      >
                        + Otro
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      ref={inputRef}
                      id="topic-custom"
                      label=""
                      type="text"
                      placeholder="Ej: Garantías, Instalación, Turnos..."
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      maxLength={80}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => { setCustomTopic(false); setTopic(""); }}
                      className="mt-0 shrink-0 self-end rounded-xl border border-border px-3 py-2.5 text-sm text-muted transition-colors hover:text-foreground"
                    >
                      ← Volver
                    </button>
                  </div>
                )}
              </div>

              {/* Título */}
              <Input
                ref={showCustomInput ? undefined : inputRef}
                id="entry-title"
                label="Título"
                type="text"
                placeholder="Ej: Horario de atención"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={150}
              />

              {/* Contenido */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="entry-content"
                  className="text-sm font-medium text-muted"
                >
                  Contenido
                </label>
                <textarea
                  id="entry-content"
                  rows={5}
                  placeholder="Escribí la información que la IA debe conocer sobre este tópico..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  maxLength={5000}
                  required
                  className="w-full resize-y rounded-xl border border-border bg-surface px-4 py-2.5 text-foreground placeholder:text-muted/60 outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent"
                />
                <p className="text-right text-xs text-muted/60">
                  {content.length}/5000
                </p>
              </div>

              {/* Toggle activo/inactivo — solo en edición */}
              {isEdit && (
                <label className="flex cursor-pointer items-center gap-3">
                  <div
                    onClick={() => setActive((v) => !v)}
                    className={`relative h-5 w-9 rounded-full transition-colors ${
                      active ? "bg-accent" : "bg-border"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        active ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </div>
                  <span className="text-sm text-muted">
                    {active ? "Activa" : "Inactiva"}
                  </span>
                </label>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl border border-border py-2.5 text-sm text-muted transition-colors hover:border-accent/40 hover:text-foreground"
                >
                  Cancelar
                </button>
                <Button type="submit" loading={loading} className="flex-1">
                  {isEdit ? "Guardar cambios" : "Agregar entrada"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}