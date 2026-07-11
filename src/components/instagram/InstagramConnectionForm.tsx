"use client";

import { useState, type FormEvent } from "react";
import { saveInstagramConnection, testInstagramConnection } from "@/lib/actions/instagram";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormError } from "@/components/ui/FormError";
import { type InstagramConnection } from "@/types/instagram";

interface Props {
  businessId: string;
  existing:   InstagramConnection | null;
}

type TestState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; instagramId: string; username: string }
  | { status: "error";   error: string; hint?: string };

export function InstagramConnectionForm({ businessId, existing }: Props) {
  const [pageId,          setPageId]          = useState(existing?.page_id       ?? "");
  const [instagramId,     setInstagramId]     = useState(existing?.instagram_id  ?? "");
  const [verifyToken,     setVerifyToken]     = useState(existing?.verify_token  ?? "");
  const [webhookSecret,   setWebhookSecret]   = useState(existing?.webhook_secret ?? "");
  const [accessToken,     setAccessToken]     = useState("");

  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [saved,     setSaved]     = useState(false);
  const [testState, setTestState] = useState<TestState>({ status: "idle" });

  async function handleTest() {
    setTestState({ status: "loading" });

    const result = await testInstagramConnection(pageId, accessToken);

    if (result.success) {
      setInstagramId(result.instagramId);
      setTestState({
        status:      "success",
        instagramId: result.instagramId,
        username:    result.username,
      });
    } else {
      setTestState({ status: "error", error: result.error, hint: result.hint });
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);

    const result = await saveInstagramConnection({
      business_id:       businessId,
      page_id:           pageId,
      instagram_id:      instagramId,
      verify_token:      verifyToken,
      webhook_secret:    webhookSecret,
      page_access_token: accessToken,
    });

    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setSaved(true);
    setAccessToken("");  // Limpiar campo de token después de guardar
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
        {/* Page ID + botón de prueba */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="page-id" className="text-sm font-medium text-muted">
            Page ID
          </label>
          <div className="flex gap-2">
            <input
              id="page-id"
              type="text"
              placeholder="123456789012345"
              value={pageId}
              onChange={(e) => {
                setPageId(e.target.value);
                setTestState({ status: "idle" });
              }}
              required
              className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-foreground placeholder:text-muted/60 outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>

        <Input
          id="instagram-id"
          label="Instagram Business ID"
          type="text"
          placeholder="Se completa automáticamente al probar"
          value={instagramId}
          onChange={(e) => setInstagramId(e.target.value)}
          required
        />
      </div>

      {/* Page Access Token + botón de prueba */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="access-token" className="text-sm font-medium text-muted">
          Page Access Token
          {existing && (
            <span className="ml-2 text-muted/60">(dejá vacío para mantener el actual)</span>
          )}
        </label>
        <div className="flex gap-2">
          <input
            id="access-token"
            type="password"
            placeholder={existing ? "••••••••••••" : "Token de acceso de la Página"}
            value={accessToken}
            onChange={(e) => {
              setAccessToken(e.target.value);
              setTestState({ status: "idle" });
            }}
            required={!existing}
            className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-foreground placeholder:text-muted/60 outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent"
          />
          <button
            type="button"
            onClick={handleTest}
            disabled={testState.status === "loading" || !pageId.trim() || !accessToken.trim()}
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

        {testState.status === "success" && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
            <p className="font-medium">✓ Conexión exitosa</p>
            <p className="mt-0.5 text-emerald-400/80">
              @{testState.username} · ID: {testState.instagramId}
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

      <div className="grid gap-5 sm:grid-cols-2">
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
      </div>

      {/* Instrucciones */}
      <div className="rounded-xl border border-border bg-surface-hover px-4 py-4 text-sm text-muted space-y-3">
        <p className="font-medium text-foreground">¿Cómo configurar la integración?</p>
        <ol className="flex flex-col gap-2 text-xs">
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent font-semibold">1</span>
            <span>En <span className="text-foreground">Meta for Developers</span>, creá una app con el producto Instagram. Vinculá tu Página de Facebook a la cuenta de Instagram Professional.</span>
          </li>
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent font-semibold">2</span>
            <span>Obtené el <span className="text-foreground">Page ID</span> desde Configuración de la Página → Información básica, y generá un <span className="text-foreground">Page Access Token</span> en Meta for Developers → Herramientas → Explorador de la API.</span>
          </li>
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent font-semibold">3</span>
            <span>Hacé clic en <span className="text-foreground">"Probar"</span> para verificar las credenciales. El Instagram Business ID se completa automáticamente.</span>
          </li>
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent font-semibold">4</span>
            <span>En Meta → Webhooks, configurá la URL <code className="rounded bg-border px-1 text-foreground">https://tu-dominio.vercel.app/api/webhook/meta</code> y suscribite al campo <code className="rounded bg-border px-1 text-foreground">messages</code>.</span>
          </li>
        </ol>
        <p className="text-xs border-t border-border pt-3">
          El <span className="text-foreground">Page Access Token</span> se encripta antes de guardarse. Nunca se almacena en texto plano.
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