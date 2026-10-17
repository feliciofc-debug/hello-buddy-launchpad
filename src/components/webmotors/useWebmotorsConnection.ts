import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type WebmotorsConnectionStatus = {
  connected: boolean;
  status: string;
  ambiente: "homolog" | "producao";
  cnpj_masked: string | null;
  integration_email: string | null;
  default_codigo_modalidade: number | null;
};

export function useWebmotorsConnection() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<WebmotorsConnectionStatus | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("webmotors-status");
    if (error) {
      toast.error("Não foi possível carregar status da Webmotors.");
      setLoading(false);
      return;
    }
    if (data?.success) {
      setStatus({
        connected: !!data.connected,
        status: data.status ?? "disconnected",
        ambiente: data.ambiente === "producao" ? "producao" : "homolog",
        cnpj_masked: data.cnpj_masked ?? null,
        integration_email: data.integration_email ?? null,
        default_codigo_modalidade: data.default_codigo_modalidade ?? null,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveCredentials = async (input: {
    cnpj: string;
    integration_email: string;
    password: string;
    ambiente: "homolog" | "producao";
  }) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("webmotors-credentials-save", {
      body: input,
    });
    setBusy(false);
    if (error || !data?.success) {
      toast.error(data?.error ?? "Falha ao salvar credenciais.");
      return false;
    }
    toast.success(data.message ?? "Credenciais salvas.");
    void refresh();
    return true;
  };

  const testConnection = async (password?: string) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("webmotors-test-connection", {
      body: password ? { password } : {},
    });
    setBusy(false);
    if (error || !data?.success) {
      toast.error(data?.error ?? "Falha no teste de conexão.");
      return false;
    }
    toast.success(data.message ?? "Conexão OK.");
    void refresh();
    return true;
  };

  const disconnect = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("webmotors-disconnect");
    setBusy(false);
    if (error || !data?.success) {
      toast.error(data?.error ?? "Falha ao desconectar.");
      return;
    }
    toast.success(data.message ?? "Desconectado.");
    void refresh();
  };

  return { loading, busy, status, refresh, saveCredentials, testConnection, disconnect };
}
