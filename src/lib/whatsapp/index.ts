/**
 * Punto de entrada único para el servicio de WhatsApp.
 * Importar desde aquí en lugar de los módulos individuales.
 */

export { sendMessage }                                        from "./messaging";
export { verifyWebhookSignature, verifyWebhookChallenge, processWebhook } from "./webhook";
export { getAccessToken }                                     from "./secrets";
export { buildApiUrl, buildHeaders }                          from "./client";
export type {
  WhatsAppTextMessage,
  WebhookPayload,
  IncomingMessage,
  SendMessageResult,
}                                                             from "./types";