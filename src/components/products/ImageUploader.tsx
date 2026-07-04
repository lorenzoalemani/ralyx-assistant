"use client";

import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from "react";
import { validateImageFile, fileValidationMessage } from "@/lib/storage/utils";

interface ImageUploaderProps {
  onFileSelect: (file: File | null) => void;
  error?: string | null;
}

/**
 * Componente de UI puro.
 * No sabe nada de Supabase ni de productos.
 * Solo gestiona la selección/drop de un archivo y llama a onFileSelect.
 */
export function ImageUploader({ onFileSelect, error }: ImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const combinedError = error || localError;

  function handleFile(file: File | null) {
    setLocalError(null);

    if (!file) {
      setPreview(null);
      onFileSelect(null);
      return;
    }

    const validationError = validateImageFile(file);
    if (validationError) {
      setLocalError(fileValidationMessage(validationError));
      setPreview(null);
      onFileSelect(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    onFileSelect(file);
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    handleFile(e.target.files?.[0] ?? null);
  }

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      handleFile(e.dataTransfer.files?.[0] ?? null);
    },
    []
  );

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave() {
    setDragging(false);
  }

  function handleRemove() {
    setPreview(null);
    setLocalError(null);
    onFileSelect(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-muted">
        Imagen{" "}
        <span className="text-muted/60">(opcional)</span>
      </span>

      {preview ? (
        /* Vista previa */
        <div className="relative overflow-hidden rounded-xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Vista previa"
            className="h-44 w-full object-cover"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
            aria-label="Eliminar imagen"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M1 1l10 10M11 1L1 11"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      ) : (
        /* Zona de drop */
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          className={`flex h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors ${
            dragging
              ? "border-accent bg-accent/10"
              : "border-border bg-surface hover:border-accent/50 hover:bg-surface-hover"
          }`}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
            aria-hidden
            className={dragging ? "text-accent" : "text-muted"}
          >
            <path
              d="M14 5v12M9 9l5-5 5 5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M5 19v2a2 2 0 002 2h14a2 2 0 002-2v-2"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          <div className="text-center">
            <p className="text-sm text-muted">
              <span className="font-medium text-accent">
                Seleccioná un archivo
              </span>{" "}
              o arrastralo acá
            </p>
            <p className="mt-0.5 text-xs text-muted/60">
              JPG, PNG o WEBP · máx. 5 MB
            </p>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleInputChange}
        tabIndex={-1}
      />

      {combinedError && (
        <p className="text-xs text-danger">{combinedError}</p>
      )}
    </div>
  );
}