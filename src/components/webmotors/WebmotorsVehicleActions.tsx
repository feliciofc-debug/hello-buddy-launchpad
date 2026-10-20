import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WebmotorsDeparaDialog } from "@/components/webmotors/WebmotorsDeparaDialog";
import {
  PortalPublishChecklist,
  type PortalPublishReadiness,
} from "@/components/portals/PortalPublishChecklist.tsx";
import { formatInvokeErrorToast, invokeFunctionComCorpo } from "@/lib/invoke-function-com-corpo.ts";
import { PortalVehicleConnectSection } from "@/components/portals/PortalVehicleConnectSection";

export type VeiculoPortalWebmotors = {
  status: string;
  permalink: string | null;
  last_error: string | null;
};

export function WebmotorsVehicleActions(props: {
  veiculoId: string;
  portal: VeiculoPortalWebmotors | null;
  wmConnected: boolean;
  readiness: PortalPublishReadiness;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [deparaOpen, setDeparaOpen] = useState(false);

  if (!props.wmConnected) {
    return (
      <PortalVehicleConnectSection
        portal="webmotors"
        portalLabel="Webmotors"
        connectFoco="webmotors"
        readiness={props.readiness}
      />
    );
  }

  const published = props.portal?.status === "published" || props.portal?.status === "paused";

  const handleFailure = (r: Awaited<ReturnType<typeof invokeFunctionComCorpo>>) => {
    if (r.blocking?.length) {
      toast.error(formatInvokeErrorToast({ error: r.error, blocking: r.blocking }));
      setDeparaOpen(true);
      return true;
    }
    toast.error(formatInvokeErrorToast({
      error: r.error,
      fallback: "Operação rejeitada.",
    }));
    return false;
  };

  const publish = async () => {
    setBusy(true);
    const r = await invokeFunctionComCorpo("webmotors-vehicle-publish", {
      body: { veiculo_id: props.veiculoId },
    });
    setBusy(false);
    if (!r.success) {
      handleFailure(r);
      props.onChanged();
      return;
    }
    toast.success("Publicado na Webmotors.");
    props.onChanged();
  };

  const sync = async () => {
    setBusy(true);
    const r = await invokeFunctionComCorpo("webmotors-vehicle-sync", {
      body: { veiculo_id: props.veiculoId },
    });
    setBusy(false);
    if (!r.success) {
      handleFailure(r);
      props.onChanged();
      return;
    }
    toast.success("Sincronizado com Webmotors.");
    props.onChanged();
  };

  const unpublish = async () => {
    setBusy(true);
    const r = await invokeFunctionComCorpo("webmotors-vehicle-unpublish", {
      body: { veiculo_id: props.veiculoId },
    });
    setBusy(false);
    if (!r.success) {
      toast.error(formatInvokeErrorToast({ error: r.error, fallback: "Falha ao remover da Webmotors." }));
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
        <PortalPublishChecklist portal="webmotors" readiness={props.readiness} />
        {props.portal?.last_error && (
          <p className="text-xs text-destructive">{props.portal.last_error}</p>
        )}
        {!published ? (
          <Button size="sm" variant="outline" className="w-full" disabled={busy} onClick={() => void publish()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publicar na Webmotors"}
          </Button>
        ) : (
          <>
            <Button size="sm" variant="ghost" className="w-full" disabled={busy} onClick={() => void sync()}>
              Sincronizar
            </Button>
            <Button size="sm" variant="outline" className="w-full" disabled={busy} onClick={() => void unpublish()}>
              Remover da Webmotors
            </Button>
          </>
        )}
      </div>
      <WebmotorsDeparaDialog
        open={deparaOpen}
        veiculoId={props.veiculoId}
        onClose={() => setDeparaOpen(false)}
        onSaved={() => {
          setDeparaOpen(false);
          props.onChanged();
        }}
      />
    </>
  );
}
