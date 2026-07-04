import { createClient } from "@/lib/supabase/client";
import { validateImageFile, fileValidationMessage } from "./utils";

const BUCKET = "products";

type UploadResult =
  | { success: true; path: string }
  | { success: false; error: string };

/**
 * Sube una imagen al bucket "products" y devuelve el path relativo.
 * El path se construye como: {owner_id}/{business_id}/{uuid}.{ext}
 *
 * El llamador es responsable de guardar este path en la DB.
 * La URL pública se construye dinámicamente con getPublicUrl().
 *
 * Si la subida falla, devuelve { success: false, error }.
 * Nunca devuelve una URL completa — solo el path relativo.
 */
export async function uploadProductImage(
  file: File,
  businessId: string
): Promise<UploadResult> {
  // Validación antes de tocar la red
  const validationError = validateImageFile(file);
  if (validationError) {
    return { success: false, error: fileValidationMessage(validationError) };
  }

  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "No autenticado." };
  }

  const ext = file.type.split("/")[1]; // jpeg | png | webp
  const filename = `${crypto.randomUUID()}.${ext}`;
  const path = `${user.id}/${businessId}/${filename}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false, // nunca sobreescribe — el UUID garantiza unicidad
  });

  if (error) {
    return { success: false, error: "No se pudo subir la imagen." };
  }

  return { success: true, path };
}

/**
 * Elimina una imagen del bucket dado su path relativo.
 * Se usará al editar o eliminar productos.
 */
export async function deleteProductImage(path: string): Promise<void> {
  const supabase = createClient();
  await supabase.storage.from(BUCKET).remove([path]);
}