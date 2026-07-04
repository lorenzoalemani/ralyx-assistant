import { type EmbeddingProvider } from "./types";
import { OpenAIEmbeddingProvider } from "./openai";

/**
 * Factory que devuelve el proveedor de embeddings activo.
 *
 * Para agregar un nuevo proveedor:
 * 1. Crear src/lib/embeddings/gemini.ts implementando EmbeddingProvider
 * 2. Agregar el case aquí
 * 3. Cambiar EMBEDDING_PROVIDER en .env.local
 *
 * El resto del sistema (RAG, indexing, search) no cambia.
 */
export function getEmbeddingProvider(): EmbeddingProvider {
  const provider = process.env.EMBEDDING_PROVIDER ?? "openai";

  switch (provider) {
    case "openai":
      return new OpenAIEmbeddingProvider();

    // case "gemini":
    //   return new GeminiEmbeddingProvider();  // 768 dims — requiere migración

    // case "ollama":
    //   return new OllamaEmbeddingProvider();  // dims variables según modelo

    default:
      throw new Error(
        `Proveedor de embeddings desconocido: "${provider}". ` +
        `Opciones válidas: "openai". ` +
        `Definí EMBEDDING_PROVIDER en .env.local.`
      );
  }
}