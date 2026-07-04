"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { type Conversation, type Message } from "@/types/conversation";
import { sendChatMessage } from "@/lib/ai/chat";
import { buildConversationContext } from "@/lib/memory/buildConversationContext";
import { updateConversationSummary } from "@/lib/memory/updateConversationSummary";
import { semanticSearch } from "@/lib/rag/search";
import { buildRagContext } from "@/lib/rag/buildRagContext";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type CreateConversationResult =
  | { success: true;  conversation: Conversation }
  | { success: false; error: string };

type SendMessageResult =
  | { success: true;  userMessage: Message; assistantMessage: Message }
  | { success: false; error: string };

type GetHistoryResult =
  | { success: true;  messages: Message[] }
  | { success: false; error: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function verifyBusinessOwnership(
  supabase:   Awaited<ReturnType<typeof createClient>>,
  businessId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .single();
  return !!data;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function createConversation(
  businessId: string
): Promise<CreateConversationResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado." };

  const isOwner = await verifyBusinessOwnership(supabase, businessId);
  if (!isOwner) return { success: false, error: "Negocio no encontrado." };

  const { data, error } = await supabase
    .from("conversations")
    .insert({ business_id: businessId, contact_phone: null })
    .select()
    .single();

  if (error) return { success: false, error: "No se pudo crear la conversación." };
  return { success: true, conversation: data as Conversation };
}

export async function sendMessage(
  conversationId: string,
  businessId:     string,
  content:        string
): Promise<SendMessageResult> {
  const trimmed = content.trim();
  if (!trimmed)             return { success: false, error: "El mensaje no puede estar vacío." };
  if (trimmed.length > 2000) return { success: false, error: "El mensaje no puede superar los 2000 caracteres." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado." };

  const isOwner = await verifyBusinessOwnership(supabase, businessId);
  if (!isOwner) return { success: false, error: "Negocio no encontrado." };

  // ── 1. Insertar mensaje del usuario ──────────────────────────────────────
  const { data: userMsg, error: userMsgError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      role:            "user",
      content:         trimmed,
      wamid:           null,
    })
    .select()
    .single();

  if (userMsgError) return { success: false, error: "No se pudo guardar el mensaje." };

  // ── 2. Construir contexto de conversación y contexto del negocio en paralelo
  const [conversationContext, searchResult] = await Promise.all([
    buildConversationContext(supabase, conversationId),
    semanticSearch(supabase, businessId, trimmed),
  ]);

  const businessContext = buildRagContext(searchResult);

  // ── 3. Llamar al proveedor de IA ──────────────────────────────────────────
  const aiResponse = await sendChatMessage(conversationContext, businessContext);
  if (!aiResponse.success) return { success: false, error: aiResponse.error };

  // ── 4. Insertar respuesta del asistente ───────────────────────────────────
  const { data: assistantMsg, error: assistantMsgError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      role:            "assistant",
      content:         aiResponse.content,
      wamid:           null,
    })
    .select()
    .single();

  if (assistantMsgError) return { success: false, error: "No se pudo guardar la respuesta del asistente." };

  // ── 5. Actualizar resumen en background ───────────────────────────────────
  after(async () => {
    try {
      await updateConversationSummary(supabase, conversationId);
    } catch (error) {
      console.error("[conversations] Error al actualizar resumen:", error);
    }
  });

  revalidatePath(`/dashboard/${businessId}/assistant`);
  return {
    success:          true,
    userMessage:      userMsg      as Message,
    assistantMessage: assistantMsg as Message,
  };
}

export async function getConversationHistory(
  conversationId: string
): Promise<GetHistoryResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado." };

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) return { success: false, error: "No se pudo cargar el historial." };
  return { success: true, messages: (data ?? []) as Message[] };
}