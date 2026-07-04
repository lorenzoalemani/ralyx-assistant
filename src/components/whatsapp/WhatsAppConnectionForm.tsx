"use client";

import { useState, type FormEvent } from "react";
import { saveWhatsAppConnection, testConnection } from "@/lib/actions/whatsapp";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormError } from "@/components/ui/FormError";
import { type WhatsAppConnection } from "@/types/whatsapp";

interface Props {
  businessId: string;
  existing:   WhatsAppConnection | null;
}

type TestState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; phoneNumber: string; verifiedName: string }
  | { status: "error";   error: string; hint?: string };

export function WhatsAppConnectionForm({ businessId, existing }: Props) {
  const [phoneNumberId,     setPhoneNumberId]     = useState(existing?.phone_number_id     ?? "");
  const [businessAccountId, setBusinessAccountId] = useState(existing?.business_account_id ?? "");
  const [verifyToken,       setVerifyToken]       = useState(existing?.verify_token        ?? "");
  const [webhookSecret,     setWebhookSecret]     = useState(existing?.webhook_secret      ?? "");

  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [saved,     setSaved]     = useState(false);
  const [testState, setTestState] = useState<TestState>({ status: "idle" });

  async function handleTest() {
    setTestState({ status: "loading" });
    setError(null);

    const result = await testConnection(phoneNumberId);

    if (result.success) {
      setTestState({
        status:       "success",
        phoneNumber:  result.phoneNumber,
        verifiedName: result.verifiedName,
      });
    } else {
      setTestState({
        status: "error",
        error:  result.error,
        hint:   result.hint,
      });
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);

    const result = await saveWhatsAppConnection({
      business_id:         businessId,
      phone_number_id:     phoneNumberId,
      business_account_id: businessAccountId,
      verify_token:        verifyToken,
      webhook_secret:      webhookSecret,
    });

    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setSaved(true);
    setTestState({ status: "idle" });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && <FormError message={error} />}

      {saved && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-400">
          Configuración guardada correctamente.
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        {/* Phone Number ID + botón de prueba */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="phone-number-id"
            className="text-sm font-medium text-muted"
          >
            Phone Number ID
          </label>
          <div className="flex gap-2">
            <input
              id="phone-number-id"
              type="text"
              placeholder="123456789012345"
              value={phoneNumberId}
              onChange={(e) => {
                setPhoneNumberId(e.target.value);
                setTestState({ status: "idle" });
              }}
              required
              className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-foreground placeholder:text-muted/60 outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent"
            />
            <button
              type="button"
              onClick={handleTest}
              disabled={testState.status === "loading" || !phoneNumberId.trim()}
              className="shrink-0 rounded-xl border border-border px-3 py-2.5 text-sm text-muted transition-colors hover:border-accent/50 hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {testState.status === "loading" ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted/40 border-t-muted" />
                  Probando
                </span>
              ) : (
                "Probar"
              )}
            </button>
          </div>

          {/* Resultado del test */}
          {testState.status === "success" && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
              <p className="font-medium">✓ Conexión exitosa</p>
              <p className="mt-0.5 text-emerald-400/80">
                {testState.verifiedName} · {testState.phoneNumber}
              </p>
            </div>
          )}

          {testState.status === "error" && (
            <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              <p className="font-medium">{testState.error}</p>
              {testState.hint && (
                <p className="mt-0.5 text-danger/80">{testState.hint}</p>
              )}
            </div>
          )}
        </div>

        <Input
          id="business-account-id"
          label="Business Account ID"
          type="text"
          placeholder="123456789012345"
          value={businessAccountId}
          onChange={(e) => setBusinessAccountId(e.target.value)}
          required
        />
      </div>

      <Input
        id="verify-token"
        label="Verify Token"
        type="text"
        placeholder="Token que configuraste en Meta (mín. 8 caracteres)"
        value={verifyToken}
        onChange={(e) => setVerifyToken(e.target.value)}
        required
      />

      <Input
        id="webhook-secret"
        label="Webhook Secret"
        type="password"
        placeholder="Secreto para verificar la firma del webhook"
        value={webhookSecret}
        onChange={(e) => setWebhookSecret(e.target.value)}
        required
      />

      {/* Instrucciones contextuales */}
      <div className="rounded-xl border border-border bg-surface-hover px-4 py-4 text-sm text-muted space-y-3">
        <p className="font-medium text-foreground">¿Cómo configurar la integración?</p>

        <ol className="flex flex-col gap-2 text-xs list-none">
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent font-semibold">1</span>
            <span>En <span className="text-foreground">Meta for Developers</span> → Tu App → WhatsApp → API Setup, copiá el <span className="text-foreground">Phone Number ID</span> y el <span className="text-foreground">Business Account ID</span>.</span>
          </li>
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent font-semibold">2</span>
            <span>Hacé clic en <span className="text-foreground">"Probar"</span> para verificar que el Phone Number ID es correcto antes de guardar.</span>
          </li>
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent font-semibold">3</span>
            <span>En <span className="text-foreground">Meta → Webhook</span>, configurá la URL y el Verify Token. El Webhook Secret lo genera Meta automáticamente.</span>
          </li>
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent font-semibold">4</span>
            <span>La URL del webhook para producción es: <code className="rounded bg-border px-1 text-foreground">https://tu-dominio.vercel.app/api/webhook/whatsapp</code></span>
          </li>
        </ol>

        <p className="text-xs border-t border-border pt-3">
          El <span className="text-foreground">access token</span> se configura en{" "}
          <span className="text-foreground">Vercel → Settings → Environment Variables</span>{" "}
          como <code className="rounded bg-border px-1">WHATSAPP_ACCESS_TOKEN</code>.
          Nunca se guarda en la base de datos.
        </p>
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={loading} className="px-8">
          {existing ? "Guardar cambios" : "Guardar configuración"}
        </Button>
      </div>
    </form>
  );
}