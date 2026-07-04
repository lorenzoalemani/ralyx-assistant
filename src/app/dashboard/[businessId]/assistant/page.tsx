import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { type Message } from "@/types/conversation";
import { ChatWindow } from "@/components/assistant/ChatWindow";

export default async function AssistantPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("id", businessId)
    .single();
  if (!business) notFound();

  // Cargar la conversación más reciente del negocio (si existe)
  const { data: latestConversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Cargar mensajes de esa conversación (si existe)
  let initialMessages: Message[] = [];
  if (latestConversation) {
    const { data: messages } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", latestConversation.id)
      .order("created_at", { ascending: true });

    initialMessages = (messages ?? []) as Message[];
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">
            Asistente
          </h1>
          <p className="mt-1 text-sm text-muted">
            Probá el asistente de IA de{" "}
            <span className="text-foreground">{business.name}</span>. Usa la
            base de conocimiento del negocio para responder.
          </p>
        </div>

        {/* Badge de proveedor activo */}
        <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
          Proveedor:{" "}
          <span className="font-medium text-foreground">
            {process.env.AI_PROVIDER ?? "mock"}
          </span>
        </span>
      </div>

      <ChatWindow
        businessId={businessId}
        initialConversationId={latestConversation?.id ?? null}
        initialMessages={initialMessages}
      />
    </div>
  );
}