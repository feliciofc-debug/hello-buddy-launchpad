import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type GestaoFocusnfeStatus = {
  connected: boolean;
  ambiente: "homolog" | "producao" | null;
};

export function useGestaoFocusnfeConnection() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<GestaoFocusnfeStatus | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("gestao-focusnfe-status");
    if (error) {
      toast.error("Não foi possível carregar status da Focus NFe.");
      setLoading(false);
      return;
    }
    if (data?.success) {
      setStatus({
        connected: !!data.connected,
        ambiente: data.ambiente ?? null,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = async (
    token: string,
    ambiente: "homolog" | "producao",
    confirmProducao = false,
  ) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("gestao-focusnfe-save", {
      body: { token, ambiente, confirm_producao: confirmProducao },
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
    const { data, error } = await supabase.functions.invoke("gestao-focusnfe-test");
    setBusy(false);
    if (error || !data?.success) {
      toast.error(data?.message ?? data?.error ?? "Teste falhou.");
      return;
    }
    toast.success(data.message ?? "Conexão OK.");
  };

  const disconnect = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("gestao-focusnfe-disconnect");
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
