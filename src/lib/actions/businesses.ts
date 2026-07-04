"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { type Business } from "@/types/business";

function generateSlug(name: string): string {
return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

type CreateBusinessResult =
| { success: true; business: Business }
| { success: false; error: string };

export async function createBusiness(
name: string
): Promise<CreateBusinessResult> {
const trimmed = name.trim();

if (!trimmed) {
    return { success: false, error: "El nombre no puede estar vacío." };
}

if (trimmed.length < 2) {
    return {
    success: false,
    error: "El nombre debe tener al menos 2 caracteres.",
    };
}

if (trimmed.length > 80) {
    return {
    success: false,
    error: "El nombre no puede superar los 80 caracteres.",
    };
}

const supabase = await createClient();

const {
    data: { user },
} = await supabase.auth.getUser();

if (!user) {
    return { success: false, error: "No autenticado." };
}

const slug = generateSlug(trimmed) || "negocio";

const { data, error } = await supabase
    .from("businesses")
    .insert({
    name: trimmed,
    slug,
    owner_id: user.id,
    })
    .select()
    .single();

if (error) {
    return { success: false, error: "No se pudo crear el negocio." };
}

revalidatePath("/dashboard");

return { success: true, business: data as Business };
}