import { type WebhookPayload } from "./types";

/**
 * Verifica la firma HMAC-SHA256 del webhook de Meta.
 *
 * Meta firma el body crudo de cada POST con el webhook_secret usando HMAC-SHA256
 * y lo envía en el header x-hub-signature-256 con el formato "sha256=<hex>".
 *
 * Se usa comparación de tiempo constante para evitar timing attacks:
 * comparar carácter a carácter con XOR acumula diferencias sin cortocircuito.
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  webhookSecret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBytes = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(payload)
    );

    const expectedSignature =
      "sha256=" +
      Array.from(new Uint8Array(signatureBytes))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    if (expectedSignature.length !== signature.length) return false;

    // Comparación de tiempo constante
    let mismatch = 0;
    for (let i = 0; i < expectedSignature.length; i++) {
      mismatch |= expectedSignature.charCodeAt(i) ^ signature.charCodeAt(i);
    }

    return mismatch === 0;
  } catch {
    return false;
  }
}

/**
 * Verifica el challenge de Meta al registrar el webhook (GET request). 
 * Devuelve el challenge si el token es válido, null si no lo es.
 */
export function verifyWebhookChallenge(
  mode: string,
  token: string,
  challenge: string,
  verifyToken: string
): string | null {
  if (mode === "subscribe" && token === verifyToken) {
    return challenge;
  }
  return null;
}