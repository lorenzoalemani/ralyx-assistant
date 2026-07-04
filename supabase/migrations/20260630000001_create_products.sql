-- =============================================================
-- Migración: create_products
-- Descripción: Tabla de productos con RLS basada en la relación
--              businesses → products (sin owner_id directo).
-- =============================================================

-- 1. Tabla
create table public.products (
  id          uuid          primary key default gen_random_uuid(),
  business_id uuid          not null references public.businesses(id) on delete cascade,
  name        text          not null,
  description text,
  price       numeric(10,2) not null check (price >= 0),
  image_url   text,
  active      boolean       not null default true,
  created_at  timestamptz   not null default now(),

  constraint products_name_not_blank check (trim(name) <> '')
);

-- 2. Activar RLS
alter table public.products enable row level security;

-- 3. Políticas por operación
--    products no tiene owner_id, por lo que se traversa la relación
--    products → businesses para verificar que auth.uid() = businesses.owner_id.

create policy "owner can select own products"
  on public.products
  for select
  using (
    exists (
      select 1 from public.businesses
      where businesses.id       = products.business_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "owner can insert own products"
  on public.products
  for insert
  with check (
    exists (
      select 1 from public.businesses
      where businesses.id       = products.business_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "owner can update own products"
  on public.products
  for update
  using (
    exists (
      select 1 from public.businesses
      where businesses.id       = products.business_id
        and businesses.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.businesses
      where businesses.id       = products.business_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "owner can delete own products"
  on public.products
  for delete
  using (
    exists (
      select 1 from public.businesses
      where businesses.id       = products.business_id
        and businesses.owner_id = auth.uid()
    )
  );

-- 4. Índice de performance
--    El listado de productos siempre filtra por business_id.
create index products_business_id_idx on public.products(business_id);