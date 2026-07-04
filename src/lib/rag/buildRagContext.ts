import { type SearchResult } from "./search";

/**
 * Construye el contexto para la IA a partir de los resultados del RAG.
 *
 * Solo incluye los chunks relevantes para la consulta actual.
 * El precio se toma directamente de la tabla products — no del embedding.
 *
 * Diferencia vs buildBusinessContext (reemplazado):
 *   Antes → todo el catálogo en cada consulta
 *   Ahora → solo los N chunks semánticamente relevantes
 */
export function buildRagContext(result: SearchResult): string {
  const { knowledge, products, source } = result;

  if (knowledge.length === 0 && products.length === 0) {
    return (
      "No hay información disponible en la base de conocimiento para esta consulta. " +
      "Informá al cliente que no tenés esa información disponible por el momento."
    );
  }

  const blocks: string[] = [];

  blocks.push(
    source === "semantic"
      ? "[INFORMACIÓN RELEVANTE PARA ESTA CONSULTA]"
      : "[INFORMACIÓN RECIENTE DEL NEGOCIO]"
  );

  if (knowledge.length > 0) {
    const lines = ["[CONOCIMIENTO DEL NEGOCIO]"];
    for (const entry of knowledge) {
      lines.push(`${entry.title} (${entry.topic}): ${entry.content}`);
    }
    blocks.push(lines.join("\n"));
  }

  if (products.length > 0) {
    const lines = ["[PRODUCTOS]"];
    for (const product of products) {
      const price = new Intl.NumberFormat("es-AR", {
        style:                 "currency",
        currency:              "ARS",
        minimumFractionDigits: 2,
      }).format(product.price);

      const line = product.description
        ? `- ${product.name} | ${price}\n  ${product.description}`
        : `- ${product.name} | ${price}`;

      lines.push(line);
    }
    blocks.push(lines.join("\n"));
  }

  return blocks.join("\n\n");
}