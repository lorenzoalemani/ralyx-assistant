import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { type Business } from "@/types/business";
import { BusinessCard } from "@/components/businesses/BusinessCard";
import { CreateBusinessModal } from "@/components/businesses/CreateBusinessModal";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: businesses, error } = await supabase
    .from("businesses")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
        No se pudieron cargar los negocios. Intentá recargar la página.
      </div>
    );
  }

  const list = (businesses ?? []) as Business[];
  const isEmpty = list.length === 0;

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">
            Mis negocios
          </h1>
          {!isEmpty && (
            <p className="mt-1 text-sm text-muted">
              {list.length} {list.length === 1 ? "negocio" : "negocios"}
            </p>
          )}
        </div>

        {!isEmpty && (
          <CreateBusinessModal
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
                Nuevo negocio
              </button>
            }
          />
        )}
      </div>

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
                x="2"
                y="8"
                width="24"
                height="17"
                rx="3"
                stroke="#7C5CFF"
                strokeWidth="1.8"
              />
              <path
                d="M9 8V6a5 5 0 0 1 10 0v2"
                stroke="#7C5CFF"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M14 15v4M12 17h4"
                stroke="#7C5CFF"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <h2 className="font-display text-xl font-semibold text-foreground">
            Todavía no tenés negocios
          </h2>
          <p className="mt-2 max-w-xs text-sm text-muted">
            Creá tu primer negocio para empezar a administrarlo con
            RalyxAssistant.
          </p>

          <div className="mt-8">
            <CreateBusinessModal
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
                  Crear mi primer negocio
                </button>
              }
            />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((business) => (
            <BusinessCard key={business.id} business={business} />
          ))}
        </div>
      )}
    </div>
  );
}