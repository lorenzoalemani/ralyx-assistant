import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyWebhookSignature, verifyWebhookChallenge } from "@/lib/whatsapp/webhook";
import { processIncomingWebhook } from "@/lib/whatsapp/processor";
import { type WebhookPayload } from "@/lib/whatsapp/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode      = searchParams.get("hub.mode")         ?? "";
  const token     = searchParams.get("hub.verify_token") ?? "";
  const challenge = searchParams.get("hub.challenge")    ?? "";

  if (!token) {
    console.log("[webhook/GET] Sin token");
    return new Response("Forbidden", { status: 403 });
  }

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (err) {
    console.error("[webhook/GET] Error al crear service client:", err);
    return new Response("Internal Server Error", { status: 500 });
  }

  const { data: connection, error: dbError } = await supabase
    .from("whatsapp_connections")
    .select("verify_token")
    .eq("verify_token", token)
    .eq("active", true)
    .maybeSingle();

  if (dbError) {
    console.error("[webhook/GET] Error de DB:", dbError);
    return new Response("Forbidden", { status: 403 });
  }

  if (!connection) {
    console.log("[webhook/GET] Token no encontrado:", token);
    return new Response("Forbidden", { status: 403 });
  }

  const challengeResponse = verifyWebhookChallenge(
    mode,
    token,
    challenge,
    connection.verify_token
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
    // Respondemos 200 para que Meta no reintente, pero logueamos el error
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

  console.log("[webhook/POST] Conexión encontrada, verificando firma...");

  const isValid = await verifyWebhookSignature(
    rawBody,
    signature,
    connection.webhook_secret
  );

  if (!isValid) {
    console.error("[webhook/POST] Firma inválida. ¿El webhook_secret en DB coincide con el de Meta?");
    return new Response("Forbidden", { status: 403 });
  }

  console.log("[webhook/POST] Firma válida, procesando en background...");

  after(async () => {
    try {
      await processIncomingWebhook(payload);
    } catch (error) {
      console.error("[webhook/POST] Error en processIncomingWebhook:", error);
    }
  });

  return new Response("OK", { status: 200 });
}