import { type Product } from "@/types/product";
import { getPublicUrl } from "@/lib/storage/utils";

export function ProductCard({ product }: { product: Product }) {
  // La URL se construye dinámicamente a partir del path relativo.
  // Si image_url es null o el producto no tiene imagen, publicUrl será null.
  const publicUrl = getPublicUrl(product.image_url);

  const formattedPrice = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(product.price);

  return (
    <div className="group flex flex-col rounded-xl border border-border bg-surface overflow-hidden transition-colors hover:border-accent/40 hover:bg-surface-hover">
      {/* Imagen */}
      <div className="relative h-44 w-full bg-surface-hover">
        {publicUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={publicUrl}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <svg
              width="36"
              height="36"
              viewBox="0 0 36 36"
              fill="none"
              aria-hidden
            >
              <rect
                x="4"
                y="4"
                width="28"
                height="28"
                rx="4"
                stroke="#262A33"
                strokeWidth="2"
              />
              <circle cx="13" cy="14" r="3" stroke="#262A33" strokeWidth="2" />
              <path
                d="M4 26l7-5 5 4 5-6 11 8"
                stroke="#262A33"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-display font-semibold text-foreground leading-tight line-clamp-2">
            {product.name}
          </p>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
              product.active
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-border text-muted"
            }`}
          >
            {product.active ? "Activo" : "Inactivo"}
          </span>
        </div>

        {product.description && (
          <p className="text-sm text-muted line-clamp-2">
            {product.description}
          </p>
        )}

        <p className="font-display text-base font-semibold text-accent">
          {formattedPrice}
        </p>
      </div>
    </div>
  );
}