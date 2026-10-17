import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatBrazilCep } from "../../../supabase/functions/_shared/ml-location.ts";

export type MlConnectionStatus = {
  connected: boolean;
  nickname: string | null;
  status: string;
  has_location: boolean;
  store_zip: string | null;
  location_place: string | null;
  location_city_name: string | null;
  location_state_name: string | null;
};

export function useMlConnection() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<MlConnectionStatus | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("ml-status");
    if (error) {
      toast.error("Não foi possível carregar status do Mercado Livre.");
      setLoading(false);
      return;
    }
    if (data?.success) {
      setStatus({
        connected: !!data.connected,
        nickname: data.nickname ?? null,
        status: data.status ?? "revoked",
        has_location: !!data.has_location,
        store_zip: data.store_zip ?? null,
        location_place: data.location_place ?? null,
        location_city_name: data.location_city_name ?? null,
        location_state_name: data.location_state_name ?? null,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("ml-oauth-start");
    setBusy(false);
    if (error || !data?.auth_url) {
      toast.error("Falha ao iniciar conexão com Mercado Livre.");
      return;
    }
    window.location.href = data.auth_url;
  };

  const disconnect = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("ml-oauth-disconnect");
    setBusy(false);
    if (error || !data?.success) {
      toast.error("Falha ao desconectar.");
      return;
    }
    toast.success(data.message ?? "Desconectado.");
    void refresh();
  };

  const saveCep = async (cepRaw: string) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("ml-location-set", {
      body: { cep: cepRaw },
    });
    setBusy(false);
    if (error || !data?.success) {
      toast.error(data?.error ?? "Não foi possível salvar o CEP.");
      return false;
    }
    toast.success(data.message ?? "CEP salvo.");
    void refresh();
    return true;
  };

  const formattedStoreZip = status?.store_zip
    ? formatBrazilCep(status.store_zip)
    : null;

  return {
    loading,
    busy,
    status,
    formattedStoreZip,
    refresh,
    connect,
    disconnect,
    saveCep,
  };
}
