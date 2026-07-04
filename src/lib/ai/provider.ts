import { type AIProvider } from "./types";
import { MockProvider } from "./mock";
import { GroqProvider } from "./groq";

/**
 * Factory que devuelve el proveedor de IA activo según AI_PROVIDER.
 *
 * Para agregar un nuevo proveedor:
 * 1. Crear src/lib/ai/anthropic.ts (u openai.ts) implementando AIProvider
 * 2. Agregar el case correspondiente aquí
 * 3. Cambiar AI_PROVIDER en las variables de entorno
 *
 * El resto del código (UI, Server Actions, chat.ts) no cambia.
 */
export function getAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER ?? "mock";

  switch (provider) {
    case "mock":
      return new MockProvider();

    case "groq":
      return new GroqProvider();

    // case "gemini":
    //   return new GeminiProvider();

    // case "openai":
    //   return new OpenAIProvider();

    // case "anthropic":
    //   return new AnthropicProvider();

    default:
      console.warn(
        `[AI] Proveedor desconocido: "${provider}". Usando Mock como fallback.`
      );
      return new MockProvider();
  }
}