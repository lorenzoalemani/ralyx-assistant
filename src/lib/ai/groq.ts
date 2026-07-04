import Groq from "groq-sdk";
import { type AIProvider, type ChatMessage, type AIResponse } from "./types";

/**
 * Proveedor de IA usando Groq.
 *
 * Manejo de system messages:
 *
 * MODO BUSINESS (context no vacío):
 *   El prompt del asistente se construye desde context (knowledge + products).
 *   Los system messages del historial (ej: resumen de conversación generado por
 *   buildConversationContext) se AÑADEN al prompt, no se filtran.
 *   Resultado: el modelo recibe conocimiento del negocio + resumen + mensajes recientes.
 *
 * MODO RAW (context vacío + hay system messages):
 *   Usado por summarizeConversation(). Los system messages se usan directamente
 *   como prompt sin envolverlos en el frame del asistente de negocio.
 *   Evita que el modelo intente resumir "como asistente del negocio".
 */
export class GroqProvider implements AIProvider {
  private client: Groq;
  private model:  string;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GROQ_API_KEY no está definida en las variables de entorno. " +
        "Obtené una clave gratuita en https://console.groq.com"
      );
    }

    this.client = new Groq({ apiKey });
    this.model  = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
  }

  async chat(messages: ChatMessage[], context: string): Promise<AIResponse> {
    try {
      const systemMessages       = messages.filter((m) => m.role === "system");
      const conversationMessages = messages.filter((m) => m.role !== "system");

      let systemContent: string;

      if (!context.trim() && systemMessages.length > 0) {
        // Modo RAW: sin contexto de negocio → usar los system messages directamente.
        // Activado por summarizeConversation() para evitar el wrapper de asistente.
        systemContent = systemMessages.map((m) => m.content).join("\n\n");
      } else {
        // Modo BUSINESS: construir prompt con contexto de negocio.
        // Los system messages del historial (resumen de conversación) se añaden al final.
        const businessPrompt = buildSystemPrompt(context);
        systemContent =
          systemMessages.length > 0
            ? [businessPrompt, ...systemMessages.map((m) => m.content)].join("\n\n")
            : businessPrompt;
      }

      const groqMessages: Groq.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: systemContent },
        ...conversationMessages.map((m) => ({
          role:    m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      const completion = await this.client.chat.completions.create({
        model:             this.model,
        messages:          groqMessages,
        temperature:       0.3,
        max_tokens:        1024,
        top_p:             1,
        frequency_penalty: 0.1,
        presence_penalty:  0,
      });

      const content = completion.choices[0]?.message?.content;

      if (!content) {
        return { success: false, error: "Groq no devolvió una respuesta." };
      }

      return { success: true, content };
    } catch (error) {
      console.error("[GroqProvider] Error al llamar a la API:", error);
      return {
        success: false,
        error:   "El asistente no pudo responder en este momento. Intentá de nuevo.",
      };
    }
  }
}

/**
 * Construye el prompt del sistema para el asistente de negocio.
 * Se genera en cada request para reflejar cambios en la base de conocimiento
 * sin reiniciar conversaciones.
 */
function buildSystemPrompt(context: string): string {
  const businessContext = context.trim()
    ? context
    : "Este negocio todavía no tiene información cargada en su base de conocimiento.";

  return `Sos el asistente virtual de este negocio.
Tu única fuente de información es la base de conocimiento provista a continuación.
Respondé siempre en el mismo idioma que el usuario.
Si no tenés información suficiente para responder una pregunta, decilo claramente sin inventar datos.
Nunca inventes precios, horarios, políticas ni información de contacto.
Sé conciso, directo y amable.

=== BASE DE CONOCIMIENTO DEL NEGOCIO ===
${businessContext}
=== FIN DE LA BASE DE CONOCIMIENTO ===

Respondé únicamente en base a la información anterior.
Si el usuario pregunta algo que no está cubierto, indicá que no tenés esa información disponible por el momento.`;
}