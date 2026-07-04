-- =============================================================
-- Migración: create_businesses
-- Descripción: Tabla de negocios con RLS, políticas por operación
--              e índice de performance.
-- =============================================================

-- 1. Tabla
create table public.businesses (
  id         uuid        primary key default gen_random_uuid(),
  owner_id   uuid        not null references auth.users(id) on delete cascade,
  name       text        not null,
  slug       text        not null,
  created_at timestamptz not null default now(),

  -- Evita que name o slug sean cadenas vacías o de solo espacios
  constraint businesses_name_not_blank check (trim(name) <> ''),
  constraint businesses_slug_not_blank check (trim(slug) <> '')
);

-- 2. Activar RLS
--    Con RLS activo y sin políticas, ningún usuario puede acceder a la tabla.
--    Las políticas de abajo re-abren exactamente lo necesario.
alter table public.businesses enable row level security;

-- 3. Políticas por operación
--    Se usa una política por operación (no "for all") para que cada regla
--    sea explícita, auditable e independiente de futuros cambios.

create policy "owner can select own businesses"
  on public.businesses
  for select
  using (auth.uid() = owner_id);

create policy "owner can insert own businesses"
  on public.businesses
  for insert
  with check (auth.uid() = owner_id);

create policy "owner can update own businesses"
  on public.businesses
  for update
  using     (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "owner can delete own businesses"
  on public.businesses
  for delete
  using (auth.uid() = owner_id);

-- 4. Índice de performance
--    El dashboard siempre filtra por owner_id. Sin índice Postgres
--    haría un seq scan completo de la tabla.
create index businesses_owner_id_idx on public.businesses(owner_id);