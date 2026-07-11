"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { encryptToken } from "@/lib/crypto/tokens";
import { type InstagramConnection } from "@/types/instagram";
import { testInstagramConnectionAPI } from "@/lib/instagram/messaging";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type SaveConnectionInput = {
  business_id:        string;
  page_id:            string;
  instagram_id:       string;
  verify_token:       string;
  webhook_secret:     string;
  /**
   * Token en claro — se encripta antes de persistir.
   * Puede estar vacío en una actualización si el dueño no quiere cambiarlo.
   */
  page_access_token:  string;
};

type SaveResult =
  | { success: true;  connection: InstagramConnection }
  | { success: false; error: string };

type TestResult =
  | { success: true;  instagramId: string; username: string }
  | { success: false; error: string; hint?: string };

// ─── Validación ───────────────────────────────────────────────────────────────

function validateInput(
  input:    SaveConnectionInput,
  isUpdate: boolean
): string | null {
  if (!input.page_id.trim())        return "El Page ID no puede estar vacío.";
  if (!input.instagram_id.trim())   return "El Instagram ID no puede estar vacío.";
  if (!input.verify_token.trim())   return "El Verify Token no puede estar vacío.";
  if (!input.webhook_secret.trim()) return "El Webhook Secret no puede estar vacío.";
  if (input.verify_token.trim().length  < 8) return "El Verify Token debe tener al menos 8 caracteres.";
  if (input.webhook_secret.trim().length < 8) return "El Webhook Secret debe tener al menos 8 caracteres.";
  // En creación, el token es obligatorio
  if (!isUpdate && !input.page_access_token.trim()) {
    return "El Page Access Token es obligatorio.";
  }
  return null;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Prueba las credenciales contra la API de Meta ANTES de guardar.
 * El token se usa en memoria y no se persiste en esta llamada.
 */
export async function testInstagramConnection(
  pageId:          string,
  accessToken:     string
): Promise<TestResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado." };

  if (!pageId.trim() || !accessToken.trim()) {
    return {
      success: false,
      error:   "Ingresá el Page ID y el Page Access Token antes de probar.",
    };
  }

  return testInstagramConnectionAPI(pageId.trim(), accessToken.trim());
}

/**
 * Guarda o actualiza la conexión de Instagram de un negocio.
 * El page_access_token se encripta con AES-256-GCM antes de persistir.
 * Si se actualiza y el campo del token está vacío, se mantiene el token existente.
 */
export async function saveInstagramConnection(
  input: SaveConnectionInput
): Promise<SaveResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado." };

  // Verificar si es una actualización
  const { data: existing } = await supabase
    .from("instagram_connections")
    .select("id, page_access_token_encrypted")
    .eq("business_id", input.business_id)
    .maybeSingle();

  const isUpdate = !!existing;
  const validationError = validateInput(input, isUpdate);
  if (validationError) return { success: false, error: validationError };

  // Verificar ownership
  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", input.business_id)
    .single();
  if (!business) return { success: false, error: "Negocio no encontrado." };

  // Encriptar token
  // Si es una actualización y el campo está vacío, mantener el token existente
  let encryptedToken: string;
  try {
    if (input.page_access_token.trim()) {
      encryptedToken = encryptToken(input.page_access_token.trim());
    } else if (isUpdate && existing?.page_access_token_encrypted) {
      encryptedToken = existing.page_access_token_encrypted;
    } else {
      return { success: false, error: "El Page Access Token es obligatorio." };
    }
  } catch {
    return {
      success: false,
      error: "Error al procesar el token. Verificá la configuración del servidor (TOKEN_ENCRYPTION_KEY).",
    };
  }

  const { data, error } = await supabase
    .from("instagram_connections")
    .upsert(
      {
        business_id:                 input.business_id,
        page_id:                     input.page_id.trim(),
        instagram_id:                input.instagram_id.trim(),
        verify_token:                input.verify_token.trim(),
        webhook_secret:              input.webhook_secret.trim(),
        page_access_token_encrypted: encryptedToken,
        active:                      true,
      },
      { onConflict: "business_id" }
    )
    .select()
    .single();

  if (error) {
    return { success: false, error: "No se pudo guardar la conexión." };
  }

  revalidatePath(`/dashboard/${input.business_id}/instagram`);
  return { success: true, connection: data as InstagramConnection };
}

export async function getInstagramConnection(
  businessId: string
): Promise<
  | { success: true; connection: InstagramConnection | null }
  | { success: false; error: string }
> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "No autenticado." };
  }

  const { data, error } = await supabase
    .from("instagram_connections")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) {
    return {
      success: false,
      error: "No se pudo obtener la conexión.",
    };
  }

  return {
    success: true,
    connection: data as InstagramConnection | null,
  };
}