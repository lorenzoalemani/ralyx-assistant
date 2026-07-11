import { createServiceClient } from "@/lib/supabase/service";
import { processChannelMessage } from "@/lib/channels/engine";
import { sendMessage } from "./messaging";
import { type WebhookPayload } from "./types";
import { logger } from "@/lib/logger";

/**
 * Adapter de WhatsApp.
 *
 * Responsabilidades:
 * 1. Buscar la conexión activa por phone_number_id
 * 2. Filtrar mensajes no-texto
 * 3. Construir ChannelMessage y delegar al engine
 * 4. Enviar la respuesta por WhatsApp
 * 5. Manejar errores de envío
 *
 * Toda la lógica conversacional (memoria, RAG, IA) vive en engine.ts.
 */
export async function processIncomingWebhook(
  payload: WebhookPayload
): Promise<void> {
  const supabase = createServiceClient();

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field !== "messages") continue;

      const { value } = change;
      if (!value.messages?.length) continue;

      const { phone_number_id } = value.metadata;

      // ── 1. Buscar conexión activa ─────────────────────────────────────
      const { data: connection } = await supabase
        .from("whatsapp_connections")
        .select("*")
        .eq("phone_number_id", phone_number_id)
        .eq("active", true)
        .maybeSingle();

      if (!connection) {
        logger.warn("whatsapp_processor/no_active_connection", { phone_number_id });
        continue;
      }

      for (const incoming of value.messages) {
        // ── 2. Solo mensajes de texto ─────────────────────────────────
        if (incoming.type !== "text" || !incoming.text?.body) {
          logger.info("whatsapp_processor/ignored_message_type", {
            wamid:           incoming.id,
            type:            incoming.type,
            business_id:     connection.business_id,
            phone_number_id,
          });
          continue;
        }

        // ── 3. Delegar al motor conversacional ────────────────────────
        const result = await processChannelMessage(supabase, {
          channelType:   "whatsapp",
          businessId:    connection.business_id,
          externalId:    incoming.from,
          text:          incoming.text.body.trim(),
          externalMsgId: incoming.id,
        });

        // Engine devuelve vacío si fue un duplicado
        if (!result.replyText) continue;

        // ── 4. Enviar respuesta por WhatsApp ──────────────────────────
        const sendResult = await sendMessage(phone_number_id, {
          to:   incoming.from,
          body: result.replyText,
        });

        if (!sendResult.success) {
          logger.error("whatsapp_processor/send_failed", {
            business_id:     connection.business_id,
            phone_number_id,
            wamid:           incoming.id,
            http_status:     sendResult.statusCode ?? null,
            meta_code:       sendResult.metaCode   ?? null,
          });

          if (sendResult.statusCode === 401) {
            await supabase
              .from("whatsapp_connections")
              .update({ active: false })
              .eq("id", connection.id);

            logger.warn("whatsapp_processor/connection_deactivated", {
              business_id:     connection.business_id,
              phone_number_id,
              reason:          "token_invalid_401",
            });
          }
        } else {
          logger.info("whatsapp_processor/message_sent", {
            business_id:    connection.business_id,
            wamid_outgoing: sendResult.messageId,
          });
        }
      }
    }
  }
}