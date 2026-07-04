import OpenAI from "openai";
import { type AIProvider, type ChatMessage, type AIResponse } from "./types";

/**
 * Proveedor de IA usando OpenAI.
 *
 * Implementa únicamente la interfaz AIProvider.
 * No conoce nada del proyecto: ni la DB, ni Supabase, ni Server Actions.
 * El modelo se lee desde OPENAI_MODEL para poder cambiarlo sin tocar código.
 *
 * Para agregar Anthropic: crear src/lib/ai/anthropic.ts con la misma interfaz.
 */
export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private model: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY no está definida en las variables de entorno."
      );
    }

    this.client = new OpenAI({ apiKey });
    this.model  = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  }

  async chat(messages: ChatMessage[], context: string): Promise<AIResponse> {
    try {
      const systemPrompt = buildSystemPrompt(context);

      const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({
          role:    m.role as "user" | "assistant" | "system",
          content: m.content,
        })),
      ];

      const completion = await this.client.chat.completions.create({
        model:             this.model,
        messages:          openaiMessages,
        temperature:       0.3,
        max_tokens:        1024,
        top_p:             1,
        frequency_penalty: 0.1,
        presence_penalty:  0,
      });

      const content = completion.choices[0]?.message?.content;

      if (!content) {
        return { success: false, error: "El modelo no devolvió una respuesta." };
      }

      return { success: true, content };
    } catch (error) {
      console.error("[OpenAIProvider] Error al llamar a la API:", error);
      return {
        success: false,
        error:   "El asistente no pudo responder en este momento. Intentá de nuevo.",
      };
    }
  }
}

/**
 * Construye el prompt del sistema en tres capas:
 * 1. Instrucción base — rol y reglas del asistente
 * 2. Contexto del negocio — salida de buildBusinessContext()
 * 3. Cierre — refuerza que solo debe usar la información provista
 *
 * Se genera en cada request para que cualquier cambio en la base de
 * conocimiento impacte de inmediato sin reiniciar conversaciones.
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