import { createServiceClient } from "@/lib/supabase/service";
import { sendChatMessage } from "@/lib/ai/chat";
import { buildConversationContext } from "@/lib/memory/buildConversationContext";
import { updateConversationSummary } from "@/lib/memory/updateConversationSummary";
import { semanticSearch } from "@/lib/rag/search";
import { buildRagContext } from "@/lib/rag/buildRagContext";
import { sendMessage } from "./messaging";
import { type WebhookPayload } from "./types";
import { type ChatMessage } from "@/lib/ai/types";
import { logger } from "@/lib/logger";

const FALLBACK_MESSAGE =
  "En este momento no puedo responder. Intentá de nuevo en unos minutos.";

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
        logger.warn("processor/no_active_connection", { phone_number_id });
        continue;
      }

      for (const incoming of value.messages) {
        // ── 2. Solo mensajes de texto ─────────────────────────────────
        if (incoming.type !== "text" || !incoming.text?.body) {
          logger.info("processor/ignored_message_type", {
            wamid:           incoming.id,
            type:            incoming.type,
            business_id:     connection.business_id,
            phone_number_id,
          });
          continue;
        }

        const wamid          = incoming.id;
        const contactPhone   = incoming.from;
        const messageContent = incoming.text.body.trim();

        // ── 3. Deduplicación ──────────────────────────────────────────
        const { data: duplicate } = await supabase
          .from("messages")
          .select("id")
          .eq("wamid", wamid)
          .maybeSingle();

        if (duplicate) {
          logger.info("processor/duplicate_wamid", { wamid, business_id: connection.business_id });
          continue;
        }

        // ── 4. Buscar o crear conversación ────────────────────────────
        let { data: conversation } = await supabase
          .from("conversations")
          .select("id")
          .eq("business_id", connection.business_id)
          .eq("contact_phone", contactPhone)
          .maybeSingle();

        if (!conversation) {
          const { data: newConv, error: convError } = await supabase
            .from("conversations")
            .insert({ business_id: connection.business_id, contact_phone: contactPhone })
            .select("id")
            .single();

          if (convError || !newConv) {
            logger.error("processor/create_conversation_failed", {
              business_id: connection.business_id,
              error:       convError?.message ?? "unknown",
            });
            continue;
          }

          conversation = newConv;
          logger.info("processor/conversation_created", {
            conversation_id: newConv.id,
            business_id:     connection.business_id,
          });
        }

        // ── 5. Guardar mensaje del usuario ────────────────────────────
        const { error: userMsgError } = await supabase
          .from("messages")
          .insert({
            conversation_id: conversation.id,
            role:            "user",
            content:         messageContent,
            wamid,
          });

        if (userMsgError) {
          logger.error("processor/save_user_message_failed", {
            wamid,
            conversation_id: conversation.id,
            business_id:     connection.business_id,
            error:           userMsgError.message,
          });
          continue;
        }

        logger.info("processor/user_message_saved", {
          wamid,
          conversation_id: conversation.id,
          business_id:     connection.business_id,
        });

        // ── 6. Construir contexto en paralelo ─────────────────────────
        const [conversationContext, searchResult] = await Promise.all([
          buildConversationContext(supabase, conversation.id) as Promise<ChatMessage[]>,
          semanticSearch(supabase, connection.business_id, messageContent),
        ]);

        const businessContext = buildRagContext(searchResult);

        logger.info("processor/context_built", {
          conversation_id:   conversation.id,
          business_id:       connection.business_id,
          rag_source:        searchResult.source,
          knowledge_chunks:  searchResult.knowledge.length,
          product_chunks:    searchResult.products.length,
        });

        // ── 7. Llamar al proveedor de IA ──────────────────────────────
        const aiResponse = await sendChatMessage(conversationContext, businessContext);

        const replyContent = aiResponse.success
          ? aiResponse.content
          : FALLBACK_MESSAGE;

        if (!aiResponse.success) {
          logger.error("processor/ai_response_failed", {
            conversation_id: conversation.id,
            business_id:     connection.business_id,
            error:           aiResponse.error,
          });
        }

        // ── 8. Guardar respuesta del asistente ────────────────────────
        const { error: assistantMsgError } = await supabase
          .from("messages")
          .insert({
            conversation_id: conversation.id,
            role:            "assistant",
            content:         replyContent,
            wamid:           null,
          });

        if (assistantMsgError) {
          logger.error("processor/save_assistant_message_failed", {
            conversation_id: conversation.id,
            business_id:     connection.business_id,
            error:           assistantMsgError.message,
          });
        }

        // ── 9. Actualizar resumen en background ───────────────────────
        updateConversationSummary(supabase, conversation.id).catch((err) => {
          logger.error("processor/update_summary_failed", {
            conversation_id: conversation.id,
            business_id:     connection.business_id,
            error:           String(err),
          });
        });

        // ── 10. Enviar respuesta por WhatsApp ─────────────────────────
        const sendResult = await sendMessage(phone_number_id, {
          to:   contactPhone,
          body: replyContent,
        });

        if (!sendResult.success) {
          logger.error("processor/whatsapp_send_failed", {
            conversation_id: conversation.id,
            business_id:     connection.business_id,
            phone_number_id,
            http_status:     sendResult.statusCode ?? null,
            meta_code:       sendResult.metaCode   ?? null,
          });

          if (sendResult.statusCode === 401) {
            await supabase
              .from("whatsapp_connections")
              .update({ active: false })
              .eq("id", connection.id);

            logger.warn("processor/connection_deactivated", {
              business_id:     connection.business_id,
              phone_number_id,
              reason:          "token_invalid_401",
            });
          }
        } else {
          logger.info("processor/whatsapp_message_sent", {
            wamid_outgoing:  sendResult.messageId,
            conversation_id: conversation.id,
            business_id:     connection.business_id,
          });
        }
      }
    }
  }
}