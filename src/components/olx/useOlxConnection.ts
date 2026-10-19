import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type OlxConnectionStatus = {
  connected: boolean;
  nome: string | null;
  email_mascarado: string | null;
};

export function useOlxConnection() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<OlxConnectionStatus | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("olx-status");
    if (error) {
      toast.error("Não foi possível carregar status da OLX.");
      setLoading(false);
      return;
    }
    if (data?.success) {
      setStatus({
        connected: !!data.connected,
        nome: data.nome ?? null,
        email_mascarado: data.email_mascarado ?? null,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("olx-oauth-start");
    setBusy(false);
    if (error || !data?.auth_url) {
      toast.error("Falha ao iniciar conexão com a OLX.");
      return;
    }
    window.location.href = data.auth_url;
  };

  const disconnect = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("olx-oauth-disconnect");
    setBusy(false);
    if (error || !data?.success) {
      toast.error("Falha ao desconectar.");
      return;
    }
    toast.success(data.message ?? "Desconectado.");
    void refresh();
  };

  return { loading, busy, status, refresh, connect, disconnect };
}
