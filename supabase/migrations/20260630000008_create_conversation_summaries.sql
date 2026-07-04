-- =============================================================
-- Migración: create_conversation_summaries
-- Descripción: Tabla para resúmenes comprimidos de conversaciones.
--              Implementa la capa de memoria media del sistema
--              sliding window + summary.
--
-- RLS traversa dos niveles:
--   conversation_summaries → conversations → businesses → owner_id
-- =============================================================

-- 1. Tabla
create table public.conversation_summaries (
  id              uuid        primary key default gen_random_uuid(),
  conversation_id uuid        not null unique references public.conversations(id) on delete cascade,
  summary         text        not null,
  messages_count  integer     not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint conversation_summaries_summary_not_blank
    check (trim(summary) <> '')
);

-- 2. Trigger updated_at (reutiliza la función creada en migración anterior)
create trigger set_conversation_summaries_updated_at
  before update on public.conversation_summaries
  for each row
  execute function public.set_updated_at();

-- 3. RLS
alter table public.conversation_summaries enable row level security;

create policy "owner can select own conversation summaries"
  on public.conversation_summaries for select
  using (
    exists (
      select 1
      from public.conversations
      join public.businesses on businesses.id = conversations.business_id
      where conversations.id    = conversation_summaries.conversation_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "owner can insert own conversation summaries"
  on public.conversation_summaries for insert
  with check (
    exists (
      select 1
      from public.conversations
      join public.businesses on businesses.id = conversations.business_id
      where conversations.id    = conversation_summaries.conversation_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "owner can update own conversation summaries"
  on public.conversation_summaries for update
  using (
    exists (
      select 1
      from public.conversations
      join public.businesses on businesses.id = conversations.business_id
      where conversations.id    = conversation_summaries.conversation_id
        and businesses.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.conversations
      join public.businesses on businesses.id = conversations.business_id
      where conversations.id    = conversation_summaries.conversation_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "owner can delete own conversation summaries"
  on public.conversation_summaries for delete
  using (
    exists (
      select 1
      from public.conversations
      join public.businesses on businesses.id = conversations.business_id
      where conversations.id    = conversation_summaries.conversation_id
        and businesses.owner_id = auth.uid()
    )
  );

-- 4. Índice (el unique ya crea uno, pero lo nombramos explícitamente)
create index conversation_summaries_conversation_id_idx
  on public.conversation_summaries(conversation_id);