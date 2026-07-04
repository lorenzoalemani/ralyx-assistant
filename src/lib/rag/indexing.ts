import { type SupabaseClient } from "@supabase/supabase-js";
import { getEmbeddingProvider } from "@/lib/embeddings";

// ─── Generadores de texto para embedding ─────────────────────────────────────
//
// Definen qué texto representa semánticamente a cada entidad.
// Si se modifica cualquiera de estas funciones, es necesario reindexar
// todos los embeddings del tipo afectado con reindexBusiness().

function knowledgeEntryToText(entry: {
  topic:   string;
  title:   string;
  content: string;
}): string {
  return `${entry.topic}: ${entry.title}. ${entry.content}`.trim();
}

function productToText(product: {
  name:        string;
  description: string | null;
}): string {
  // El precio se excluye intencionalmente del embedding.
  // Los embeddings representan significado semántico, no valores numéricos
  // que cambian frecuentemente. El precio se obtiene de la tabla original
  // al construir el contexto para la IA.
  const parts = [product.name];
  if (product.description?.trim()) {
    parts.push(product.description.trim());
  }
  return parts.join(". ").trim();
}

// ─── Funciones de indexación ──────────────────────────────────────────────────

/**
 * Genera y persiste el embedding de una knowledge entry.
 * Usa upsert: si ya existe un embedding para este entity_id, lo reemplaza.
 * Si falla, loguea el error pero no lanza excepción —
 * la creación del registro principal ya tuvo éxito.
 */
export async function indexKnowledgeEntry(
  supabase: SupabaseClient,
  entry: {
    id:          string;
    business_id: string;
    topic:       string;
    title:       string;
    content:     string;
  }
): Promise<void> {
  try {
    const provider  = getEmbeddingProvider();
    const text      = knowledgeEntryToText(entry);
    const embedding = await provider.embed(text);

    const { error } = await supabase
      .from("embeddings")
      .upsert(
        {
          business_id: entry.business_id,
          entity_type: "knowledge",
          entity_id:   entry.id,
          embedding:   `[${embedding.join(",")}]`,
        },
        { onConflict: "entity_type,entity_id" }
      );

    if (error) {
      console.error("[indexing] Error al guardar embedding de knowledge_entry:", error);
    }
  } catch (error) {
    console.error("[indexing] Error al indexar knowledge_entry:", entry.id, error);
  }
}

/**
 * Genera y persiste el embedding de un producto.
 * Solo usa nombre y descripción — el precio no forma parte del embedding.
 */
export async function indexProduct(
  supabase: SupabaseClient,
  product: {
    id:          string;
    business_id: string;
    name:        string;
    description: string | null;
  }
): Promise<void> {
  try {
    const provider  = getEmbeddingProvider();
    const text      = productToText(product);
    const embedding = await provider.embed(text);

    const { error } = await supabase
      .from("embeddings")
      .upsert(
        {
          business_id: product.business_id,
          entity_type: "product",
          entity_id:   product.id,
          embedding:   `[${embedding.join(",")}]`,
        },
        { onConflict: "entity_type,entity_id" }
      );

    if (error) {
      console.error("[indexing] Error al guardar embedding de producto:", error);
    }
  } catch (error) {
    console.error("[indexing] Error al indexar producto:", product.id, error);
  }
}

/**
 * Regenera todos los embeddings de un negocio.
 *
 * Cuándo llamar:
 *   - Al cambiar EMBEDDING_PROVIDER o OPENAI_EMBEDDING_MODEL
 *   - Al modificar knowledgeEntryToText() o productToText()
 *   - Después de ejecutar una migración que altera la dimensión del vector
 *
 * Proceso completo de cambio de proveedor/modelo:
 *   1. Actualizar EMBEDDING_PROVIDER / OPENAI_EMBEDDING_MODEL en .env
 *   2. Ejecutar migración: ALTER COLUMN embedding TYPE vector(N)
 *   3. DELETE FROM public.embeddings WHERE business_id = $id
 *   4. Llamar a reindexBusiness() para cada negocio
 *
 * TODO: implementar cuando sea necesario
 */
export async function reindexBusiness(
  _supabase:   SupabaseClient,
  _businessId: string
): Promise<{ indexed: number; failed: number }> {
  throw new Error(
    "reindexBusiness() no está implementado todavía. " +
    "Ver src/lib/rag/indexing.ts para el proceso de reindexación."
  );
}