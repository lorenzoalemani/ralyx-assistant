/**
 * Interfaz que todo proveedor de embeddings debe implementar.
 *
 * Para agregar un nuevo proveedor (Gemini, Ollama, Cohere, etc.):
 * 1. Crear src/lib/embeddings/{nombre}.ts implementando esta interfaz
 * 2. Agregar el case en provider.ts
 * 3. Cambiar EMBEDDING_PROVIDER en .env.local
 *
 * Si el nuevo proveedor usa dimensiones distintas:
 * - Actualizar la migración: ALTER COLUMN embedding TYPE vector(N)
 * - Vaciar la tabla embeddings
 * - Llamar a reindexBusiness() para cada negocio
 */
export interface EmbeddingProvider {
  /**
   * Genera un vector de embedding para el texto dado.
   * Lanza una excepción si la llamada a la API falla.
   */
  embed(text: string): Promise<number[]>;

  /**
   * Dimensión del vector producido por este proveedor.
   * Debe coincidir con la dimensión definida en la columna embedding
   * y en la función search_embeddings de la migración.
   */
  readonly dimensions: number;

  /** Identificador del modelo usado — útil para auditoría y reindexación. */
  readonly model: string;
}