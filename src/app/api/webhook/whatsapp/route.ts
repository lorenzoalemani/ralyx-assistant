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
  const rawBody = await request.text();

  // 1. LOG ULTRA DETALLADO: Ver exactamente qué nos está mandando Meta
  console.log("=== [WEBHOOK ATENCIÓN] ¡LLEGÓ UN EVENTO DE META! ===");
  console.log("Cuerpo crudo recibido:");
  console.log(rawBody);
  console.log("====================================================");

  // 2. Parsear el payload
  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.error("[Webhook ERROR] No se pudo parsear el JSON.");
    return new Response("Bad Request", { status: 400 });
  }

  // Meta puede enviar notificaciones que no son de WhatsApp Business
  if (payload.object !== "whatsapp_business_account") {
    console.log(`[Webhook info] Objeto ignorado: ${payload.object}`);
    return new Response("OK", { status: 200 });
  }

  // 3. Extraer phone_number_id para ver si coincide
  const phoneNumberId =
    payload.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

  console.log(`[Webhook info] Phone Number ID detectado en payload: ${phoneNumberId}`);

  if (!phoneNumberId) {
    console.log("[Webhook Alerta] No vino phone_number_id en el payload, deteniendo procesamiento prematuro.");
    return new Response("OK", { status: 200 });
  }

  // 4. Buscar la conexión activa en Supabase
  const supabase = createServiceClient();

  const { data: connection } = await supabase
    .from("whatsapp_connections")
    .select("webhook_secret")
    .eq("phone_number_id", phoneNumberId)
    .eq("active", true)
    .maybeSingle();

  if (!connection) {
    console.warn(`[Webhook Alerta] El phone_number_id ${phoneNumberId} no está registrado o activo en Supabase.`);
    return new Response("OK", { status: 200 });
  }

  // 5. [Bypass Temporal] Omitimos la verificación HMAC-SHA256 para depurar
  /*
  const signature = request.headers.get("x-hub-signature-256") ?? "";
  const isValid = await verifyWebhookSignature(
    rawBody,
    signature,
    connection.webhook_secret
  );

  if (!isValid) {
    return new Response("Forbidden", { status: 403 });
  }
  */

  // 6. Ejecución del backend en segundo plano con after()
  after(async () => {
    try {
      console.log("=== [BACKGROUND START] ENTRANDO A PROCESS INCOMING WEBHOOK ===");
      await processIncomingWebhook(payload);
      console.log("=== [BACKGROUND SUCCESS] PROCESADO CON ÉXITO ===");
    } catch (error) {
      console.error("=== [BACKGROUND ERROR] Error no controlado en processIncomingWebhook ===");
      console.error(error);
    }
  });

  return new Response("OK", { status: 200 });
}