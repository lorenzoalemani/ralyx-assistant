/**
 * Tipos compartidos de la capa de abstracción de IA.
 */

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type AIResponse =
  | { success: true;  content: string }
  | { success: false; error: string };

export type ChatOptions = {
  /**
   * Cuando se provee, reemplaza completamente el prompt de sistema
   * que el proveedor construiría por defecto a partir del contexto.
   * Usado exclusivamente por summarizeConversation().
   */
  rawSystemPrompt?: string;
};

/**
 * Interfaz que todo proveedor de IA debe implementar.
 */
export interface AIProvider {
  chat(
    messages: ChatMessage[],
    context:  string,
    options?: ChatOptions
  ): Promise<AIResponse>;
}