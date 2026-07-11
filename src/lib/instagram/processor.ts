import { createServiceClient } from "@/lib/supabase/service";
import { processChannelMessage } from "@/lib/channels/engine";
import { sendInstagramMessage } from "./messaging";
import { getInstagramAccessToken } from "./secrets";
import { parseInstagramPayload, type InstagramWebhookPayload } from "./webhook";
import { logger } from "@/lib/logger";

/**
 * Adapter de Instagram.
 *
 * Responsabilidades:
 * 1. Buscar la conexión activa por page_id
 * 2. Desencriptar el access token
 * 3. Parsear el payload a ChannelMessage[]
 * 4. Delegar cada mensaje al motor conversacional (engine)
 * 5. Enviar la respuesta por Instagram
 * 6. Manejar errores de envío (marcar inactiva si 401)
 *
 * No contiene lógica de IA, memoria, RAG ni base de datos de mensajes.
 */
export async function processInstagramWebhook(
  payload: InstagramWebhookPayload
): Promise<void> {
  const supabase = createServiceClient();

  for (const entry of payload.entry) {
    const pageId = entry.id;

    // ── 1. Buscar conexión activa ─────────────────────────────────────
    const { data: connection } = await supabase
      .from("instagram_connections")
      .select("*")
      .eq("page_id", pageId)
      .eq("active", true)
      .maybeSingle();

    if (!connection) {
      logger.warn("instagram_processor/no_active_connection", { page_id: pageId });
      continue;
    }

    // ── 2. Desencriptar token (en memoria, nunca persiste) ────────────
    let accessToken: string;
    try {
      accessToken = getInstagramAccessToken(connection.page_access_token_encrypted);
    } catch {
      logger.error("instagram_processor/decrypt_token_failed", {
        page_id:     pageId,
        business_id: connection.business_id,
        // NUNCA loguear el token ni el error original
      });
      continue;
    }

    // ── 3. Parsear mensajes ───────────────────────────────────────────
    const channelMessages = parseInstagramPayload(
      { object: "instagram", entry: [entry] },
      connection.business_id
    );

    for (const channelMessage of channelMessages) {
      // ── 4. Delegar al motor conversacional ──────────────────────────
      const result = await processChannelMessage(supabase, channelMessage);

      // Engine devuelve vacío si fue un duplicado
      if (!result.replyText) continue;

      // ── 5. Enviar respuesta por Instagram ────────────────────────────
      const sendResult = await sendInstagramMessage(
        channelMessage.externalId,
        result.replyText,
        accessToken
      );

      if (!sendResult.success) {
        logger.error("instagram_processor/send_failed", {
          business_id:     connection.business_id,
          page_id:         pageId,
          external_msg_id: channelMessage.externalMsgId,
          http_status:     sendResult.statusCode ?? null,
        });

        // Token inválido → marcar conexión inactiva
        if (sendResult.statusCode === 401) {
          await supabase
            .from("instagram_connections")
            .update({ active: false })
            .eq("id", connection.id);

          logger.warn("instagram_processor/connection_deactivated", {
            business_id: connection.business_id,
            page_id:     pageId,
            reason:      "token_invalid_401",
          });
        }
      } else {
        logger.info("instagram_processor/message_sent", {
          business_id:      connection.business_id,
          page_id:          pageId,
          reply_message_id: sendResult.messageId,
        });
      }
    }
  }
}