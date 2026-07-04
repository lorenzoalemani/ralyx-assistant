import { type KnowledgeEntry } from "@/types/knowledge";
import { type Product } from "@/types/product";

/**
 * Serializa la base de conocimiento y el catálogo de productos en un bloque
 * de texto listo para ser inyectado como contexto en un prompt de IA.
 *
 * Estructura del output:
 * - Primero las entradas de conocimiento agrupadas por tópico
 * - Luego el catálogo de productos activos (si existen)
 *
 * Este es el único punto de la app que define cómo se representa
 * el conocimiento del negocio para el modelo de lenguaje.
 */
export function buildBusinessContext(
  entries:  KnowledgeEntry[],
  products: Product[] = []
): string {
  const blocks: string[] = [];

  // ── Entradas de conocimiento ───────────────────────────────────────────────
  const activeEntries = entries
    .filter((e) => e.active)
    .sort((a, b) => a.sort_order - b.sort_order);

  if (activeEntries.length > 0) {
    const grouped = new Map<string, KnowledgeEntry[]>();
    for (const entry of activeEntries) {
      if (!grouped.has(entry.topic)) grouped.set(entry.topic, []);
      grouped.get(entry.topic)!.push(entry);
    }

    for (const [topic, topicEntries] of grouped) {
      const lines: string[] = [`[${topic.toUpperCase()}]`];
      for (const entry of topicEntries) {
        lines.push(`${entry.title}: ${entry.content}`);
      }
      blocks.push(lines.join("\n"));
    }
  }

  // ── Catálogo de productos ──────────────────────────────────────────────────
  const activeProducts = products.filter((p) => p.active);

  if (activeProducts.length > 0) {
    const lines: string[] = ["[PRODUCTOS]"];

    for (const product of activeProducts) {
      const price = new Intl.NumberFormat("es-AR", {
        style:                 "currency",
        currency:              "ARS",
        minimumFractionDigits: 2,
      }).format(product.price);

      const parts = [`- ${product.name} | Precio: ${price}`];

      if (product.description) {
        parts.push(`  Descripción: ${product.description}`);
      }

      lines.push(parts.join("\n"));
    }

    blocks.push(lines.join("\n"));
  }

  if (blocks.length === 0) {
    return "No hay información disponible sobre este negocio.";
  }

  return blocks.join("\n\n");
}