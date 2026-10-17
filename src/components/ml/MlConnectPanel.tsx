import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

type MlStatus = {
  connected: boolean;
  nickname: string | null;
  status: string;
  has_location: boolean;
};

export function MlConnectPanel() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<MlStatus | null>(null);

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

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Mercado Livre…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="font-medium">Mercado Livre</p>
          {status?.connected ? (
            <p className="text-sm text-muted-foreground">
              Conectado como <strong>{status.nickname ?? "conta ML"}</strong>
              {!status.has_location && " · localização pendente (reconecte ou configure)"}
              {status.status === "needs_reauth" && " · reconecte a conta"}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Publique veículos do estoque no Mercado Livre com um clique.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {status?.connected ? (
            <Button variant="outline" disabled={busy} onClick={() => void disconnect()}>
              Desconectar
            </Button>
          ) : (
            <Button disabled={busy} onClick={() => void connect()}>
              Conectar Mercado Livre
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
