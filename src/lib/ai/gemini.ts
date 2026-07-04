import { GoogleGenerativeAI } from "@google/generative-ai";
import { type AIProvider, type ChatMessage, type AIResponse } from "./types";

/**
 * Proveedor de IA usando Google Gemini.
 *
 * Implementa únicamente la interfaz AIProvider.
 * No conoce nada del proyecto: ni la DB, ni Supabase, ni Server Actions.
 *
 * Modelo: GEMINI_MODEL (default: gemini-2.0-flash)
 * Tier gratuito: 1500 requests/día sin tarjeta de crédito.
 * API key gratuita en: https://aistudio.google.com
 *
 * Para volver a OpenAI o agregar Anthropic:
 * crear el archivo correspondiente e importarlo en provider.ts.
 */
export class GeminiProvider implements AIProvider {
  private client: GoogleGenerativeAI;
  private model:  string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY no está definida en las variables de entorno. " +
        "Obtené una clave gratuita en https://aistudio.google.com"
      );
    }

    this.client = new GoogleGenerativeAI(apiKey);
    this.model  = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  }

  async chat(messages: ChatMessage[], context: string): Promise<AIResponse> {
    try {
      const systemPrompt = buildSystemPrompt(context);

      const generativeModel = this.client.getGenerativeModel({
        model:          this.model,
        systemInstruction: systemPrompt,
        generationConfig: {
          temperature:     0.3,
          maxOutputTokens: 1024,
          topP:            1,
        },
      });

      // Gemini usa "user" y "model" como roles (no "assistant").
      // El SDK espera un array de Content con "parts".
      // Filtramos mensajes con role "system" porque ya se envió
      // como systemInstruction arriba.
      const geminiHistory = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role:  m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

      // El último mensaje debe ser del usuario y se envía aparte.
      // Los anteriores van como historial del chat.
      const lastMessage = geminiHistory.at(-1);
      const priorHistory = geminiHistory.slice(0, -1);

      if (!lastMessage) {
        return { success: false, error: "No hay mensajes para enviar." };
      }

      // Gemini requiere que el historial alterne user/model.
      // Si hay dos mensajes consecutivos del mismo rol, la API falla.
      // Normalizamos el historial para garantizar la alternancia.
      const normalizedHistory = normalizeHistory(priorHistory);

      const chat = generativeModel.startChat({
        history: normalizedHistory,
      });

      const result = await chat.sendMessage(lastMessage.parts[0].text);
      const content = result.response.text();

      if (!content) {
        return { success: false, error: "Gemini no devolvió una respuesta." };
      }

      return { success: true, content };
    } catch (error) {
      console.error("[GeminiProvider] Error al llamar a la API:", error);
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

/**
 * Gemini requiere que el historial estricto alterne user → model → user → model.
 * Si hay mensajes consecutivos del mismo rol (puede pasar por mensajes de sistema
 * convertidos o errores previos), los fusionamos para cumplir el requisito.
 */
function normalizeHistory(
  history: Array<{ role: string; parts: Array<{ text: string }> }>
): Array<{ role: string; parts: Array<{ text: string }> }> {
  const normalized: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  for (const message of history) {
    const last = normalized.at(-1);
    if (last && last.role === message.role) {
      // Fusionar con el anterior
      last.parts.push(...message.parts);
    } else {
      normalized.push({ role: message.role, parts: [...message.parts] });
    }
  }

  return normalized;
}