import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { type WhatsAppConnectionStatus } from "@/types/whatsapp";
import { ConnectionStatus } from "@/components/whatsapp/ConnectionStatus";
import { WhatsAppConnectionForm } from "@/components/whatsapp/WhatsAppConnectionForm";

export default async function WhatsAppPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("id", businessId)
    .single();
  if (!business) notFound();

  const { data: connection } = await supabase
    .from("whatsapp_connections")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  // El access token viene del entorno, no de la DB.
  // Si no está configurado, la conexión no puede funcionar aunque haya datos en DB.
  const hasEnvToken = !!process.env.WHATSAPP_ACCESS_TOKEN;

  const status: WhatsAppConnectionStatus = !connection
    ? "disconnected"
    : !hasEnvToken
    ? "error"
    : connection.active
    ? "connected"
    : "disconnected";

  return (
    <div className="max-w-2xl">
      {/* Encabezado */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">
            WhatsApp
          </h1>
          <p className="mt-1 text-sm text-muted">
            Conectá tu número de WhatsApp Business para recibir y responder
            mensajes.
          </p>
        </div>
        <ConnectionStatus status={status} />
      </div>

      {/* Alerta si falta el token de entorno */}
      {connection && !hasEnvToken && (
        <div className="mb-6 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <p className="font-medium">Falta configurar el access token</p>
          <p className="mt-1 text-danger/80">
            La configuración del negocio está guardada, pero{" "}
            <code className="rounded bg-danger/20 px-1">WHATSAPP_ACCESS_TOKEN</code>{" "}
            no está definida en las variables de entorno del servidor.
          </p>
        </div>
      )}

      {/* Formulario */}
      <div className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="mb-5 font-display text-base font-semibold text-foreground">
          Credenciales de la API
        </h2>
        <WhatsAppConnectionForm
          businessId={businessId}
          existing={connection ?? null}
        />
      </div>
    </div>
  );
}