"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";
import { type Product } from "@/types/product";
import { indexProduct } from "@/lib/rag/indexing";

type CreateProductInput = {
  business_id: string;
  name:        string;
  description: string;
  price:       string;
  image_path:  string | null;
};

type CreateProductResult =
  | { success: true;  product: Product }
  | { success: false; error: string };

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function createProduct(
  input: CreateProductInput
): Promise<CreateProductResult> {
  const name        = input.name.trim();
  const description = input.description.trim();
  const image_path  = input.image_path?.trim() ?? null;

  if (!name) return { success: false, error: "El nombre no puede estar vacío." };
  if (name.length < 2)   return { success: false, error: "El nombre debe tener al menos 2 caracteres." };
  if (name.length > 120) return { success: false, error: "El nombre no puede superar los 120 caracteres." };

  const priceNumber = parseFloat(input.price);
  if (isNaN(priceNumber) || priceNumber < 0) {
    return { success: false, error: "El precio debe ser un número mayor o igual a 0." };
  }

  if (image_path && !isValidUrl(image_path)) {
    return { success: false, error: "La URL de imagen no es válida." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado." };

  const { data: business, error: bizError } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", input.business_id)
    .single();
  if (bizError || !business) return { success: false, error: "Negocio no encontrado." };

  const { data, error } = await supabase
    .from("products")
    .insert({
      business_id: input.business_id,
      name,
      description: description || null,
      price:       priceNumber,
      image_url:   image_path,
      active:      true,
    })
    .select()
    .single();

  if (error) return { success: false, error: "No se pudo crear el producto." };

  const product = data as Product;

  // Indexación asíncrona: el producto fue creado exitosamente.
  // Si falla el embedding, el producto existe pero no aparecerá en búsqueda
  // semántica hasta que se reindexe.
  after(async () => {
    try {
      const serviceClient = createServiceClient();
      await indexProduct(serviceClient, {
        id:          product.id,
        business_id: product.business_id,
        name:        product.name,
        description: product.description,
      });
    } catch (err) {
      console.error("[products] Error al indexar producto:", err);
    }
  });

  revalidatePath(`/dashboard/${input.business_id}`);
  return { success: true, product };
}