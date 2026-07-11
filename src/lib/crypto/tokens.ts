import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * Módulo genérico de encriptación para tokens de acceso de cualquier canal.
 * Reutilizable por Instagram, WhatsApp, Messenger o cualquier integración futura.
 *
 * Algoritmo: AES-256-GCM (encriptación autenticada)
 *   - Detecta manipulación del valor en DB (auth tag)
 *   - Cada encriptación genera un IV aleatorio único
 *   - Dos tokens iguales producen valores distintos en DB
 *
 * Clave: TOKEN_ENCRYPTION_KEY en .env (32 bytes en hex, 64 caracteres)
 * Generar una sola vez: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * IMPORTANTE:
 * - La clave nunca cambia en producción (invalidaría todos los tokens)
 * - Los tokens nunca se loguean ni aparecen en respuestas de error
 * - El token en claro existe solo en memoria durante el request
 */

const ALGORITHM  = "aes-256-gcm";
const IV_LENGTH  = 12;  // 96 bits, recomendado para GCM
const TAG_LENGTH = 16;  // 128 bits, auth tag de GCM

function getEncryptionKey(): Buffer {
  const keyHex = process.env.TOKEN_ENCRYPTION_KEY;

  if (!keyHex) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY no está definida en las variables de entorno. " +
      "Generá una con: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }

  const key = Buffer.from(keyHex, "hex");

  if (key.length !== 32) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY debe ser exactamente 32 bytes (64 caracteres hexadecimales)."
    );
  }

  return key;
}

/**
 * Encripta un token en claro.
 * Formato del resultado: base64(iv[12] + authTag[16] + ciphertext)
 */
export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv  = randomBytes(IV_LENGTH);

  const cipher    = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

/**
 * Desencripta un token previamente encriptado con encryptToken().
 * Lanza una excepción genérica si el valor fue manipulado.
 * Nunca expone el valor descifrado en mensajes de error.
 */
export function decryptToken(encrypted: string): string {
  const key      = getEncryptionKey();
  const combined = Buffer.from(encrypted, "base64");

  const iv         = combined.subarray(0, IV_LENGTH);
  const authTag    = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // No re-lanzar el error original: puede contener fragmentos del token
    throw new Error(
      "No se pudo descifrar el token. El valor puede haber sido manipulado o la clave es incorrecta."
    );
  }
}