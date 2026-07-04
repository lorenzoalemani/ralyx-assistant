import { type WhatsAppConnectionStatus } from "@/types/whatsapp";

const STATUS_CONFIG: Record<
  WhatsAppConnectionStatus,
  { label: string; dot: string; badge: string }
> = {
  connected: {
    label: "Conectado",
    dot:   "bg-emerald-400",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  disconnected: {
    label: "No conectado",
    dot:   "bg-muted",
    badge: "bg-border text-muted border-border",
  },
  error: {
    label: "Error de configuración",
    dot:   "bg-danger animate-pulse",
    badge: "bg-danger/10 text-danger border-danger/20",
  },
};

export function ConnectionStatus({
  status,
}: {
  status: WhatsAppConnectionStatus;
}) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${config.badge}`}
    >
      <span className={`h-2 w-2 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}