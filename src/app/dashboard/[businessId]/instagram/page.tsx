    import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { type InstagramConnection, type InstagramConnectionStatus } from "@/types/instagram";
import { InstagramConnectionStatus as StatusBadge } from "@/components/instagram/ConnectionStatus";
import { InstagramConnectionForm } from "@/components/instagram/InstagramConnectionForm";

export default async function InstagramPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("id", businessId)
    .single();
  if (!business) notFound();

  const { data: connection } = await supabase
    .from("instagram_connections")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  const hasEncryptionKey = !!process.env.TOKEN_ENCRYPTION_KEY;

  const status: InstagramConnectionStatus = !connection
    ? "disconnected"
    : !hasEncryptionKey
    ? "error"
    : connection.active
    ? "connected"
    : "disconnected";

  return (
    <div className="max-w-2xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">
            Instagram
          </h1>
          <p className="mt-1 text-sm text-muted">
            Conectá tu cuenta de Instagram Business para recibir y responder
            mensajes directos automáticamente.
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Alerta si falta TOKEN_ENCRYPTION_KEY */}
      {!hasEncryptionKey && (
        <div className="mb-6 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <p className="font-medium">Falta configurar la clave de encriptación</p>
          <p className="mt-1 text-danger/80">
            <code className="rounded bg-danger/20 px-1">TOKEN_ENCRYPTION_KEY</code>{" "}
            no está definida en las variables de entorno. Generá una con:
            <br />
            <code className="mt-1 block rounded bg-danger/20 px-2 py-1 text-xs">
              node -e {"\"console.log(require('crypto').randomBytes(32).toString('hex'))\""}
            </code>
          </p>
        </div>
      )}

      {/* Alerta si conexión inactiva por token inválido */}
      {connection && !connection.active && (
        <div className="mb-6 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <p className="font-medium">La conexión fue desactivada automáticamente</p>
          <p className="mt-1 text-danger/80">
            El Page Access Token es inválido o expiró. Ingresá un nuevo token para reactivar la conexión.
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="mb-5 font-display text-base font-semibold text-foreground">
          Credenciales de la API
        </h2>
        <InstagramConnectionForm
          businessId={businessId}
          existing={connection ?? null}
        />
      </div>
    </div>
  );
}