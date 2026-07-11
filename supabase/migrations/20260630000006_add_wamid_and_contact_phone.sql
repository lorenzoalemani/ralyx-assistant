-- =============================================================
-- Migración: add_wamid_and_contact_phone
-- Descripción: Extiende conversations y messages para soportar
--              mensajes entrantes de WhatsApp.
--
-- contact_phone: número del cliente en la conversación de WhatsApp
-- wamid: ID único de mensaje asignado por Meta, usado para deduplicación
-- =============================================================

-- 1. Agregar contact_phone a conversations
--    Nullable: las conversaciones del chat web no tienen número de teléfono.
alter table public.conversations
  add column contact_phone text;

-- 2. Índice compuesto para buscar conversación por negocio + teléfono
--    Es la query crítica del webhook: "¿ya existe una conversación con este número?"
create index conversations_business_contact_idx
  on public.conversations(business_id, contact_phone);

-- 3. Agregar wamid a messages
--    Nullable: los mensajes del chat web no tienen wamid.
alter table public.messages
  add column wamid text;

-- 4. Índice único parcial sobre wamid no nulo
--    Previene procesar el mismo mensaje de WhatsApp dos veces.
--    El índice parcial (WHERE wamid IS NOT NULL) evita conflictos
--    entre los mensajes del chat web que tienen wamid = NULL.
create unique index messages_wamid_unique_idx
  on public.messages(wamid)
  where wamid is not null;