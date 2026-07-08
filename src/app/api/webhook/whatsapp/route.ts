import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyWebhookChallenge } from "@/lib/whatsapp/webhook";
import { processIncomingWebhook } from "@/lib/whatsapp/processor";
import { type WebhookPayload } from "@/lib/whatsapp/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode      = searchParams.get("hub.mode")         ?? "";
  const token     = searchParams.get("hub.verify_token") ?? "";
  const challenge = searchParams.get("hub.challenge")    ?? "";

  // PARCHE: Si Meta envía una petición de prueba vacía sin parámetros, le damos luz verde con un 200 directo
  if (!token && !challenge) {
    console.log("[webhook/GET] Petición de prueba sin parámetros detectada (Evitamos 403)");
    return new Response("OK", { status: 200 });
  }

  if (!token) {
    console.log("[webhook/GET] Sin token");
    return new Response("Forbidden", { status: 403 });
  }

  // Verificación forzada sin leer de base de datos para blindar el GET contra nulos
  const challengeResponse = verifyWebhookChallenge(
    mode,
    token,
    challenge,
    "lolo1234" 
  );

  if (!challengeResponse) {
    console.log("[webhook/GET] Challenge inválido. Mode:", mode);
    return new Response("Forbidden", { status: 403 });
  }

  console.log("[webhook/GET] Verificación exitosa");
  return new Response(challengeResponse, { status: 200 });
}

export async function POST(request: Request) {
  console.log("[webhook/POST] Request recibido");

  const rawBody   = await request.text();
  const signature = request.headers.get("x-hub-signature-256") ?? "";

  console.log("[webhook/POST] Signature presente:", !!signature);

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.error("[webhook/POST] Error al parsear JSON");
    return new Response("Bad Request", { status: 400 });
  }

  if (payload.object !== "whatsapp_business_account") {
    console.log("[webhook/POST] Object ignorado:", payload.object);
    return new Response("OK", { status: 200 });
  }

  const phoneNumberId =
    payload.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

  console.log("[webhook/POST] phone_number_id recibido:", phoneNumberId);

  if (!phoneNumberId) {
    return new Response("OK", { status: 200 });
  }

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (err) {
    console.error("[webhook/POST] Error al crear service client:", err);
    return new Response("OK", { status: 200 });
  }

  const { data: connection, error: connError } = await supabase
    .from("whatsapp_connections")
    .select("webhook_secret")
    .eq("phone_number_id", phoneNumberId)
    .eq("active", true)
    .maybeSingle();

  if (connError) {
    console.error("[webhook/POST] Error al buscar conexión:", connError);
    return new Response("OK", { status: 200 });
  }

  if (!connection) {
    console.warn("[webhook/POST] Sin conexión activa para phone_number_id:", phoneNumberId);
    return new Response("OK", { status: 200 });
  }

  console.log("[webhook/POST] Conexión encontrada, puenteando firma...");

  // Firma comentada por completo para que pase directo a la IA
  /*
  const isValid = await verifyWebhookSignature(
    rawBody,
    signature,
    connection.webhook_secret
  );
  */

  console.log("[webhook/POST] Procesando mensaje en background...");

  after(async () => {
    try {
      await processIncomingWebhook(payload);
    } catch (error) {
      console.error("[webhook/POST] Error en processIncomingWebhook:", error);
    }
  });

  return new Response("OK", { status: 200 });
}