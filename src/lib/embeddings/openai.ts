import { type EmbeddingProvider } from "./types";

/**
 * Proveedor de embeddings usando OpenAI Embeddings API.
 *
 * Usa fetch directamente para no agregar dependencias adicionales.
 *
 * Modelos soportados y sus dimensiones:
 *   text-embedding-3-small → 1536 dims (default, mejor costo/calidad)
 *   text-embedding-3-large → 3072 dims (mayor precisión, mayor costo)
 *
 * Si cambiás el modelo a text-embedding-3-large:
 *   1. Cambiar OPENAI_EMBEDDING_MODEL=text-embedding-3-large en .env.local
 *   2. Ejecutar migración para alterar la columna: vector(3072)
 *   3. Vaciar embeddings y reindexar
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly model:      string;
  readonly dimensions: number;

  private readonly apiKey: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY no está definida. " +
        "Requerida para el proveedor de embeddings OpenAI."
      );
    }

    this.apiKey     = apiKey;
    this.model      = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
    this.dimensions = this.model === "text-embedding-3-large" ? 3072 : 1536;
  }

  async embed(text: string): Promise<number[]> {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        input: text,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `OpenAI Embeddings API error ${response.status}: ${body}`
      );
    }

    const data = await response.json() as {
      data: Array<{ embedding: number[] }>;
    };

    const embedding = data.data[0]?.embedding;
    if (!embedding) {
      throw new Error("OpenAI Embeddings API no devolvió un vector.");
    }

    return embedding;
  }
}