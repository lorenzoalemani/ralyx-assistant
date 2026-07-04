-- =============================================================
-- Migración: create_embeddings
-- Descripción: Tabla de embeddings para búsqueda semántica (RAG).
--
-- IMPORTANTE: requiere la extensión pgvector.
-- Habilitarla en Supabase Dashboard → Database → Extensions → vector
-- antes de ejecutar esta migración.
--
-- Dimensión del vector: 1536 (OpenAI text-embedding-3-small)
-- Si se cambia el proveedor o modelo, ejecutar:
--   ALTER TABLE public.embeddings ALTER COLUMN embedding TYPE vector(N);
--   DELETE FROM public.embeddings;
--   (luego reindexar con reindexBusiness())
-- =============================================================

-- 1. Tabla de embeddings
--    No almacena el texto embebido (sin duplicación).
--    Los registros originales se consultan por entity_id cuando se necesitan.
create table public.embeddings (
  id          uuid         primary key default gen_random_uuid(),
  business_id uuid         not null references public.businesses(id) on delete cascade,
  entity_type text         not null,
  entity_id   uuid         not null,
  embedding   vector(1536) not null,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now(),

  constraint embeddings_entity_type_valid
    check (entity_type in ('knowledge', 'product')),

  constraint embeddings_entity_unique
    unique (entity_type, entity_id)
);

-- 2. Trigger updated_at
create trigger set_embeddings_updated_at
  before update on public.embeddings
  for each row
  execute function public.set_updated_at();

-- 3. Limpieza automática de embeddings huérfanos
--    Cuando se elimina una knowledge_entry o product, su embedding
--    se elimina automáticamente sin necesidad de lógica en la app.
create or replace function public.delete_entity_embedding()
returns trigger
language plpgsql
as $$
begin
  delete from public.embeddings
  where entity_id = old.id;
  return old;
end;
$$;

create trigger cleanup_knowledge_entry_embedding
  after delete on public.knowledge_entries
  for each row
  execute function public.delete_entity_embedding();

create trigger cleanup_product_embedding
  after delete on public.products
  for each row
  execute function public.delete_entity_embedding();

-- 4. RLS
alter table public.embeddings enable row level security;

create policy "owner can select own embeddings"
  on public.embeddings for select
  using (
    exists (
      select 1 from public.businesses
      where businesses.id       = embeddings.business_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "owner can insert own embeddings"
  on public.embeddings for insert
  with check (
    exists (
      select 1 from public.businesses
      where businesses.id       = embeddings.business_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "owner can update own embeddings"
  on public.embeddings for update
  using (
    exists (
      select 1 from public.businesses
      where businesses.id       = embeddings.business_id
        and businesses.owner_id = auth.uid()
    )
  );

create policy "owner can delete own embeddings"
  on public.embeddings for delete
  using (
    exists (
      select 1 from public.businesses
      where businesses.id       = embeddings.business_id
        and businesses.owner_id = auth.uid()
    )
  );

-- 5. Índices
--    HNSW para búsqueda aproximada eficiente a escala.
--    m=16 y ef_construction=64 son los valores recomendados para uso general.
create index embeddings_hnsw_idx
  on public.embeddings
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

create index embeddings_business_id_idx
  on public.embeddings(business_id);

-- 6. Función de búsqueda semántica
--    Llamada vía supabase.rpc('search_embeddings', {...})
--    security invoker: respeta el RLS del usuario que llama.
--    Si el modelo/proveedor cambia, recrear esta función con la nueva dimensión.
create or replace function public.search_embeddings(
  p_business_id     uuid,
  p_query_embedding vector(1536),
  p_limit           integer default 10
)
returns table (
  entity_type text,
  entity_id   uuid,
  similarity  float8
)
security invoker
language sql
as $$
  select
    entity_type,
    entity_id,
    1 - (embedding <=> p_query_embedding) as similarity
  from public.embeddings
  where business_id = p_business_id
  order by embedding <=> p_query_embedding
  limit p_limit;
$$;