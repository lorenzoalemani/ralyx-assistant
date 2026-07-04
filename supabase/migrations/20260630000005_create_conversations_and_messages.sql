-- =============================================================
-- Migración: create_conversations_and_messages
-- Descripción: Tablas para el historial de conversaciones con IA.
--
-- RLS en messages traversa dos niveles:
--   messages → conversations → businesses → owner_id = auth.uid()
-- =============================================================

-- 1. Tabla conversations
create table public.conversations (
  id          uuid        primary key default gen_random_uuid(),
  business_id uuid        not null references public.businesses(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- 2. RLS conversations
alter table public.conversations enable row level security;

create policy "owner can select own conversations"
  on public.conversations for select
  using (
    exists (
      select 1 from public.businesses
      where businesses.id       = conversations.business_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "owner can insert own conversations"
  on public.conversations for insert
  with check (
    exists (
      select 1 from public.businesses
      where businesses.id       = conversations.business_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "owner can delete own conversations"
  on public.conversations for delete
  using (
    exists (
      select 1 from public.businesses
      where businesses.id       = conversations.business_id
        and businesses.owner_id = auth.uid()
    )
  );

-- 3. Tabla messages
--    role usa CHECK en lugar de enum para facilitar migraciones futuras
--    (agregar 'tool', 'function', etc. solo requiere ALTER CONSTRAINT).
create table public.messages (
  id              uuid        primary key default gen_random_uuid(),
  conversation_id uuid        not null references public.conversations(id) on delete cascade,
  role            text        not null,
  content         text        not null,
  created_at      timestamptz not null default now(),

  constraint messages_role_valid    check (role in ('user', 'assistant', 'system')),
  constraint messages_content_not_blank check (trim(content) <> '')
);

-- 4. RLS messages
--    Traversa dos tablas: messages → conversations → businesses
alter table public.messages enable row level security;

create policy "owner can select own messages"
  on public.messages for select
  using (
    exists (
      select 1
      from public.conversations
      join public.businesses on businesses.id = conversations.business_id
      where conversations.id    = messages.conversation_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "owner can insert own messages"
  on public.messages for insert
  with check (
    exists (
      select 1
      from public.conversations
      join public.businesses on businesses.id = conversations.business_id
      where conversations.id    = messages.conversation_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "owner can delete own messages"
  on public.messages for delete
  using (
    exists (
      select 1
      from public.conversations
      join public.businesses on businesses.id = conversations.business_id
      where conversations.id    = messages.conversation_id
        and businesses.owner_id = auth.uid()
    )
  );

-- 5. Índices
create index conversations_business_id_idx
  on public.conversations(business_id);

create index messages_conversation_id_idx
  on public.messages(conversation_id);

-- Útil para cargar mensajes ordenados cronológicamente
create index messages_conversation_created_idx
  on public.messages(conversation_id, created_at);