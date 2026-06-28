// Fase 1.2 — Botão de Embedded Signup do WhatsApp Cloud API
// Abre o Facebook Login for Business com config_id, escuta a mensagem
// 'WA_EMBEDDED_SIGNUP' (que traz waba_id + phone_number_id) e chama
// a edge function whatsapp-embedded-signup-callback com o code.

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// APP_ID e config_id são carregados em runtime via edge function pública
// `get-meta-public-config` (fonte única = secrets do projeto).

declare global {
  interface Window {
    FB: any;
    fbAsyncInit: any;
  }
}

interface ConfigRow {
  display_phone: string | null;
  business_name: string | null;
  is_active: boolean | null;
  token_expires_at: string | null;
  alert_status: string | null;
}

export default function ConectarWhatsAppCloud() {
  const [config, setConfig] = useState<ConfigRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [metaCfg, setMetaCfg] = useState<{ app_id: string | null; embedded_config_id: string | null } | null>(null);

  // 1) Carrega config pública do Meta (APP_ID + embedded_config_id) e SDK do Facebook
  useEffect(() => {
    (async () => {
      const { data } = await supabase.functions.invoke("get-meta-public-config", { method: "GET" });
      setMetaCfg(data ?? { app_id: null, embedded_config_id: null });
      if (!data?.app_id || window.FB) return;
      window.fbAsyncInit = function () {
        window.FB.init({
          appId: data.app_id,
          cookie: true,
          xfbml: true,
          version: "v25.0",
        });
      };
      const s = document.createElement("script");
      s.src = "https://connect.facebook.net/en_US/sdk.js";
      s.async = true;
      s.defer = true;
      document.body.appendChild(s);
    })();
  }, []);

  // 2) Lê config atual
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { setLoading(false); return; }
      const { data } = await supabase
        .from("whatsapp_config")
        .select("display_phone, business_name, is_active, token_expires_at, alert_status")
        .eq("user_id", u.user.id)
        .maybeSingle();
      setConfig(data);
      setLoading(false);
    })();
  }, []);

  // 3) Escuta mensagem do Embedded Signup
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type === "WA_EMBEDDED_SIGNUP" && data?.event === "FINISH") {
          // data.data = { waba_id, phone_number_id, business_id, ... }
          (window as any).__waEmbeddedPayload = data.data;
        }
      } catch (_) { /* ignore */ }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const handleConnect = () => {
    if (!window.FB) { toast.error("SDK do Facebook ainda carregando…"); return; }
    if (!metaCfg?.embedded_config_id) {
      toast.error("WHATSAPP_EMBEDDED_CONFIG_ID não configurado nos secrets");
      return;
    }
    setConnecting(true);
    window.FB.login(
      async (response: any) => {
        try {
          const code = response?.authResponse?.code;
          const payload = (window as any).__waEmbeddedPayload;
          if (!code || !payload?.waba_id || !payload?.phone_number_id) {
            toast.error("Conexão cancelada ou incompleta");
            return;
          }
          const { data: { session } } = await supabase.auth.getSession();
          const { data, error } = await supabase.functions.invoke(
            "whatsapp-embedded-signup-callback",
            {
              body: {
                code,
                waba_id: payload.waba_id,
                phone_number_id: payload.phone_number_id,
              },
              headers: { Authorization: `Bearer ${session?.access_token}` },
            },
          );
          if (error || !data?.success) {
            toast.error("Falha ao conectar: " + (data?.error?.message || data?.step || "erro desconhecido"));
            return;
          }
          toast.success(`Conectado: ${data.display_phone || ""}`);
          // recarrega config
          const { data: u } = await supabase.auth.getUser();
          const { data: cfg } = await supabase
            .from("whatsapp_config")
            .select("display_phone, business_name, is_active, token_expires_at, alert_status")
            .eq("user_id", u.user!.id)
            .maybeSingle();
          setConfig(cfg);
        } finally {
          setConnecting(false);
          (window as any).__waEmbeddedPayload = null;
        }
      },
      {
        config_id: metaCfg.embedded_config_id,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
      },
    );
  };

  const handleDisconnect = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("whatsapp_config")
      .update({ is_active: false, alert_status: "none" })
      .eq("user_id", u.user.id);
    setConfig((c) => c ? { ...c, is_active: false } : c);
    toast.success("Desconectado");
  };

  if (loading) return <div className="p-6"><Loader2 className="animate-spin" /></div>;

  const connected = !!config?.is_active;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" /> WhatsApp Cloud API (Oficial)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {connected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="font-medium">{config?.business_name || "Conectado"}</span>
              <Badge variant="outline">{config?.display_phone}</Badge>
            </div>
            {config?.alert_status === "reconnect_soon" && (
              <div className="flex items-center gap-2 text-amber-700 text-sm">
                <AlertCircle className="h-4 w-4" /> Token próximo do vencimento — reconecte para garantir continuidade.
              </div>
            )}
            {config?.alert_status === "refresh_failed" && (
              <div className="flex items-center gap-2 text-red-700 text-sm">
                <AlertCircle className="h-4 w-4" /> Conexão expirada. Reconecte agora.
              </div>
            )}
            <Button variant="outline" onClick={handleDisconnect}>Desconectar</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Conecte seu próprio número WhatsApp Business pela Meta — sem digitar tokens.
            </p>
            <Button onClick={handleConnect} disabled={connecting}>
              {connecting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
              Conectar WhatsApp
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
