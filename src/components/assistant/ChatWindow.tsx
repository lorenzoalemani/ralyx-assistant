"use client";

import {
  useState,
  useRef,
  useEffect,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { sendMessage, createConversation } from "@/lib/actions/conversations";
import { ChatMessageBubble } from "./ChatMessage";
import { TypingIndicator } from "./TypingIndicator";
import { type Message } from "@/types/conversation";

interface ChatWindowProps {
  businessId: string;
  initialConversationId: string | null;
  initialMessages: Message[];
}

export function ChatWindow({
  businessId,
  initialConversationId,
  initialMessages,
}: ChatWindowProps) {
  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId
  );
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput]       = useState("");
  const [typing, setTyping]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll automático al último mensaje
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  // Auto-resize del textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();

    const trimmed = input.trim();
    if (!trimmed || typing) return;

    setError(null);
    setInput("");
    setTyping(true);

    // Crear conversación si no existe aún
    let activeConversationId = conversationId;
    if (!activeConversationId) {
      const result = await createConversation(businessId);
      if (!result.success) {
        setError("No se pudo iniciar la conversación.");
        setTyping(false);
        return;
      }
      activeConversationId = result.conversation.id;
      setConversationId(activeConversationId);
    }

    // Mostrar el mensaje del usuario optimísticamente en la UI
    const optimisticUserMsg: Message = {
      id:              `optimistic-${Date.now()}`,
      conversation_id: activeConversationId,
      role:            "user",
      content:         trimmed,
      created_at:      new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUserMsg]);

    // Enviar al servidor y obtener respuesta de la IA
    const result = await sendMessage(activeConversationId, businessId, trimmed);

    setTyping(false);

    if (!result.success) {
      setError(result.error);
      // Revertir el mensaje optimístico si falló
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUserMsg.id));
      return;
    }

    // Reemplazar el optimístico por los mensajes reales del servidor
    setMessages((prev) => [
      ...prev.filter((m) => m.id !== optimisticUserMsg.id),
      result.userMessage,
      result.assistantMessage,
    ]);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sin Shift envía el mensaje
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const isEmpty = messages.length === 0 && !typing;

  return (
    <div className="flex h-[calc(100vh-13rem)] flex-col rounded-2xl border border-border bg-surface overflow-hidden">
      {/* Historial de mensajes */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="9" stroke="#7C5CFF" strokeWidth="1.8" />
                <path
                  d="M9 12c0-1 .7-1.8 1.8-1.8H13M12 15v-3"
                  stroke="#7C5CFF"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <p className="font-display font-semibold text-foreground">
              El asistente está listo
            </p>
            <p className="max-w-xs text-sm text-muted">
              Escribí una pregunta para probar el asistente. Usa la base de
              conocimiento del negocio para responder.
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <ChatMessageBubble key={message.id} message={message} />
            ))}
            {typing && <TypingIndicator />}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border p-3">
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent transition-colors"
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribí tu mensaje... (Enter para enviar)"
            disabled={typing}
            className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted/60 outline-none disabled:opacity-50"
            style={{ maxHeight: "160px" }}
          />
          <button
            type="submit"
            disabled={!input.trim() || typing}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white transition-colors hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Enviar mensaje"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path
                d="M12 7L2 2l2.5 5L2 12l10-5z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </form>
        <p className="mt-1.5 text-center text-xs text-muted/50">
          Shift + Enter para nueva línea
        </p>
      </div>
    </div>
  );
}