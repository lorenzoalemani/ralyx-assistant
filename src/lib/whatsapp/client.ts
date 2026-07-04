/**
 * Base de comunicación con la WhatsApp Cloud API de Meta.
 *
 * - La versión de la API se lee desde META_API_VERSION (default: v21.0).
 *   Para actualizarla en producción: cambiar la variable de entorno, sin redeploy.
 * - La URL base se lee desde META_API_BASE_URL para permitir apuntar a
 *   un servidor mock durante testing.
 * - El access token se obtiene exclusivamente desde getAccessToken().
 *   Nunca se lee desde la base de datos.
 */

import { getAccessToken } from "./secrets";
import { type MetaApiError, type MetaApiErrorResponse } from "./types";

function getApiVersion(): string {
  return process.env.META_API_VERSION ?? "v21.0";
}

function getApiBaseUrl(): string {
  return process.env.META_API_BASE_URL ?? "https://graph.facebook.com";
}

export function buildApiUrl(path: string): string {
  return `${getApiBaseUrl()}/${getApiVersion()}/${path}`;
}

export function buildHeaders(): HeadersInit {
  return {
    "Authorization": `Bearer ${getAccessToken()}`,
    "Content-Type":  "application/json",
  };
}

/**
 * Error tipado que incluye el código HTTP y el error de Meta
 * para que el llamador pueda distinguir entre 401, 429, 5xx, etc.
 */
export class MetaApiRequestError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly metaError:  MetaApiError | null,
    message: string
  ) {
    super(message);
    this.name = "MetaApiRequestError";
  }
}

/**
 * Wrapper tipado sobre fetch para la Graph API de Meta.
 * Parsea los errores de Meta y los lanza como MetaApiRequestError.
 */
export async function metaFetch<T>(
  path:    string,
  options: RequestInit = {}
): Promise<T> {
  const url     = buildApiUrl(path);
  const headers = buildHeaders();

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    let metaError: MetaApiError | null = null;

    try {
      const body = await response.json() as MetaApiErrorResponse;
      metaError  = body.error ?? null;
    } catch {
      // El body no es JSON válido
    }

    throw new MetaApiRequestError(
      response.status,
      metaError,
      metaError?.message ?? `Meta API error ${response.status} en ${path}`
    );
  }

  return response.json() as Promise<T>;
}