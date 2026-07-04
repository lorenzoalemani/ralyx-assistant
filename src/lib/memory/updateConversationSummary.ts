import { type SupabaseClient } from "@supabase/supabase-js";
import { type ChatMessage } from "@/lib/ai/types";
import { summarizeConversation } from "@/lib/ai/summarize";

/**
 * Cantidad mínima de mensajes para activar el resumen por primera vez.
 */
const SUMMARY_THRESHOLD = 10;

/**
 * Cada cuántos mensajes nuevos (desde el último resumen) se actualiza el resumen.
 * Reduce costos: no resumimos en cada respuesta, solo cada N mensajes nuevos.
 *
 * Ejemplo con SUMMARY_THRESHOLD=10 y SUMMARY_UPDATE_EVERY=5:
 *   - Primer resumen: mensaje 10
 *   - Siguiente:      mensaje 15
 *   - Siguiente:      mensaje 20
 *   ...
 */
const SUMMARY_UPDATE_EVERY = 5;

/**
 * Cuántos mensajes recientes se excluyen del resumen (la ventana corta).
 * Deben coincidir con RECENT_WINDOW en buildConversationContext.
 */
const RECENT_WINDOW = 6;

/**
 * Decide si corresponde actualizar el resumen y, si es así, lo genera y persiste.
 *
 * Flujo:
 * 1. Contar el total de mensajes en la conversación.
 * 2. Si es menor a SUMMARY_THRESHOLD, no hacer nada.
 * 3. Verificar si ya existe un resumen y cuántos mensajes tenía cuando se generó.
 * 4. Si los mensajes nuevos desde el último resumen son < SUMMARY_UPDATE_EVERY,
 *    no hacer nada (reducción de costos).
 * 5. Cargar los mensajes que no están en la ventana corta (los candidatos a resumir).
 * 6. Llamar a summarizeConversation() con el resumen anterior y los mensajes nuevos.
 * 7. Upsert en conversation_summaries.
 *
 * Se llama de forma asíncrona después de guardar la respuesta del asistente,
 * por lo que no bloquea la respuesta al usuario.
 *
 * @param supabase        Cliente de Supabase (con sesión de usuario o service role)
 * @param conversationId  ID de la conversación
 */
export async function updateConversationSummary(
  supabase: SupabaseClient,
  conversationId: string
): Promise<void> {
  // 1. Contar mensajes totales
  const { count: totalCount } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId);

  const total = totalCount ?? 0;

  // 2. No resumir si hay pocos mensajes
  if (total < SUMMARY_THRESHOLD) return;

  // 3. Cargar resumen actual
  const { data: existingSummary } = await supabase
    .from("conversation_summaries")
    .select("summary, messages_count")
    .eq("conversation_id", conversationId)
    .maybeSingle();

  const previousCount   = existingSummary?.messages_count ?? 0;
  const previousSummary = existingSummary?.summary ?? null;
  const newMessagesSinceLastSummary = total - previousCount;

  // 4. Respetar la frecuencia de actualización para reducir costos
  const isFirstSummary = !existingSummary;
  if (!isFirstSummary && newMessagesSinceLastSummary < SUMMARY_UPDATE_EVERY) {
    return;
  }

  // 5. Cargar mensajes fuera de la ventana corta para resumir
  //    Los excluimos en orden descendente: los últimos RECENT_WINDOW
  //    se mantienen exactos en buildConversationContext y no se resumen.
  const { data: allMessages } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  const messages = allMessages ?? [];
  const messagesToSummarize: ChatMessage[] = messages
    .slice(0, Math.max(0, messages.length - RECENT_WINDOW))
    .map((m) => ({
      role:    m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

  if (messagesToSummarize.length === 0) return;

  // 6. Generar el resumen actualizado
  const newSummary = await summarizeConversation(
    previousSummary,
    messagesToSummarize
  );

  if (!newSummary) return;

  // 7. Upsert del resumen con el conteo actualizado
  const { error } = await supabase
    .from("conversation_summaries")
    .upsert(
      {
        conversation_id: conversationId,
        summary:         newSummary,
        messages_count:  total,
      },
      { onConflict: "conversation_id" }
    );

  if (error) {
    console.error("[updateConversationSummary] Error al guardar resumen:", error);
  }
}