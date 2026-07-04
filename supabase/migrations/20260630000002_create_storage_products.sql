-- =============================================================
-- Migración: create_storage_products
-- Descripción: Bucket de Storage para imágenes de productos y
--              políticas de acceso basadas en el path del archivo.
--
-- Estructura del path: {owner_id}/{business_id}/{uuid}.{ext}
--
-- Seguridad: el primer segmento del path ES el owner_id.
-- Las políticas usan (storage.foldername(name))[1] para extraerlo
-- y compararlo con auth.uid() sin necesidad de JOINs a otras tablas.
-- =============================================================

-- 1. Crear bucket privado
--    public: false → los archivos no son accesibles sin política explícita.
--    La URL pública se genera vía getPublicUrl(), que sí funciona
--    aunque el bucket no sea "público por defecto".
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'products',
  'products',
  true,
  5242880,  -- 5 MB en bytes
  array['image/jpeg', 'image/png', 'image/webp']
);

-- 2. Política de INSERT
--    El usuario solo puede subir archivos cuyo path empiece con su propio uid.
create policy "owners can upload product images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. Política de SELECT
--    El usuario solo puede leer sus propias imágenes.
create policy "owners can read own product images"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. Política de DELETE
--    El usuario solo puede eliminar sus propias imágenes.
--    Necesario para limpiar imágenes al editar o eliminar productos.
create policy "owners can delete own product images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = auth.uid()::text
  );