import { metaFetch, MetaApiRequestError } from "./client";
import { type WhatsAppTextMessage, type SendMessageResult, type TestConnectionResult } from "./types";
import { logger } from "@/lib/logger";

/**
 * Envía un mensaje de texto a través de la WhatsApp Cloud API.
 *
 * Distingue entre errores recuperables y no recuperables:
 * - 401: token inválido o expirado → la conexión debe marcarse inactiva
 * - 429: rate limit → registrar para auditoría
 * - 400/403/5xx: errores permanentes o de Meta → loguear y no reintentar
 */
export async function sendMessage(
  phoneNumberId: string,
  message:       WhatsAppTextMessage
): Promise<SendMessageResult> {
  try {
    const response = await metaFetch<{
      messages: Array<{ id: string }>;
    }>(`${phoneNumberId}/messages`, {
      method: "POST",
      body:   JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type:    "individual",
        to:                message.to,
        type:              "text",
        text:              { body: message.body },
      }),
    });

    const messageId = response.messages?.[0]?.id;

    if (!messageId) {
      return {
        success: false,
        error:   "La API de WhatsApp no devolvió un ID de mensaje.",
      };
    }

    return { success: true, messageId };
  } catch (error) {
    if (error instanceof MetaApiRequestError) {
      logger.error("whatsapp/send_failed", {
        phone_number_id: phoneNumberId,
        to:              message.to,
        http_status:     error.statusCode,
        meta_code:       error.metaError?.code    ?? null,
        meta_type:       error.metaError?.type    ?? null,
        fbtrace_id:      error.metaError?.fbtrace_id ?? null,
      });

      return {
        success:    false,
        error:      resolveErrorMessage(error.statusCode),
        statusCode: error.statusCode,
        metaCode:   error.metaError?.code,
      };
    }

    logger.error("whatsapp/send_unexpected", {
      phone_number_id: phoneNumberId,
      error: String(error),
    });

    return { success: false, error: "Error inesperado al enviar el mensaje." };
  }
}

/**
 * Prueba la conexión contra la API de Meta verificando que el
 * phone_number_id es accesible con el access token configurado.
 *
 * Llama a GET /{phone_number_id} que devuelve el número y el nombre
 * verificado del negocio si las credenciales son válidas.
 */
export async function testWhatsAppConnection(
  phoneNumberId: string
): Promise<TestConnectionResult> {
  try {
    const response = await metaFetch<{
      display_phone_number: string;
      verified_name:        string;
    }>(`${phoneNumberId}?fields=display_phone_number,verified_name`);

    return {
      success:      true,
      phoneNumber:  response.display_phone_number,
      verifiedName: response.verified_name,
    };
  } catch (error) {
    if (error instanceof MetaApiRequestError) {
      logger.warn("whatsapp/test_connection_failed", {
        phone_number_id: phoneNumberId,
        http_status:     error.statusCode,
        meta_code:       error.metaError?.code       ?? null,
        fbtrace_id:      error.metaError?.fbtrace_id ?? null,
      });

      return {
        success: false,
        error:   resolveErrorMessage(error.statusCode),
        hint:    resolveErrorHint(error.statusCode),
      };
    }

    return {
      success: false,
      error:   "No se pudo conectar con la API de Meta.",
      hint:    "Verificá tu conexión a internet y volvé a intentarlo.",
    };
  }
}

function resolveErrorMessage(statusCode: number): string {
  switch (statusCode) {
    case 400: return "Los datos enviados no son válidos para Meta.";
    case 401: return "El access token es inválido o expiró.";
    case 403: return "La app no tiene permisos suficientes en Meta.";
    case 429: return "Se alcanzó el límite de mensajes de Meta. Esperá unos minutos.";
    default:  return statusCode >= 500
      ? "Meta está experimentando problemas. Intentá de nuevo más tarde."
      : "Error al comunicarse con la API de WhatsApp.";
  }
}

function resolveErrorHint(statusCode: number): string {
  switch (statusCode) {
    case 401: return "Revisá que WHATSAPP_ACCESS_TOKEN esté correctamente configurada en las variables de entorno.";
    case 403: return "Verificá que tu app de Meta tenga el permiso whatsapp_business_messaging aprobado.";
    case 400: return "Verificá que el Phone Number ID sea correcto en Meta for Developers → WhatsApp → API Setup.";
    default:  return "";
  }
}