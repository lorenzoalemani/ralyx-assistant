-- =============================================================
-- Migración: create_whatsapp_connections
-- Descripción: Configuración de WhatsApp Cloud API por negocio.
--
-- DECISIÓN DE ARQUITECTURA:
-- El access_token NO se almacena en la base de datos.
-- Se obtiene en runtime desde variables de entorno o un sistema
-- de secretos externo a través de getAccessToken() en client.ts.
-- Esta tabla guarda únicamente la configuración propia del negocio.
-- =============================================================

create table public.whatsapp_connections (
  id                   uuid        primary key default gen_random_uuid(),
  business_id          uuid        not null unique references public.businesses(id) on delete cascade,
  phone_number_id      text        not null,
  business_account_id  text        not null,
  verify_token         text        not null,
  webhook_secret       text        not null,
  active               boolean     not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint whatsapp_connections_phone_number_id_not_blank      check (trim(phone_number_id)     <> ''),
  constraint whatsapp_connections_business_account_id_not_blank  check (trim(business_account_id) <> ''),
  constraint whatsapp_connections_verify_token_not_blank         check (trim(verify_token)        <> ''),
  constraint whatsapp_connections_webhook_secret_not_blank       check (trim(webhook_secret)      <> '')
);

-- Reutilizamos la función set_updated_at() creada en la migración anterior
create trigger set_whatsapp_connections_updated_at
  before update on public.whatsapp_connections
  for each row
  execute function public.set_updated_at();

-- RLS: mismo patrón que products y knowledge_entries
alter table public.whatsapp_connections enable row level security;

create policy "owner can select own whatsapp connection"
  on public.whatsapp_connections
  for select
  using (
    exists (
      select 1 from public.businesses
      where businesses.id       = whatsapp_connections.business_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "owner can insert own whatsapp connection"
  on public.whatsapp_connections
  for insert
  with check (
    exists (
      select 1 from public.businesses
      where businesses.id       = whatsapp_connections.business_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "owner can update own whatsapp connection"
  on public.whatsapp_connections
  for update
  using (
    exists (
      select 1 from public.businesses
      where businesses.id       = whatsapp_connections.business_id
        and businesses.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.businesses
      where businesses.id       = whatsapp_connections.business_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "owner can delete own whatsapp connection"
  on public.whatsapp_connections
  for delete
  using (
    exists (
      select 1 from public.businesses
      where businesses.id       = whatsapp_connections.business_id
        and businesses.owner_id = auth.uid()
    )
  );

create index whatsapp_connections_business_id_idx
  on public.whatsapp_connections(business_id);