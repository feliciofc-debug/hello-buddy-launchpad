import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { WebmotorsDeparaDialog } from "@/components/webmotors/WebmotorsDeparaDialog";

export type VeiculoPortalWebmotors = {
  status: string;
  permalink: string | null;
  last_error: string | null;
};

function handleBlocking(data: { blocking?: Array<{ message: string }> }, onDepara: () => void) {
  if (Array.isArray(data?.blocking) && data.blocking.length) {
    toast.error(data.blocking.map((b) => b.message).join(" · "));
    onDepara();
    return true;
  }
  return false;
}

export function WebmotorsVehicleActions(props: {
  veiculoId: string;
  portal: VeiculoPortalWebmotors | null;
  wmConnected: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [deparaOpen, setDeparaOpen] = useState(false);

  if (!props.wmConnected) return null;

  const published = props.portal?.status === "published" || props.portal?.status === "paused";

  const publish = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("webmotors-vehicle-publish", {
      body: { veiculo_id: props.veiculoId },
    });
    setBusy(false);
    if (error) {
      toast.error("Erro ao publicar na Webmotors.");
      return;
    }
    if (!data?.success) {
      if (!handleBlocking(data, () => setDeparaOpen(true))) {
        toast.error(data?.error ?? "Publicação rejeitada.");
      }
      props.onChanged();
      return;
    }
    toast.success("Publicado na Webmotors.");
    props.onChanged();
  };

  const sync = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("webmotors-vehicle-sync", {
      body: { veiculo_id: props.veiculoId },
    });
    setBusy(false);
    if (error || !data?.success) {
      if (data && handleBlocking(data, () => setDeparaOpen(true))) {
        props.onChanged();
        return;
      }
      toast.error(data?.error ?? "Falha ao sincronizar.");
      props.onChanged();
      return;
    }
    toast.success("Sincronizado com Webmotors.");
    props.onChanged();
  };

  const unpublish = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("webmotors-vehicle-unpublish", {
      body: { veiculo_id: props.veiculoId },
    });
    setBusy(false);
    if (error || !data?.success) {
      toast.error(data?.error ?? "Falha ao remover da Webmotors.");
      props.onChanged();
      return;
    }
    toast.success("Removido da Webmotors.");
    props.onChanged();
  };

  return (
    <>
      <div className="space-y-2 border-t pt-3">
        <p className="text-xs font-medium text-muted-foreground">Webmotors</p>
        {props.portal?.last_error && (
          <p className="text-xs text-destructive">{props.portal.last_error}</p>
        )}
        {!published ? (
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => void publish()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publicar na Webmotors"}
          </Button>
        ) : (
          <>
            <Button size="sm" variant="ghost" className="w-full" disabled={busy} onClick={() => void sync()}>
              Sincronizar preço/fotos
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full text-destructive"
              disabled={busy}
              onClick={() => void unpublish()}
            >
              Remover da Webmotors
            </Button>
          </>
        )}
        <Button size="sm" variant="link" className="h-auto p-0 text-xs" onClick={() => setDeparaOpen(true)}>
          Ajustar de/para
        </Button>
      </div>
      <WebmotorsDeparaDialog
        open={deparaOpen}
        veiculoId={props.veiculoId}
        onClose={() => setDeparaOpen(false)}
        onSaved={() => props.onChanged()}
      />
    </>
  );
}
