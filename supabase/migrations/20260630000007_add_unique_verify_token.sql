-- =============================================================
-- Migración: add_unique_verify_token
-- Descripción: Garantiza que cada verify_token sea único entre
--              todos los negocios. Meta usa este token para
--              identificar a qué conexión pertenece el challenge
--              del GET de verificación del webhook.
-- =============================================================

alter table public.whatsapp_connections
  add constraint whatsapp_connections_verify_token_unique unique (verify_token);