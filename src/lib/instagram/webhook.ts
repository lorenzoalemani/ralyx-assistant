import { type ChannelMessage } from "@/lib/channels/types";

export type InstagramWebhookPayload = {
  object: "instagram";
  entry: Array<{
    id:   string;   // page_id
    time: number;
    messaging: Array<{
      sender:    { id: string };
      recipient: { id: string };
      timestamp: number;
      message?: {
        mid:     string;
        text?:   string;
        is_echo?: boolean;
      };
    }>;
  }>;
};

/**
 * Parsea el payload de Instagram y devuelve mensajes normalizados.
 *
 * Filtra:
 * - Mensajes sin texto (imágenes, stickers, reacciones, etc.)
 * - Echoes (mensajes enviados por la propia Página)
 * - Mensajes sin mid (no deduplicables)
 */
export function parseInstagramPayload(
  payload:    InstagramWebhookPayload,
  businessId: string
): ChannelMessage[] {
  const messages: ChannelMessage[] = [];

  for (const entry of payload.entry) {
    for (const event of entry.messaging ?? []) {
      // Filtrar echoes (mensajes enviados por la página misma)
      if (event.message?.is_echo) continue;

      // Solo mensajes de texto con mid
      if (!event.message?.text) continue;
      if (!event.message.mid)   continue;

      messages.push({
        channelType:   "instagram",
        businessId,
        externalId:    event.sender.id,
        text:          event.message.text.trim(),
        externalMsgId: event.message.mid,
      });
    }
  }

  return messages;
}