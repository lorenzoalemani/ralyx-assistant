/**
 * Logger estructurado para el servidor.
 *
 * Reglas de seguridad:
 * - Nunca loguear access_token, webhook_secret ni verify_token.
 * - Siempre incluir business_id, phone_number_id y wamid cuando estén disponibles.
 * - Incluir fbtrace_id de Meta para facilitar soporte técnico.
 * - El campo "data" se serializa a JSON para que sea parseable por herramientas
 *   de observabilidad (Vercel Log Drains, Datadog, etc.).
 */

type LogLevel = "info" | "warn" | "error";

type LogData = Record<string, unknown>;

const SENSITIVE_KEYS = new Set([
  "access_token",
  "accessToken",
  "webhook_secret",
  "webhookSecret",
  "verify_token",
  "verifyToken",
  "apiKey",
  "api_key",
  "authorization",
  "password",
]);

/**
 * Elimina campos sensibles de un objeto antes de loguearlo.
 * Opera de forma recursiva para objetos anidados.
 */
function sanitize(data: LogData): LogData {
  const result: LogData = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key)) {
      result[key] = "[REDACTED]";
    } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result[key] = sanitize(value as LogData);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function log(level: LogLevel, event: string, data: LogData = {}): void {
  const entry = {
    timestamp:  new Date().toISOString(),
    level:      level.toUpperCase(),
    event,
    ...sanitize(data),
  };

  const line = JSON.stringify(entry);

  switch (level) {
    case "info":
      console.log(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "error":
      console.error(line);
      break;
  }
}

export const logger = {
  info:  (event: string, data?: LogData) => log("info",  event, data),
  warn:  (event: string, data?: LogData) => log("warn",  event, data),
  error: (event: string, data?: LogData) => log("error", event, data),
};