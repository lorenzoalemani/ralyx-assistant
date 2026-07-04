export type KnowledgeEntry = {
  id: string;
  business_id: string;
  topic: string;
  title: string;
  content: string;
  metadata: Record<string, unknown> | null;
  sort_order: number;
  active: boolean;
  source: string;
  created_at: string;
  updated_at: string;
};

/**
 * Tópicos predefinidos como punto de partida.
 * El usuario puede crear entradas con cualquier tópico libre
 * además de estos.
 */
export const SUGGESTED_TOPICS = [
  "Horarios",
  "Envíos",
  "Pagos",
  "Promociones",
  "Preguntas frecuentes",
  "Políticas",
  "Sobre el negocio",
] as const;