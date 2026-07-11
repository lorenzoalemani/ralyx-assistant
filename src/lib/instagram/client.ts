/**
 * Base de comunicación con la Instagram Messaging API (Graph API de Meta).
 *
 * A diferencia del cliente de WhatsApp, el access token se pasa como
 * parámetro en cada llamada porque es por negocio (se obtiene de DB
 * desencriptado con decryptToken()).
 *
 * Reutiliza META_API_VERSION y META_API_BASE_URL del entorno.
 */

import { MetaApiRequestError, type MetaApiError } from "@/lib/meta/errors";

export { MetaApiRequestError };

function getApiVersion(): string {
  return process.env.META_API_VERSION ?? "v21.0";
}

function getApiBaseUrl(): string {
  return process.env.META_API_BASE_URL ?? "https://graph.facebook.com";
}

export function buildInstagramApiUrl(path: string): string {
  return `${getApiBaseUrl()}/${getApiVersion()}/${path}`;
}

/**
 * Wrapper tipado sobre fetch para la Graph API de Meta.
 * El access token se pasa explícitamente — nunca se lee desde env.
 */
export async function instagramFetch<T>(
  path:        string,
  accessToken: string,
  options:     RequestInit = {}
): Promise<T> {
  const url = buildInstagramApiUrl(path);

  const response = await fetch(url, {
    ...options,
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type":  "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    let metaError: MetaApiError | null = null;
    try {
      const body = await response.json() as { error?: MetaApiError };
      metaError  = body.error ?? null;
    } catch { /* body no es JSON */ }

    throw new MetaApiRequestError(
      response.status,
      metaError,
      metaError?.message ?? `Instagram API error ${response.status} en ${path}`
    );
  }

  return response.json() as Promise<T>;
}