/**
 * Tipos internos del servicio de WhatsApp.
 * Modelan los payloads de la Cloud API de Meta.
 */

export type WhatsAppTextMessage = {
  to:   string;
  body: string;
};

export type WebhookEntry = {
  id:      string;
  changes: WebhookChange[];
};

export type WebhookChange = {
  value: WebhookValue;
  field: string;
};

export type WebhookValue = {
  messaging_product: "whatsapp";
  metadata: {
    display_phone_number: string;
    phone_number_id:      string;
  };
  messages?: IncomingMessage[];
  statuses?: MessageStatus[];
};

export type IncomingMessage = {
  from:      string;
  id:        string;
  timestamp: string;
  type:      "text" | "image" | "audio" | "document" | "interactive";
  text?:     { body: string };
};

export type MessageStatus = {
  id:           string;
  status:       "sent" | "delivered" | "read" | "failed";
  timestamp:    string;
  recipient_id: string;
};

export type WebhookPayload = {
  object: "whatsapp_business_account";
  entry:  WebhookEntry[];
};

export type SendMessageResult =
  | { success: true;  messageId: string }
  | { success: false; error: string; statusCode?: number; metaCode?: number };

/**
 * Estructura del error que devuelve la Graph API de Meta.
 */
export type MetaApiError = {
  message:    string;
  type:       string;
  code:       number;
  fbtrace_id: string;
};

export type MetaApiErrorResponse = {
  error: MetaApiError;
};

/**
 * Resultado de probar la conexión contra la API de Meta.
 */
export type TestConnectionResult =
  | { success: true;  phoneNumber: string; verifiedName: string }
  | { success: false; error: string; hint?: string };