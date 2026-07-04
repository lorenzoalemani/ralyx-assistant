import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { type Product } from "@/types/product";
import { ProductCard } from "@/components/products/ProductCard";
import { CreateProductModal } from "@/components/products/CreateProductModal";

export default async function BusinessProductsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("id", businessId)
    .single();

  if (!business) {
    notFound();
  }

  const { data: products, error } = await supabase
    .from("products")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
        No se pudieron cargar los productos. Intentá recargar la página.
      </div>
    );
  }

  const list = (products ?? []) as Product[];
  const isEmpty = list.length === 0;

  return (
    <div>
      {/* Encabezado */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">
            Productos
          </h1>
          {!isEmpty && (
            <p className="mt-1 text-sm text-muted">
              {list.length} {list.length === 1 ? "producto" : "productos"}
            </p>
          )}
        </div>

        {!isEmpty && (
          <CreateProductModal
            businessId={businessId}
            trigger={
              <button className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-glow transition-colors hover:bg-accent-hover">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M7 1v12M1 7h12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                Nuevo producto
              </button>
            }
          />
        )}
      </div>

      {/* Estado vacío */}
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-24 text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
            <svg
              width="28"
              height="28"
              viewBox="0 0 28 28"
              fill="none"
              aria-hidden
            >
              <rect
                x="3"
                y="3"
                width="9"
                height="9"
                rx="2"
                stroke="#7C5CFF"
                strokeWidth="1.8"
              />
              <rect
                x="16"
                y="3"
                width="9"
                height="9"
                rx="2"
                stroke="#7C5CFF"
                strokeWidth="1.8"
              />
              <rect
                x="3"
                y="16"
                width="9"
                height="9"
                rx="2"
                stroke="#7C5CFF"
                strokeWidth="1.8"
              />
              <path
                d="M20.5 16v9M16 20.5h9"
                stroke="#7C5CFF"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <h2 className="font-display text-xl font-semibold text-foreground">
            Todavía no hay productos
          </h2>
          <p className="mt-2 max-w-xs text-sm text-muted">
            Agregá tu primer producto para empezar a construir tu catálogo.
          </p>

          <div className="mt-8">
            <CreateProductModal
              businessId={businessId}
              trigger={
                <button className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 font-medium text-white shadow-glow transition-colors hover:bg-accent-hover">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M8 1v14M1 8h14"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  Agregar mi primer producto
                </button>
              }
            />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}