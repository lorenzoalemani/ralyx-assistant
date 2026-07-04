export type Conversation = {
  id: string;
  business_id: string;
  contact_phone: string | null; // null para conversaciones del chat web
  created_at: string;
};

export type MessageRole = "user" | "assistant" | "system";

export type Message = {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  wamid: string | null; // null para mensajes del chat web
  created_at: string;
};