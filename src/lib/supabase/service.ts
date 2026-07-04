import { createClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase con service role key.
 * Bypassa RLS completamente — usar SOLO en contextos server-to-server
 * donde no hay sesión de usuario, como el webhook de WhatsApp.
 *
 * NUNCA exponer este cliente al navegador ni a Client Components.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no están definidas."
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession:   false,
    },
  });
}