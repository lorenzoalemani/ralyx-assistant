import { createClient } from "@/lib/supabase/client";

const BUCKET = "products";

/**
 * Convierte un path relativo almacenado en la DB a una URL pública.
 * Es el único lugar de la app que conoce cómo construir esta URL.
 *
 * @param path  Ej: "owner_id/business_id/uuid.webp"
 * @returns     URL pública de Supabase Storage, o null si el path está vacío.
 */
export function getPublicUrl(path: string | null): string | null {
  if (!path) return null;

  const supabase = createClient();
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Extrae el path relativo a partir de una URL pública completa.
 * Útil para eliminar o reemplazar imágenes en el futuro.
 *
 * Ejemplo de URL:
 * https://xyz.supabase.co/storage/v1/object/public/products/uid/bid/uuid.webp
 * → "uid/bid/uuid.webp"
 */
export function extractStoragePath(publicUrl: string): string | null {
  try {
    const marker = `/object/public/${BUCKET}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    return publicUrl.slice(idx + marker.length);
  } catch {
    return null;
  }
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export type FileValidationError =
  | "invalid_type"
  | "too_large";

/**
 * Valida un archivo antes de subirlo.
 * Devuelve null si es válido, o un código de error si no lo es.
 */
export function validateImageFile(file: File): FileValidationError | null {
  if (!ALLOWED_TYPES.includes(file.type)) return "invalid_type";
  if (file.size > MAX_SIZE_BYTES) return "too_large";
  return null;
}

export function fileValidationMessage(error: FileValidationError): string {
  switch (error) {
    case "invalid_type":
      return "Solo se permiten imágenes JPG, PNG o WEBP.";
    case "too_large":
      return "La imagen no puede superar los 5 MB.";
  }
}