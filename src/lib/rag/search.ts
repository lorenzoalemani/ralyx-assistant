import { type SupabaseClient } from "@supabase/supabase-js";
import { getEmbeddingProvider } from "@/lib/embeddings";

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Resultados totales del vector search antes de separar por tipo. */
const SEMANTIC_TOP_K  = 10;

/** Máximo de knowledge entries incluidas desde el vector search. */
const KNOWLEDGE_LIMIT = 5;

/** Máximo de productos incluidos desde el vector search. */
const PRODUCT_LIMIT   = 5;

/**
 * Máximo de registros por tipo en el fallback controlado.
 * Mantiene la ventaja de costo del RAG — no es el contexto completo.
 */
const FALLBACK_LIMIT  = 3;

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type KnowledgeChunk = {
  id:      string;
  topic:   string;
  title:   string;
  content: string;
};

export type ProductChunk = {
  id:          string;
  name:        string;
  description: string | null;
  price:       number;
};

export type SearchResult = {
  knowledge: KnowledgeChunk[];
  products:  ProductChunk[];
  /**
   * 'semantic'  → resultados de la búsqueda vectorial
   * 'fallback'  → registros recientes (proveedor no configurado o fallo)
   */
  source: "semantic" | "fallback";
};

type RpcRow = {
  entity_type: string;
  entity_id:   string;
  similarity:  number;
};

// ─── Búsqueda semántica ───────────────────────────────────────────────────────

/**
 * Realiza una búsqueda semántica sobre el conocimiento y productos del negocio.
 *
 * Flujo:
 * 1. Genera el embedding del mensaje actual del usuario
 * 2. Busca los vectores más similares filtrados por business_id
 * 3. Recupera los registros originales (sin duplicar datos)
 * 4. Si falla cualquier paso → fallback controlado (N registros recientes)
 *
 * Garantías:
 * - Nunca mezcla información entre negocios (filtro estricto por business_id)
 * - Nunca envía todo el catálogo (top_k limitado)
 * - No lanza excepciones — el fallback siempre devuelve algo utilizable
 */
export async function semanticSearch(
  supabase:   SupabaseClient,
  businessId: string,
  queryText:  string
): Promise<SearchResult> {
  try {
    const provider       = getEmbeddingProvider();
    const queryEmbedding = await provider.embed(queryText);

    const { data: searchRows, error: searchError } = await supabase.rpc(
      "search_embeddings",
      {
        p_business_id:     businessId,
        p_query_embedding: queryEmbedding,
        p_limit:           SEMANTIC_TOP_K,
      }
    ) as { data: RpcRow[] | null; error: unknown };

    if (searchError) {
      console.error("[search] Error en búsqueda vectorial:", searchError);
      return fetchFallback(supabase, businessId);
    }

    if (!searchRows || searchRows.length === 0) {
      return fetchFallback(supabase, businessId);
    }

    // Separar por tipo respetando límites por categoría
    const knowledgeIds = searchRows
      .filter((r) => r.entity_type === "knowledge")
      .slice(0, KNOWLEDGE_LIMIT)
      .map((r) => r.entity_id);

    const productIds = searchRows
      .filter((r) => r.entity_type === "product")
      .slice(0, PRODUCT_LIMIT)
      .map((r) => r.entity_id);

    // Recuperar registros originales en paralelo
    const [knowledgeResult, productsResult] = await Promise.all([
      knowledgeIds.length > 0
        ? supabase
            .from("knowledge_entries")
            .select("id, topic, title, content")
            .in("id", knowledgeIds)
            .eq("active", true)
        : Promise.resolve({ data: [] as KnowledgeChunk[], error: null }),
      productIds.length > 0
        ? supabase
            .from("products")
            .select("id, name, description, price")
            .in("id", productIds)
            .eq("active", true)
        : Promise.resolve({ data: [] as ProductChunk[], error: null }),
    ]);

    // Reordenar según relevancia semántica original (el ORDER BY del RPC)
    const knowledgeMap = new Map(
      (knowledgeResult.data ?? []).map((k) => [k.id, k as KnowledgeChunk])
    );
    const productMap = new Map(
      (productsResult.data ?? []).map((p) => [p.id, p as ProductChunk])
    );

    const orderedKnowledge = knowledgeIds
      .map((id) => knowledgeMap.get(id))
      .filter((k): k is KnowledgeChunk => !!k);

    const orderedProducts = productIds
      .map((id) => productMap.get(id))
      .filter((p): p is ProductChunk => !!p);

    // Si los registros originales fueron eliminados tras la indexación → fallback
    if (orderedKnowledge.length === 0 && orderedProducts.length === 0) {
      return fetchFallback(supabase, businessId);
    }

    return {
      knowledge: orderedKnowledge,
      products:  orderedProducts,
      source:    "semantic",
    };
  } catch (error) {
    console.error("[search] Error inesperado en semanticSearch:", error);
    return fetchFallback(supabase, businessId);
  }
}

// ─── Fallback controlado ──────────────────────────────────────────────────────

/**
 * Devuelve un conjunto limitado de registros recientes cuando la búsqueda
 * semántica no está disponible o no devuelve resultados.
 *
 * No es el contexto completo — preserva la ventaja de costo del RAG.
 * La IA recibirá algo de contexto aunque no sea el más relevante.
 */
async function fetchFallback(
  supabase:   SupabaseClient,
  businessId: string
): Promise<SearchResult> {
  const [knowledgeResult, productsResult] = await Promise.all([
    supabase
      .from("knowledge_entries")
      .select("id, topic, title, content")
      .eq("business_id", businessId)
      .eq("active", true)
      .order("updated_at", { ascending: false })
      .limit(FALLBACK_LIMIT),
    supabase
      .from("products")
      .select("id, name, description, price")
      .eq("business_id", businessId)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(FALLBACK_LIMIT),
  ]);

  return {
    knowledge: (knowledgeResult.data ?? []) as KnowledgeChunk[],
    products:  (productsResult.data  ?? []) as ProductChunk[],
    source:    "fallback",
  };
}