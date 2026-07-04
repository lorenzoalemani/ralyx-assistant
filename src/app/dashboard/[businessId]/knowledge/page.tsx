import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { type KnowledgeEntry } from "@/types/knowledge";
import { KnowledgeEntryCard } from "@/components/knowledge/KnowledgeEntryCard";
import { KnowledgeEntryModal } from "@/components/knowledge/KnowledgeEntryModal";

export default async function KnowledgePage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("id", businessId)
    .single();
  if (!business) notFound();

  const { data: entries, error } = await supabase
    .from("knowledge_entries")
    .select("*")
    .eq("business_id", businessId)
    .order("topic",      { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return (
      <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
        No se pudo cargar la base de conocimiento. Intentá recargar la página.
      </div>
    );
  }

  const list = (entries ?? []) as KnowledgeEntry[];
  const isEmpty = list.length === 0;

  // Agrupar por tópico para mostrar secciones
  const grouped = list.reduce<Record<string, KnowledgeEntry[]>>((acc, entry) => {
    if (!acc[entry.topic]) acc[entry.topic] = [];
    acc[entry.topic].push(entry);
    return acc;
  }, {});

  return (
    <div>
      {/* Encabezado */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">
            Base de conocimiento
          </h1>
          {!isEmpty && (
            <p className="mt-1 text-sm text-muted">
              {list.length} {list.length === 1 ? "entrada" : "entradas"} ·{" "}
              {Object.keys(grouped).length}{" "}
              {Object.keys(grouped).length === 1 ? "tópico" : "tópicos"}
            </p>
          )}
        </div>

        {!isEmpty && (
          <KnowledgeEntryModal
            mode="create"
            businessId={businessId}
            trigger={
              <button className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-glow transition-colors hover:bg-accent-hover">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Nueva entrada
              </button>
            }
          />
        )}
      </div>

      {/* Estado vacío */}
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-24 text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
              <path
                d="M6 4h16a2 2 0 012 2v16a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z"
                stroke="#7C5CFF"
                strokeWidth="1.8"
              />
              <path
                d="M9 9h10M9 13h10M9 17h6"
                stroke="#7C5CFF"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h2 className="font-display text-xl font-semibold text-foreground">
            La base de conocimiento está vacía
          </h2>
          <p className="mt-2 max-w-sm text-sm text-muted">
            Agregá información sobre tu negocio: horarios, envíos, medios de pago,
            promociones y más. La IA la usará para responder a tus clientes.
          </p>
          <div className="mt-8">
            <KnowledgeEntryModal
              mode="create"
              businessId={businessId}
              trigger={
                <button className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 font-medium text-white shadow-glow transition-colors hover:bg-accent-hover">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path d="M8 1v14M1 8h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Agregar primera entrada
                </button>
              }
            />
          </div>
        </div>
      ) : (
        /* Entradas agrupadas por tópico */
        <div className="flex flex-col gap-8">
          {Object.entries(grouped).map(([topic, topicEntries]) => (
            <section key={topic}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
                {topic}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {topicEntries.map((entry) => (
                  <KnowledgeEntryCard
                    key={entry.id}
                    entry={entry}
                    businessId={businessId}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}