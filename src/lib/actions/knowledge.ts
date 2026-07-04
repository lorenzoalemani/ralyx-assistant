"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";
import { type KnowledgeEntry } from "@/types/knowledge";
import { indexKnowledgeEntry } from "@/lib/rag/indexing";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type CreateEntryInput = {
  business_id: string;
  topic:       string;
  title:       string;
  content:     string;
};

type UpdateEntryInput = {
  id:          string;
  business_id: string;
  topic:       string;
  title:       string;
  content:     string;
  active:      boolean;
};

type ActionResult =
  | { success: true;  entry: KnowledgeEntry }
  | { success: false; error: string };

type DeleteResult =
  | { success: true }
  | { success: false; error: string };

// ─── Validación ───────────────────────────────────────────────────────────────

function validateFields(
  topic:   string,
  title:   string,
  content: string
): string | null {
  if (!topic.trim())   return "El tópico no puede estar vacío.";
  if (!title.trim())   return "El título no puede estar vacío.";
  if (!content.trim()) return "El contenido no puede estar vacío.";
  if (topic.trim().length   > 80)   return "El tópico no puede superar los 80 caracteres.";
  if (title.trim().length   > 150)  return "El título no puede superar los 150 caracteres.";
  if (content.trim().length > 5000) return "El contenido no puede superar los 5000 caracteres.";
  return null;
}

// ─── Ownership ────────────────────────────────────────────────────────────────

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

export async function createKnowledgeEntry(
  input: CreateEntryInput
): Promise<ActionResult> {
  const validationError = validateFields(input.topic, input.title, input.content);
  if (validationError) return { success: false, error: validationError };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado." };

  const isOwner = await verifyBusinessOwnership(supabase, input.business_id);
  if (!isOwner) return { success: false, error: "Negocio no encontrado." };

  const { data, error } = await supabase
    .from("knowledge_entries")
    .insert({
      business_id: input.business_id,
      topic:       input.topic.trim(),
      title:       input.title.trim(),
      content:     input.content.trim(),
      source:      "manual",
      active:      true,
    })
    .select()
    .single();

  if (error) return { success: false, error: "No se pudo crear la entrada." };

  const entry = data as KnowledgeEntry;

  // Indexación asíncrona con after(): el guardado principal ya fue exitoso.
  // Si falla la indexación, la entry existe pero no tendrá embedding — se
  // puede reindexar con reindexBusiness() cuando sea necesario.
  after(async () => {
    try {
      const serviceClient = createServiceClient();
      await indexKnowledgeEntry(serviceClient, {
        id:          entry.id,
        business_id: entry.business_id,
        topic:       entry.topic,
        title:       entry.title,
        content:     entry.content,
      });
    } catch (err) {
      console.error("[knowledge] Error al indexar entry:", err);
    }
  });

  revalidatePath(`/dashboard/${input.business_id}/knowledge`);
  return { success: true, entry };
}

export async function updateKnowledgeEntry(
  input: UpdateEntryInput
): Promise<ActionResult> {
  const validationError = validateFields(input.topic, input.title, input.content);
  if (validationError) return { success: false, error: validationError };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado." };

  const isOwner = await verifyBusinessOwnership(supabase, input.business_id);
  if (!isOwner) return { success: false, error: "Negocio no encontrado." };

  const { data, error } = await supabase
    .from("knowledge_entries")
    .update({
      topic:   input.topic.trim(),
      title:   input.title.trim(),
      content: input.content.trim(),
      active:  input.active,
    })
    .eq("id", input.id)
    .select()
    .single();

  if (error) return { success: false, error: "No se pudo actualizar la entrada." };

  const entry = data as KnowledgeEntry;

  // Re-indexar con el nuevo contenido
  after(async () => {
    try {
      const serviceClient = createServiceClient();
      await indexKnowledgeEntry(serviceClient, {
        id:          entry.id,
        business_id: entry.business_id,
        topic:       entry.topic,
        title:       entry.title,
        content:     entry.content,
      });
    } catch (err) {
      console.error("[knowledge] Error al re-indexar entry:", err);
    }
  });

  revalidatePath(`/dashboard/${input.business_id}/knowledge`);
  return { success: true, entry };
}

export async function deleteKnowledgeEntry(
  id:         string,
  businessId: string
): Promise<DeleteResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado." };

  const { error } = await supabase
    .from("knowledge_entries")
    .delete()
    .eq("id", id);

  // El trigger cleanup_knowledge_entry_embedding elimina el embedding en DB.
  if (error) return { success: false, error: "No se pudo eliminar la entrada." };

  revalidatePath(`/dashboard/${businessId}/knowledge`);
  return { success: true };
}