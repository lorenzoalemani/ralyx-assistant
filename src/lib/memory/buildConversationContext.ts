import { type SupabaseClient } from "@supabase/supabase-js";
import { type ChatMessage } from "@/lib/ai/types";

/**
 * Cuántos mensajes exactos se incluyen siempre al final del contexto.
 * Garantiza coherencia inmediata del diálogo independientemente del resumen.
 */
const RECENT_WINDOW = 6;

/**
 * Construye el array de ChatMessage[] listo para enviar al proveedor de IA.
 *
 * Implementa la arquitectura de memoria en dos capas:
 *
 *   CAPA 1 — Resumen comprimido (memoria media)
 *     Si existe un resumen en conversation_summaries, se inyecta como
 *     un mensaje de sistema antes de los mensajes recientes.
 *
 *   CAPA 2 — Mensajes recientes (ventana corta)
 *     Los últimos RECENT_WINDOW mensajes exactos, en orden cronológico.
 *
 * El contexto del negocio (knowledge + products) NO se incluye aquí:
 * lo construye buildBusinessContext() y se pasa por separado como
 * segundo argumento a sendChatMessage(), manteniendo las responsabilidades
 * separadas.
 *
 * @param supabase        Cliente de Supabase (con sesión de usuario o service role)
 * @param conversationId  ID de la conversación a cargar
 * @returns               Array de ChatMessage[] listo para el proveedor de IA
 */
export async function buildConversationContext(
  supabase: SupabaseClient,
  conversationId: string
): Promise<ChatMessage[]> {
  // Cargar resumen y mensajes recientes en paralelo
  const [summaryResult, messagesResult] = await Promise.all([
    supabase
      .from("conversation_summaries")
      .select("summary")
      .eq("conversation_id", conversationId)
      .maybeSingle(),
    supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(RECENT_WINDOW),
  ]);

  const messages: ChatMessage[] = [];

  // Capa 1: resumen como mensaje de sistema
  const summary = summaryResult.data?.summary ?? null;
  if (summary) {
    messages.push({
      role:    "system",
      content: `Resumen de la conversación hasta ahora:\n${summary}`,
    });
  }

  // Capa 2: mensajes recientes en orden cronológico
  const recentMessages: ChatMessage[] = (messagesResult.data ?? [])
    .reverse()
    .map((m) => ({
      role:    m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

  messages.push(...recentMessages);

  return messages;
}