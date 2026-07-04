export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Panel de marca — el elemento de firma de Ralyx */}
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-surface p-12 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #7C5CFF33, transparent 45%), radial-gradient(circle at 80% 70%, #7C5CFF1F, transparent 50%)",
          }}
        />
        <div className="relative">
          <span className="font-display text-xl font-semibold tracking-tight">
            Ralyx<span className="text-accent">Assistant</span>
          </span>
        </div>

        <div className="relative max-w-sm">
          {/* Trazo en forma de onda: la "señal" del asistente escuchando */}
          <svg
            width="64"
            height="32"
            viewBox="0 0 64 32"
            fill="none"
            className="mb-6 text-accent"
          >
            <path
              d="M2 16h6l4-12 6 24 6-18 6 12 6-9 6 6 6-3h14"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="font-display text-2xl font-medium leading-snug text-foreground">
            Un asistente que entiende el contexto antes de responder.
          </p>
          <p className="mt-3 text-sm text-muted">
            Centralizá tus conversaciones, tareas y decisiones en un solo
            lugar.
          </p>
        </div>

        <div className="relative text-xs text-muted">
          © {new Date().getFullYear()} RalyxAssistant
        </div>
      </div>

      {/* Formulario */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="font-display text-xl font-semibold tracking-tight">
              Ralyx<span className="text-accent">Assistant</span>
            </span>
          </div>

          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="mt-1.5 text-sm text-muted">{subtitle}</p>

          <div className="mt-8">{children}</div>

          <div className="mt-6 text-sm text-muted">{footer}</div>
        </div>
      </div>
    </div>
  );
}
