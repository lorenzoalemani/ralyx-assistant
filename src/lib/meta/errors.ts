/**
 * Clases de error compartidas para todas las integraciones con Meta (Graph API).
 * Reutilizable por WhatsApp, Instagram, Messenger y cualquier producto futuro de Meta.
 */

export type MetaApiError = {
  message:    string;
  type:       string;
  code:       number;
  fbtrace_id: string;
};

/**
 * Error tipado que incluye el código HTTP y el error estructurado de Meta.
 * Permite al llamador distinguir entre 401, 429, 5xx, etc. sin parsear strings.
 * Nunca incluye tokens ni datos sensibles en el mensaje.
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