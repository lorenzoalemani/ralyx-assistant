-- =============================================================
-- Migración: create_knowledge_entries
-- Descripción: Base de conocimiento flexible por negocio.
--              Cada fila es un bloque de información que la IA
--              puede consumir directamente como contexto.
-- =============================================================

-- 1. Función genérica para actualizar updated_at
--    Se crea una sola vez y se reutiliza en cualquier tabla
--    que necesite este comportamiento.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. Tabla
create table public.knowledge_entries (
  id          uuid        primary key default gen_random_uuid(),
  business_id uuid        not null references public.businesses(id) on delete cascade,
  topic       text        not null,
  title       text        not null,
  content     text        not null,
  metadata    jsonb,
  sort_order  integer     not null default 0,
  active      boolean     not null default true,
  source      text        not null default 'manual',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint knowledge_entries_topic_not_blank   check (trim(topic)   <> ''),
  constraint knowledge_entries_title_not_blank   check (trim(title)   <> ''),
  constraint knowledge_entries_content_not_blank check (trim(content) <> ''),
  constraint knowledge_entries_source_not_blank  check (trim(source)  <> '')
);

-- 3. Trigger para updated_at
create trigger set_knowledge_entries_updated_at
  before update on public.knowledge_entries
  for each row
  execute function public.set_updated_at();

-- 4. Activar RLS
--    Misma estrategia que products: se traversa businesses
--    para verificar ownership sin tener owner_id directo.
alter table public.knowledge_entries enable row level security;

-- 5. Políticas por operación
create policy "owner can select own knowledge entries"
  on public.knowledge_entries
  for select
  using (
    exists (
      select 1 from public.businesses
      where businesses.id       = knowledge_entries.business_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "owner can insert own knowledge entries"
  on public.knowledge_entries
  for insert
  with check (
    exists (
      select 1 from public.businesses
      where businesses.id       = knowledge_entries.business_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "owner can update own knowledge entries"
  on public.knowledge_entries
  for update
  using (
    exists (
      select 1 from public.businesses
      where businesses.id       = knowledge_entries.business_id
        and businesses.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.businesses
      where businesses.id       = knowledge_entries.business_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "owner can delete own knowledge entries"
  on public.knowledge_entries
  for delete
  using (
    exists (
      select 1 from public.businesses
      where businesses.id       = knowledge_entries.business_id
        and businesses.owner_id = auth.uid()
    )
  );

-- 6. Índices
create index knowledge_entries_business_id_idx
  on public.knowledge_entries(business_id);

-- Útil para filtrar por tópico y para construir el contexto ordenado
create index knowledge_entries_business_topic_idx
  on public.knowledge_entries(business_id, topic);