import { type AIProvider, type ChatMessage, type AIResponse, type ChatOptions } from "./types";

export class MockProvider implements AIProvider {
  async chat(
    messages: ChatMessage[],
    context:  string,
    options?: ChatOptions
  ): Promise<AIResponse> {
    await delay(1200);

    // Si hay rawSystemPrompt es una llamada de resumen — devolver ack genérico
    if (options?.rawSystemPrompt) {
      return {
        success: true,
        content: "Resumen: conversación en progreso (proveedor Mock).",
      };
    }

    const hasContext = context.trim().length > 0;
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === "user")?.content ?? "";

    return { success: true, content: buildMockResponse(lastUserMessage, hasContext) };
  }
}

function buildMockResponse(userMessage: string, hasContext: boolean): string {
  const lower = userMessage.toLowerCase().trim();

  if (lower.includes("hola") || lower.includes("buenas") || lower.includes("buen día")) {
    return hasContext
      ? "¡Hola! Soy el asistente virtual de este negocio. Ya tengo acceso a la base de conocimiento configurada. La integración con el modelo de IA real se realizará en la siguiente etapa."
      : "¡Hola! Soy el asistente virtual de este negocio. Todavía no hay información cargada en la base de conocimiento.";
  }

  if (lower.includes("horario") || lower.includes("hora")) {
    return hasContext
      ? "Encontré información sobre horarios en la base de conocimiento. Con el modelo real podré responderte directamente."
      : "Todavía no hay información sobre horarios cargada.";
  }

  if (lower.includes("precio") || lower.includes("costo") || lower.includes("cuánto")) {
    return "Con el modelo real podré acceder al catálogo de productos y responder con precios actualizados.";
  }

  if (lower.includes("gracias")) {
    return "¡De nada! Estoy en modo de prueba.";
  }

  return `Recibí tu mensaje: "${userMessage}". Proveedor Mock activo — contexto ${hasContext ? "cargado" : "vacío"}.`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}