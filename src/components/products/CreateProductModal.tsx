"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import { createProduct } from "@/lib/actions/products";
import { uploadProductImage, deleteProductImage } from "@/lib/storage/uploadProductImage";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormError } from "@/components/ui/FormError";
import { ImageUploader } from "./ImageUploader";

interface CreateProductModalProps {
  businessId: string;
  trigger: React.ReactNode;
}

export function CreateProductModal({
  businessId,
  trigger,
}: CreateProductModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  function resetForm() {
    setName("");
    setDescription("");
    setPrice("");
    setImageFile(null);
    setError(null);
    setUploadError(null);
  }

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      resetForm();
    }
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setUploadError(null);
    setLoading(true);

    // 1. Subir imagen si existe
    let imagePath: string | null = null;

    if (imageFile) {
      const uploadResult = await uploadProductImage(imageFile, businessId);

      if (!uploadResult.success) {
        setUploadError(uploadResult.error);
        setLoading(false);
        return;
      }

      imagePath = uploadResult.path;
    }

    // 2. Crear el producto con el path relativo (no la URL completa)
    const result = await createProduct({
      business_id: businessId,
      name,
      description,
      price,
      image_path: imagePath,
    });

    if (!result.success) {
      // Si el producto falló pero la imagen ya se subió, la limpiamos
      if (imagePath) {
        await deleteProductImage(imagePath);
      }
      setError(result.error);
      setLoading(false);
      return;
    }

    setLoading(false);
    setOpen(false);
  }

  return (
    <>
      <div onClick={() => setOpen(true)}>{trigger}</div>

      {open && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === overlayRef.current) setOpen(false);
          }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          <div className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-glow max-h-[90vh] overflow-y-auto">
            <div className="mb-5">
              <h2 className="font-display text-lg font-semibold text-foreground">
                Agregar producto
              </h2>
              <p className="mt-1 text-sm text-muted">
                Completá los datos del nuevo producto.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {error && <FormError message={error} />}

              <Input
                ref={inputRef}
                id="product-name"
                label="Nombre"
                type="text"
                placeholder="Ej: Café con leche"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
              />

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="product-description"
                  className="text-sm font-medium text-muted"
                >
                  Descripción{" "}
                  <span className="text-muted/60">(opcional)</span>
                </label>
                <textarea
                  id="product-description"
                  rows={3}
                  placeholder="Describí brevemente el producto..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                  className="w-full resize-none rounded-xl border border-border bg-surface px-4 py-2.5 text-foreground placeholder:text-muted/60 outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent"
                />
              </div>

              <Input
                id="product-price"
                label="Precio"
                type="number"
                placeholder="0.00"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />

              <ImageUploader
                onFileSelect={setImageFile}
                error={uploadError}
              />

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl border border-border py-2.5 text-sm text-muted transition-colors hover:border-accent/40 hover:text-foreground"
                >
                  Cancelar
                </button>
                <Button type="submit" loading={loading} className="flex-1">
                  Agregar producto
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}