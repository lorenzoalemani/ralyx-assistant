"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { type WhatsAppConnection, type WhatsAppConnectionStatus } from "@/types/whatsapp";
import { testWhatsAppConnection } from "@/lib/whatsapp/messaging";
import { type TestConnectionResult } from "@/lib/whatsapp/types";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type SaveConnectionInput = {
  business_id:         string;
  phone_number_id:     string;
  business_account_id: string;
  verify_token:        string;
  webhook_secret:      string;
};

type SaveConnectionResult =
  | { success: true;  connection: WhatsAppConnection }
  | { success: false; error: string };

type GetConnectionResult =
  | { success: true;  connection: WhatsAppConnection | null }
  | { success: false; error: string };

// ─── Validación ───────────────────────────────────────────────────────────────

function validateInput(input: SaveConnectionInput): string | null {
  if (!input.phone_number_id.trim())
    return "El Phone Number ID no puede estar vacío.";
  if (!input.business_account_id.trim())
    return "El Business Account ID no puede estar vacío.";
  if (!input.verify_token.trim())
    return "El Verify Token no puede estar vacío.";
  if (!input.webhook_secret.trim())
    return "El Webhook Secret no puede estar vacío.";
  if (input.verify_token.trim().length < 8)
    return "El Verify Token debe tener al menos 8 caracteres.";
  if (input.webhook_secret.trim().length < 8)
    return "El Webhook Secret debe tener al menos 8 caracteres.";
  return null;
}

// ─── Helper de ownership ─────────────────────────────────────────────────────

async function verifyBusinessOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .single();
  return !!data;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Prueba las credenciales contra la API de Meta ANTES de guardarlas.
 * El access token se lee desde las variables de entorno del servidor.
 * El usuario solo provee el phone_number_id para que podamos verificarlo.
 */
export async function testConnection(
  phoneNumberId: string
): Promise<TestConnectionResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "No autenticado." };
  }

  if (!phoneNumberId.trim()) {
    return {
      success: false,
      error:   "Ingresá el Phone Number ID antes de probar la conexión.",
    };
  }

  if (!process.env.WHATSAPP_ACCESS_TOKEN) {
    return {
      success: false,
      error:   "WHATSAPP_ACCESS_TOKEN no está configurada en el servidor.",
      hint:    "Agregá la variable de entorno en Vercel → Settings → Environment Variables.",
    };
  }

  return testWhatsAppConnection(phoneNumberId.trim());
}

/**
 * Guarda o actualiza la conexión de WhatsApp de un negocio.
 */
export async function saveWhatsAppConnection(
  input: SaveConnectionInput
): Promise<SaveConnectionResult> {
  const validationError = validateInput(input);
  if (validationError) return { success: false, error: validationError };

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado." };

  const isOwner = await verifyBusinessOwnership(supabase, input.business_id);
  if (!isOwner) return { success: false, error: "Negocio no encontrado." };

  const { data, error } = await supabase
    .from("whatsapp_connections")
    .upsert(
      {
        business_id:         input.business_id,
        phone_number_id:     input.phone_number_id.trim(),
        business_account_id: input.business_account_id.trim(),
        verify_token:        input.verify_token.trim(),
        webhook_secret:      input.webhook_secret.trim(),
        active:              true,
      },
      { onConflict: "business_id" }
    )
    .select()
    .single();

  if (error) {
    return { success: false, error: "No se pudo guardar la conexión." };
  }

  revalidatePath(`/dashboard/${input.business_id}/whatsapp`);
  return { success: true, connection: data as WhatsAppConnection };
}

export async function getWhatsAppConnection(
  businessId: string
): Promise<GetConnectionResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado." };

  const { data, error } = await supabase
    .from("whatsapp_connections")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) {
    return { success: false, error: "No se pudo obtener la conexión." };
  }

  return { success: true, connection: data as WhatsAppConnection | null };
}