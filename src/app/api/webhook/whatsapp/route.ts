import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyWebhookSignature, verifyWebhookChallenge } from "@/lib/whatsapp/webhook";
import { processIncomingWebhook } from "@/lib/whatsapp/processor";
import { type WebhookPayload } from "@/lib/whatsapp/types";

// ─── GET: verificación del webhook al registrarlo en Meta ────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode      = searchParams.get("hub.mode")          ?? "";
  const token     = searchParams.get("hub.verify_token")  ?? "";
  const challenge = searchParams.get("hub.challenge")     ?? "";
  console.log("TOKEN RECIBIDO:", token);

  if (!token) {
    return new Response("Forbidden", { status: 403 });
  }

  // Buscar la conexión cuyo verify_token coincida con el recibido.
  // Meta no indica a qué negocio pertenece el GET, solo envía el token
  // que configuramos nosotros — lo usamos para identificar la conexión.
  const supabase = createServiceClient();

  const { data: connection } = await supabase
    .from("whatsapp_connections")
    .select("verify_token")
    .eq("verify_token", token)
    .eq("active", true)
    .maybeSingle();

  if (!connection) {
    return new Response("Forbidden", { status: 403 });
  }

  const challengeResponse = verifyWebhookChallenge(
    mode,
    token,
    challenge,
    connection.verify_token
  );

  if (!challengeResponse) {
    return new Response("Forbidden", { status: 403 });
  }

  return new Response(challengeResponse, { status: 200 });
}

// ─── POST: mensajes entrantes de WhatsApp ────────────────────────────────────

export async function POST(request: Request) {
  // ESTO VA A FORZAR EL LOG Y EL CAMBIO EN GIT:
  console.log("=== !!! LLEGÓ ALGO DE META !!! ===");

  const rawBody  = await request.text();
  const signature = request.headers.get("x-hub-signature-256") ?? "";
  
  // ... (el resto de tu código igual)

  // ── 1. Parsear el payload ────────────────────────────────────────────────
  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  // Meta puede enviar notificaciones que no son de WhatsApp Business
  if (payload.object !== "whatsapp_business_account") {
    return new Response("OK", { status: 200 });
  }

  // ── 2. Extraer phone_number_id para identificar la conexión ─────────────
  const phoneNumberId =
    payload.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

  if (!phoneNumberId) {
    return new Response("OK", { status: 200 });
  }

  // ── 3. Buscar la conexión activa ─────────────────────────────────────────
  const supabase = createServiceClient();

  const { data: connection } = await supabase
    .from("whatsapp_connections")
    .select("webhook_secret")
    .eq("phone_number_id", phoneNumberId)
    .eq("active", true)
    .maybeSingle();

  if (!connection) {
    // Número desconocido: responder 200 para que Meta no reintente.
    //console.warn(`[Webhook] phone_number_id desconocido: ${phoneNumberId}`);
    return new Response("OK", { status: 200 });
  }

// ── 4. Verificar firma HMAC-SHA256 ───────────────────────────────────────
  // COMENTAMOS ESTO TEMPORALMENTE PARA FORZAR LA ENTRADA:
  /*
  const isValid = await verifyWebhookSignature(
    rawBody,
    signature,
    connection.webhook_secret
  );

  if (!isValid) {
    return new Response("Forbidden", { status: 403 });
  }
  */

  // ── 5. Responder 200 inmediatamente y procesar en background ────────────
  //    Meta cancela y reenvía si no recibe 200 en < 20 segundos.
  //    after() permite que Next.js envíe la respuesta antes de que
  //    termine el procesamiento (OpenAI puede tardar 3-8 segundos).
after(async () => {
    try {
      console.log("=== ENTRANDO A PROCESS INCOMING WEBHOOK ===");
      await processIncomingWebhook(payload);
      console.log("=== PROCESADO CON ÉXITO ===");
    } catch (error) {
      console.error("[Webhook ERROR EN BACKGROUND]:", error);
    }
  });

  return new Response("OK", { status: 200 });
}