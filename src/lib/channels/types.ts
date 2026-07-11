/**
 * Tipos compartidos de la capa de canales.
 * Define el formato interno normalizado que todos los adapters
 * (Instagram, WhatsApp, Messenger) deben producir.
 *
 * El motor conversacional (engine.ts) solo conoce estos tipos.
 * Nunca importa tipos específicos de un canal.
 */

export type ChannelType = "web" | "instagram" | "whatsapp" | "messenger";

/**
 * Mensaje normalizado procedente de cualquier canal.
 * Los adapters son responsables de traducir desde el formato
 * nativo del canal a este tipo.
 */
export type ChannelMessage = {
  channelType:    ChannelType;
  businessId:     string;
  /** Identificador del remitente en el canal (teléfono, instagram_scoped_id, etc.) */
  externalId:     string;
  text:           string;
  /** ID único del mensaje en el canal — usado para deduplicación */
  externalMsgId:  string;
};

export type EngineResult = {
  /**
   * Texto de respuesta generado por la IA.
   * Vacío ("") si el mensaje fue un duplicado y no debe responderse.
   */
  replyText: string;
};