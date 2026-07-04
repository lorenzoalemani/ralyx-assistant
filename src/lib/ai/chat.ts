import { getAIProvider } from "./provider";
import { type ChatMessage, type AIResponse } from "./types";

/**
 * Función pública de la capa de IA.
 * Es el único punto de entrada que usan los Server Actions.
 *
 * Nunca importar MockProvider, OpenAIProvider, etc. directamente
 * fuera de este módulo — siempre pasar por aquí.
 *
 * @param messages  Historial de la conversación (roles: user | assistant | system)
 * @param context   Contexto del negocio generado por buildBusinessContext()
 */
export async function sendChatMessage(
  messages: ChatMessage[],
  context: string
): Promise<AIResponse> {
  try {
    const provider = getAIProvider();
    return await provider.chat(messages, context);
  } catch (error) {
    console.error("[AI] Error en sendChatMessage:", error);
    return {
      success: false,
      error: "El asistente no está disponible en este momento. Intentá de nuevo.",
    };
  }
}