/**
 * Abstracción para obtener el access token de WhatsApp.
 *
 * NUNCA se lee desde la base de datos.
 * El origen del secreto puede cambiar sin modificar ningún otro archivo:
 *
 *   Hoy       → variable de entorno WHATSAPP_ACCESS_TOKEN
 *   Futuro    → AWS Secrets Manager, GCP Secret Manager, Vault, etc.
 *
 * Para cambiar el origen, solo se modifica esta función.
 */
export function getAccessToken(): string {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!token) {
    throw new Error(
      "WHATSAPP_ACCESS_TOKEN no está definida en las variables de entorno. " +
      "Agregala en .env.local para desarrollo o en las variables de entorno " +
      "de tu plataforma de deployment para producción."
    );
  }

  return token;
}