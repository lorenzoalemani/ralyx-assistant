import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyWebhookSignature, verifyWebhookChallenge } from "@/lib/whatsapp/webhook";
import { processIncomingWebhook } from "@/lib/whatsapp/processor";
import { processInstagramWebhook } from "@/lib/instagram/processor";
import { type WebhookPayload } from "@/lib/whatsapp/types";
import { type InstagramWebhookPayload } from "@/lib/instagram/webhook";

/**
 * Webhook unificado para todos los productos de Meta.
 *
 * GET: verificación del challenge al registrar el webhook.
 *      Busca el verify_token en todas las tablas de conexión.
 *
 * POST: mensajes entrantes.
 *       Bifurca por payload.object:
 *         "whatsapp_business_account" → WhatsApp processor
 *         "instagram"                 → Instagram processor
 *         (futuro) "page"             → Messenger processor
 *
 * URL a configurar en Meta for Developers:
 *   https://tu-app.vercel.app/api/webhook/meta
 */

// ─── GET: verificación del webhook ───────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode      = searchParams.get("hub.mode")         ?? "";
  const token     = searchParams.get("hub.verify_token") ?? "";
  const challenge = searchParams.get("hub.challenge")    ?? "";

  if (!token) return new Response("Forbidden", { status: 403 });

  let supabase;
  try {
    supabase = createServiceClient();
  } catch {
    return new Response("Internal Server Error", { status: 500 });
  }

  // Buscar en todas las tablas de conexión hasta encontrar el token
  const { data: waConn } = await supabase
    .from("whatsapp_connections")
    .select("verify_token")
    .eq("verify_token", token)
    .eq("active", true)
    .maybeSingle();

  const { data: igConn } = !waConn
    ? await supabase
        .from("instagram_connections")
        .select("verify_token")
        .eq("verify_token", token)
        .eq("active", true)
        .maybeSingle()
    : { data: null };

  const connection = waConn ?? igConn;
  if (!connection) return new Response("Forbidden", { status: 403 });

  const challengeResponse = verifyWebhookChallenge(
    mode,
    token,
    challenge,
    connection.verify_token
  );

  if (!challengeResponse) return new Response("Forbidden", { status: 403 });
  return new Response(challengeResponse, { status: 200 });
}

// ─── POST: mensajes entrantes ─────────────────────────────────────────────────

export async function POST(request: Request) {
  const rawBody   = await request.text();
  const signature = request.headers.get("x-hub-signature-256") ?? "";

  let payload: { object: string };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  let supabase;
  try {
    supabase = createServiceClient();
  } catch {
    // Sin service client no podemos procesar nada — respondemos 200
    // para que Meta no reintente indefinidamente
    console.error("[webhook/meta] Error al crear service client");
    return new Response("OK", { status: 200 });
  }

  // ── WhatsApp ──────────────────────────────────────────────────────────────
  if (payload.object === "whatsapp_business_account") {
    const waPayload     = payload as WebhookPayload;
    const phoneNumberId = waPayload.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

    if (!phoneNumberId) return new Response("OK", { status: 200 });

    const { data: conn } = await supabase
      .from("whatsapp_connections")
      .select("webhook_secret")
      .eq("phone_number_id", phoneNumberId)
      .eq("active", true)
      .maybeSingle();

    if (!conn) return new Response("OK", { status: 200 });

    const isValid = await verifyWebhookSignature(rawBody, signature, conn.webhook_secret);
    if (!isValid) return new Response("Forbidden", { status: 403 });

    after(async () => {
      try {
        await processIncomingWebhook(waPayload);
      } catch (err) {
        console.error("[webhook/meta] Error en processIncomingWebhook:", err);
      }
    });

    return new Response("OK", { status: 200 });
  }

  // ── Instagram ─────────────────────────────────────────────────────────────
  if (payload.object === "instagram") {
    const igPayload = payload as InstagramWebhookPayload;
    const pageId    = igPayload.entry?.[0]?.id;

    if (!pageId) return new Response("OK", { status: 200 });

    const { data: conn } = await supabase
      .from("instagram_connections")
      .select("webhook_secret")
      .eq("page_id", pageId)
      .eq("active", true)
      .maybeSingle();

    if (!conn) return new Response("OK", { status: 200 });

    const isValid = await verifyWebhookSignature(rawBody, signature, conn.webhook_secret);
    if (!isValid) return new Response("Forbidden", { status: 403 });

    after(async () => {
      try {
        await processInstagramWebhook(igPayload);
      } catch (err) {
        console.error("[webhook/meta] Error en processInstagramWebhook:", err);
      }
    });

    return new Response("OK", { status: 200 });
  }

  // Object desconocido — responder 200 para que Meta no reintente
  return new Response("OK", { status: 200 });
}