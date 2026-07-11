-- =============================================================
-- Migración: create_instagram_connections
-- Descripción: Tabla de conexiones de Instagram por negocio.
--              El page_access_token se almacena encriptado con
--              AES-256-GCM usando TOKEN_ENCRYPTION_KEY del servidor.
--              Agrega channel_type a conversations para identificar
--              el canal de origen de cada conversación.
-- =============================================================

-- 1. Agregar channel_type a conversations
--    Default 'web' para no romper conversaciones existentes.
alter table public.conversations
  add column channel_type text not null default 'web';

-- Índice para buscar conversaciones por negocio + canal + contacto
create index conversations_business_channel_contact_idx
  on public.conversations(business_id, channel_type, contact_phone);

-- 2. Tabla instagram_connections
create table public.instagram_connections (
  id                          uuid        primary key default gen_random_uuid(),
  business_id                 uuid        not null unique references public.businesses(id) on delete cascade,
  page_id                     text        not null,
  instagram_id                text        not null,
  verify_token                text        not null unique,
  webhook_secret              text        not null,
  page_access_token_encrypted text        not null,
  active                      boolean     not null default true,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  constraint instagram_connections_page_id_not_blank
    check (trim(page_id) <> ''),
  constraint instagram_connections_instagram_id_not_blank
    check (trim(instagram_id) <> ''),
  constraint instagram_connections_verify_token_not_blank
    check (trim(verify_token) <> ''),
  constraint instagram_connections_webhook_secret_not_blank
    check (trim(webhook_secret) <> ''),
  constraint instagram_connections_token_not_blank
    check (trim(page_access_token_encrypted) <> '')
);

-- 3. Trigger updated_at
create trigger set_instagram_connections_updated_at
  before update on public.instagram_connections
  for each row
  execute function public.set_updated_at();

-- 4. RLS
alter table public.instagram_connections enable row level security;

create policy "owner can select own instagram connection"
  on public.instagram_connections for select
  using (
    exists (
      select 1 from public.businesses
      where businesses.id       = instagram_connections.business_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "owner can insert own instagram connection"
  on public.instagram_connections for insert
  with check (
    exists (
      select 1 from public.businesses
      where businesses.id       = instagram_connections.business_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "owner can update own instagram connection"
  on public.instagram_connections for update
  using (
    exists (
      select 1 from public.businesses
      where businesses.id       = instagram_connections.business_id
        and businesses.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.businesses
      where businesses.id       = instagram_connections.business_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "owner can delete own instagram connection"
  on public.instagram_connections for delete
  using (
    exists (
      select 1 from public.businesses
      where businesses.id       = instagram_connections.business_id
        and businesses.owner_id = auth.uid()
    )
  );

-- 5. Índices
create index instagram_connections_business_id_idx
  on public.instagram_connections(business_id);

create index instagram_connections_page_id_idx
  on public.instagram_connections(page_id);