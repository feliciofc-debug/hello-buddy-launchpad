import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type GestaoMolicarStatus = {
  connected: boolean;
  client_id: string | null;
  limite_mensal: number;
  atualizar_preco_dias: number;
  consultas_mes: number;
};

export type GestaoMolicarCredentials = {
  client_id: string;
  client_secret: string;
};

export type GestaoMolicarSettings = GestaoMolicarCredentials & {
  limite_mensal: number;
  atualizar_preco_dias: number;
};

export function useGestaoMolicarConnection() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<GestaoMolicarStatus | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("gestao-molicar-status");
    if (error || !data?.success) {
      toast.error(data?.error ?? "Não foi possível carregar o status da Molicar.");
      setLoading(false);
      return;
    }

    // Deliberately whitelist the public status fields. A secret returned by a
    // misconfigured endpoint is never retained in application state.
    setStatus({
      connected: !!data.connected,
      client_id: typeof data.client_id === "string" ? data.client_id : null,
      limite_mensal: Number(data.limite_mensal ?? 50),
      atualizar_preco_dias: Number(data.atualizar_preco_dias ?? 7),
      consultas_mes: Number(
        data.usado_mes ?? data.consultas_mes ?? data.consumo_mes_atual ??
          data.consumo_mes ?? 0,
      ),
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const testConnection = async (credentials?: GestaoMolicarCredentials) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("gestao-molicar-test", {
      body: credentials,
    });
    setBusy(false);
    if (error || !data?.success) {
      toast.error(data?.message ?? data?.error ?? "Não foi possível validar as credenciais.");
      return false;
    }
    toast.success(data.message ?? "Credenciais Molicar válidas.");
    return true;
  };

  const save = async (settings: GestaoMolicarSettings) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("gestao-molicar-save", {
      body: settings,
    });
    setBusy(false);
    if (error || !data?.success) {
      toast.error(data?.error ?? "Falha ao salvar a integração Molicar.");
      return false;
    }
    toast.success(data.message ?? "Molicar conectada.");
    void refresh();
    return true;
  };

  const disconnect = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("gestao-molicar-disconnect");
    setBusy(false);
    if (error || !data?.success) {
      toast.error(data?.error ?? "Falha ao desconectar a Molicar.");
      return false;
    }
    toast.success(data.message ?? "Molicar desconectada.");
    void refresh();
    return true;
  };

  return { loading, busy, status, refresh, testConnection, save, disconnect };
}
