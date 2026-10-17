import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type GestaoZapsignStatus = {
  connected: boolean;
  ambiente: "sandbox" | "producao" | null;
  usar_conta_amz: boolean;
};

export function useGestaoZapsignConnection() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<GestaoZapsignStatus | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("gestao-zapsign-status");
    if (error) {
      toast.error("Não foi possível carregar status da ZapSign.");
      setLoading(false);
      return;
    }
    if (data?.success) {
      setStatus({
        connected: !!data.connected,
        ambiente: data.ambiente ?? null,
        usar_conta_amz: !!data.usar_conta_amz,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = async (api_token: string, ambiente: "sandbox" | "producao") => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("gestao-zapsign-save", {
      body: { api_token, ambiente },
    });
    setBusy(false);
    if (error || !data?.success) {
      toast.error(data?.error ?? "Falha ao salvar token.");
      return false;
    }
    toast.success(data.message ?? "Conectado.");
    void refresh();
    return true;
  };

  const testConnection = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("gestao-zapsign-test");
    setBusy(false);
    if (error || !data?.success) {
      toast.error(data?.message ?? data?.error ?? "Teste falhou.");
      return;
    }
    toast.success(data.message ?? "Conexão OK.");
  };

  const disconnect = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("gestao-zapsign-disconnect");
    setBusy(false);
    if (error || !data?.success) {
      toast.error("Falha ao desconectar.");
      return;
    }
    toast.success("Desconectado.");
    void refresh();
  };

  return { loading, busy, status, refresh, save, testConnection, disconnect };
}
