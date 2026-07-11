import { type SupabaseClient } from "@supabase/supabase-js";
import { type ChannelMessage, type EngineResult } from "./types";
import { buildConversationContext } from "@/lib/memory/buildConversationContext";
import { updateConversationSummary } from "@/lib/memory/updateConversationSummary";
import { semanticSearch } from "@/lib/rag/search";
import { buildRagContext } from "@/lib/rag/buildRagContext";
import { sendChatMessage } from "@/lib/ai/chat";
import { logger } from "@/lib/logger";

const FALLBACK_REPLY =
  "En este momento no puedo responder. Intentá de nuevo en unos minutos.";

/**
 * Motor conversacional agnóstico al canal.
 *
 * Recibe un ChannelMessage normalizado y orquesta:
 * 1. Deduplicación por externalMsgId
 * 2. Búsqueda o creación de conversación (por businessId + channelType + externalId)
 * 3. Guardado del mensaje del usuario
 * 4. Construcción del contexto (memoria + RAG)
 * 5. Llamada al proveedor de IA
 * 6. Guardado de la respuesta del asistente
 * 7. Actualización del resumen en background
 *
 * No conoce nada del canal origen: no sabe si es Instagram, WhatsApp o Messenger.
 * No sabe cómo enviar la respuesta — eso es responsabilidad del adapter.
 *
 * Devuelve replyText vacío si el mensaje es un duplicado.
 */
export async function processChannelMessage(
  supabase: SupabaseClient,
  message:  ChannelMessage
): Promise<EngineResult> {
  const { channelType, businessId, externalId, text, externalMsgId } = message;

  // ── 1. Deduplicación por externalMsgId ────────────────────────────────────
  //    Usa la columna wamid como identificador genérico de mensaje externo.
  const { data: duplicate } = await supabase
    .from("messages")
    .select("id")
    .eq("wamid", externalMsgId)
    .maybeSingle();

  if (duplicate) {
    logger.info("engine/duplicate_message", {
      external_msg_id: externalMsgId,
      business_id:     businessId,
      channel:         channelType,
    });
    return { replyText: "" };
  }

  // ── 2. Buscar o crear conversación ────────────────────────────────────────
  let { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("business_id", businessId)
    .eq("channel_type", channelType)
    .eq("contact_phone", externalId)
    .maybeSingle();

  if (!conversation) {
    const { data: newConv, error: convError } = await supabase
      .from("conversations")
      .insert({
        business_id:   businessId,
        channel_type:  channelType,
        contact_phone: externalId,
      })
      .select("id")
      .single();

    if (convError || !newConv) {
      logger.error("engine/create_conversation_failed", {
        business_id: businessId,
        channel:     channelType,
        error:       convError?.message ?? "unknown",
      });
      return { replyText: FALLBACK_REPLY };
    }

    conversation = newConv;
    logger.info("engine/conversation_created", {
      conversation_id: newConv.id,
      business_id:     businessId,
      channel:         channelType,
    });
  }

  // ── 3. Guardar mensaje del usuario ────────────────────────────────────────
  const { error: userMsgError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversation.id,
      role:            "user",
      content:         text,
      wamid:           externalMsgId,
    });

  if (userMsgError) {
    logger.error("engine/save_user_message_failed", {
      external_msg_id: externalMsgId,
      conversation_id: conversation.id,
      business_id:     businessId,
      error:           userMsgError.message,
    });
    return { replyText: FALLBACK_REPLY };
  }

  logger.info("engine/user_message_saved", {
    external_msg_id: externalMsgId,
    conversation_id: conversation.id,
    business_id:     businessId,
    channel:         channelType,
  });

  // ── 4. Construir contexto en paralelo ─────────────────────────────────────
  const [conversationContext, searchResult] = await Promise.all([
    buildConversationContext(supabase, conversation.id),
    semanticSearch(supabase, businessId, text),
  ]);

  const businessContext = buildRagContext(searchResult);

  logger.info("engine/context_built", {
    conversation_id:  conversation.id,
    business_id:      businessId,
    channel:          channelType,
    rag_source:       searchResult.source,
    knowledge_chunks: searchResult.knowledge.length,
    product_chunks:   searchResult.products.length,
  });

  // ── 5. Llamar al proveedor de IA ──────────────────────────────────────────
  const aiResponse = await sendChatMessage(conversationContext, businessContext);
  const replyText  = aiResponse.success ? aiResponse.content : FALLBACK_REPLY;

  if (!aiResponse.success) {
    logger.error("engine/ai_response_failed", {
      conversation_id: conversation.id,
      business_id:     businessId,
      channel:         channelType,
      error:           aiResponse.error,
    });
  }

  // ── 6. Guardar respuesta del asistente ────────────────────────────────────
  const { error: assistantMsgError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversation.id,
      role:            "assistant",
      content:         replyText,
      wamid:           null,
    });

  if (assistantMsgError) {
    logger.error("engine/save_assistant_message_failed", {
      conversation_id: conversation.id,
      business_id:     businessId,
      error:           assistantMsgError.message,
    });
  }

  // ── 7. Actualizar resumen en background ───────────────────────────────────
  updateConversationSummary(supabase, conversation.id).catch((err) => {
    logger.error("engine/update_summary_failed", {
      conversation_id: conversation.id,
      business_id:     businessId,
      error:           String(err),
    });
  });

  logger.info("engine/reply_ready", {
    conversation_id: conversation.id,
    business_id:     businessId,
    channel:         channelType,
  });

  return { replyText };
}