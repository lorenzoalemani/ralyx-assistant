import { instagramFetch, MetaApiRequestError } from "./client";
import { logger } from "@/lib/logger";

type SendResult =
  | { success: true;  messageId: string }
  | { success: false; error: string; statusCode?: number };

type TestResult =
  | { success: true;  instagramId: string; username: string }
  | { success: false; error: string; hint?: string };

/**
 * Envía un mensaje de texto a través de la Instagram Messaging API.
 * Usa el endpoint /me/messages que resuelve a la Página cuyo token se usa.
 *
 * Nota: Instagram solo permite responder si el usuario escribió primero
 * (ventana de mensajería de 24 horas). Intentar escribir fuera de esa
 * ventana devuelve un 400.
 */
export async function sendInstagramMessage(
  recipientId: string,
  text:        string,
  accessToken: string
): Promise<SendResult> {
  try {
    const response = await instagramFetch<{ message_id: string }>(
      "me/messages",
      accessToken,
      {
        method: "POST",
        body:   JSON.stringify({
          recipient: { id: recipientId },
          message:   { text },
        }),
      }
    );

    if (!response.message_id) {
      return { success: false, error: "Instagram API no devolvió un message_id." };
    }

    return { success: true, messageId: response.message_id };
  } catch (error) {
    if (error instanceof MetaApiRequestError) {
      logger.error("instagram/send_failed", {
        recipient_id: recipientId,
        http_status:  error.statusCode,
        meta_code:    error.metaError?.code       ?? null,
        fbtrace_id:   error.metaError?.fbtrace_id ?? null,
        // NUNCA loguear accessToken
      });
      return {
        success:    false,
        error:      resolveErrorMessage(error.statusCode),
        statusCode: error.statusCode,
      };
    }

    logger.error("instagram/send_unexpected", {
      recipient_id: recipientId,
      error:        String(error),
    });
    return { success: false, error: "Error inesperado al enviar mensaje de Instagram." };
  }
}

/**
 * Verifica que el page_id y el access token sean válidos consultando
 * la cuenta de Instagram Business vinculada a la Página.
 */
export async function testInstagramConnectionAPI(
  pageId:      string,
  accessToken: string
): Promise<TestResult> {
  try {
    const response = await instagramFetch<{
      instagram_business_account?: { id: string; username: string };
    }>(
      `${pageId}?fields=instagram_business_account`,
      accessToken
    );

    const igAccount = response.instagram_business_account;
    if (!igAccount) {
      return {
        success: false,
        error:   "La Página no tiene una cuenta de Instagram Business vinculada.",
        hint:    "Vinculá la cuenta de Instagram Professional en Configuración → Página de Facebook.",
      };
    }

    return {
      success:     true,
      instagramId: igAccount.id,
      username:    igAccount.username,
    };
  } catch (error) {
    if (error instanceof MetaApiRequestError) {
      return {
        success: false,
        error:   resolveErrorMessage(error.statusCode),
        hint:    resolveErrorHint(error.statusCode),
      };
    }
    return { success: false, error: "No se pudo conectar con la API de Meta." };
  }
}

function resolveErrorMessage(statusCode: number): string {
  switch (statusCode) {
    case 400: return "El usuario no puede recibir mensajes o la ventana de 24 horas expiró.";
    case 401: return "El Page Access Token es inválido o expiró.";
    case 403: return "La app no tiene permisos suficientes para enviar mensajes.";
    case 429: return "Límite de mensajes alcanzado. Esperá unos minutos.";
    default:  return statusCode >= 500
      ? "Meta está experimentando problemas. Intentá de nuevo más tarde."
      : "Error al comunicarse con la API de Instagram.";
  }
}

function resolveErrorHint(statusCode: number): string {
  switch (statusCode) {
    case 401: return "Verificá que el Page Access Token no haya expirado. Los tokens de usuario expiran; usá tokens de sistema para producción.";
    case 403: return "Verificá que la app tenga el permiso instagram_manage_messages aprobado en Meta for Developers.";
    case 400: return "Verificá que el Page ID sea correcto y que la Página tenga Instagram Business vinculado.";
    default:  return "";
  }
}