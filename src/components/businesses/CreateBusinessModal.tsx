"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import { createBusiness } from "@/lib/actions/businesses";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormError } from "@/components/ui/FormError";

interface CreateBusinessModalProps {
  trigger: React.ReactNode;
}

export function CreateBusinessModal({
  trigger,
}: CreateBusinessModalProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setName("");
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    if (open) {
      document.addEventListener("keydown", onKey);
    }

    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    setLoading(true);
    setError(null);

    const result = await createBusiness(name);

    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setOpen(false);
  }

  return (
    <>
      <div onClick={() => setOpen(true)}>
        {trigger}
      </div>

      {open && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === overlayRef.current) {
              setOpen(false);
            }
          }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          <div className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-glow">
            <div className="mb-5">
              <h2 className="font-display text-lg font-semibold text-foreground">
                Crear negocio
              </h2>

              <p className="mt-1 text-sm text-muted">
                Podés cambiar el nombre más adelante.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {error && <FormError message={error} />}

              <Input
                ref={inputRef}
                id="business-name"
                label="Nombre del negocio"
                type="text"
                placeholder="Ej: Cafetería El Barrio"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={80}
              />

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl border border-border py-2.5 text-sm text-muted transition-colors hover:border-accent/40 hover:text-foreground"
                >
                  Cancelar
                </button>

                <Button
                  type="submit"
                  loading={loading}
                  className="flex-1"
                >
                  Crear negocio
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}