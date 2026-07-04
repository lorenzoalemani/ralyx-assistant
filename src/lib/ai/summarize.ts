import { getAIProvider } from "./provider";
import { type ChatMessage } from "./types";

export type ConversationSummary = {
  id:              string;
  conversation_id: string;
  summary:         string;
  messages_count:  number;
  created_at:      string;
  updated_at:      string;
};

/**
 * Genera un resumen comprimido de una conversación.
 *
 * Usa el proveedor de IA activo en MODO RAW: pasa el prompt de resumen como
 * system message y contexto vacío. Esto evita que el proveedor envuelva las
 * instrucciones en el frame del asistente de negocio (buildSystemPrompt),
 * que confundiría al modelo al intentar resumir.
 *
 * El resumen es acumulativo: recibe el resumen anterior (si existe) y los
 * mensajes nuevos, y produce un resumen integrado sin perder información.
 */
export async function summarizeConversation(
  previousSummary:     string | null,
  messagesToSummarize: ChatMessage[]
): Promise<string | null> {
  if (messagesToSummarize.length === 0) return previousSummary;

  const provider = getAIProvider();

  const conversationText = messagesToSummarize
    .filter((m) => m.role !== "system")
    .map((m) => {
      const role = m.role === "user" ? "Cliente" : "Asistente";
      return `${role}: ${m.content}`;
    })
    .join("\n");

  if (!conversationText.trim()) return previousSummary;

  // Instrucciones de resumen como system message.
  // Con context="" en provider.chat(), el proveedor activa MODO RAW
  // y usa este mensaje directamente sin envolverlo en el prompt de negocio.
  const summarizationSystemPrompt = `Sos un asistente especializado en resumir conversaciones de soporte al cliente.
Tu tarea es generar un resumen conciso pero completo que preserve toda la información útil para continuar la conversación.

El resumen DEBE incluir (si fue mencionado en la conversación):
- Nombre del cliente u otros datos personales compartidos
- Qué estaba buscando o consultando
- Productos o servicios por los que preguntó
- Preguntas que ya fueron respondidas (para no repetirlas)
- Acuerdos, compromisos o próximos pasos mencionados
- Estado general del cliente (satisfecho, dudoso, urgente, etc.)

Reglas:
- Escribí en español, en tercera persona ("El cliente se llama...", "El cliente preguntó...")
- Sé conciso: máximo 200 palabras
- Priorizá datos concretos: nombres, productos, precios mencionados, decisiones
- No inventes información que no esté en los mensajes
- Si hay un resumen previo, integrá la nueva información sin perder la anterior`;

  const userPrompt = previousSummary
    ? `Resumen previo:\n${previousSummary}\n\nMensajes nuevos a incorporar:\n${conversationText}\n\nGenerá un resumen actualizado que integre ambos, preservando el nombre del cliente y todos los datos importantes.`
    : `Mensajes a resumir:\n${conversationText}\n\nGenerá un resumen de esta conversación preservando todos los datos importantes del cliente.`;

  // context="" activa MODO RAW en el proveedor.
  // El system message con las instrucciones se usa directamente.
  const messages: ChatMessage[] = [
    { role: "system", content: summarizationSystemPrompt },
    { role: "user",   content: userPrompt },
  ];

  try {
    const result = await provider.chat(messages, "");

    if (!result.success) {
      console.error("[summarize] Error al generar resumen:", result.error);
      return previousSummary;
    }

    return result.content;
  } catch (error) {
    console.error("[summarize] Error inesperado:", error);
    return previousSummary;
  }
}