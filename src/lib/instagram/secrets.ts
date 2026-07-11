import { decryptToken } from "@/lib/crypto/tokens";

/**
 * Desencripta y devuelve el Page Access Token de Instagram.
 *
 * El token NUNCA se loguea ni aparece en respuestas de error.
 * Existe en claro únicamente en memoria durante el request.
 *
 * @param encryptedToken  Valor de instagram_connections.page_access_token_encrypted
 */
export function getInstagramAccessToken(encryptedToken: string): string {
  return decryptToken(encryptedToken);
}