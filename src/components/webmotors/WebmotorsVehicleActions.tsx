import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WebmotorsDeparaDialog } from "@/components/webmotors/WebmotorsDeparaDialog";
import { WebmotorsPublishDialog } from "@/components/webmotors/WebmotorsPublishDialog";
import {
  webmotorsAnuncioSnFormFromStored,
  type WebmotorsAnuncioSnForm,
} from "@/components/webmotors/webmotorsAnuncioSnFields";
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
  anuncio_sn?: Record<string, string> | null;
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
  const [publishOpen, setPublishOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"publish" | "sync">("publish");
  const savedSnForm = webmotorsAnuncioSnFormFromStored(props.portal?.anuncio_sn);

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

  const publish = async (anuncioSn: WebmotorsAnuncioSnForm) => {
    setBusy(true);
    const r = await invokeFunctionComCorpo("webmotors-vehicle-publish", {
      body: { veiculo_id: props.veiculoId, anuncio_sn: anuncioSn },
    });
    setBusy(false);
    setPublishOpen(false);
    if (!r.success) {
      handleFailure(r);
      props.onChanged();
      return;
    }
    toast.success("Publicado na Webmotors.");
    props.onChanged();
  };

  const sync = async (anuncioSn?: WebmotorsAnuncioSnForm) => {
    setBusy(true);
    const r = await invokeFunctionComCorpo("webmotors-vehicle-sync", {
      body: {
        veiculo_id: props.veiculoId,
        ...(anuncioSn ? { anuncio_sn: anuncioSn } : {}),
      },
    });
    setBusy(false);
    setPublishOpen(false);
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
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => {
              setDialogMode("publish");
              setPublishOpen(true);
            }}
          >
            Publicar na Webmotors
          </Button>
        ) : (
          <>
            <Button size="sm" variant="ghost" className="w-full" disabled={busy} onClick={() => void sync()}>
              Sincronizar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={() => {
                setDialogMode("sync");
                setPublishOpen(true);
              }}
            >
              Informações Sim/Não
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
      <WebmotorsPublishDialog
        open={publishOpen}
        busy={busy}
        mode={dialogMode}
        initialSn={dialogMode === "sync" ? savedSnForm : undefined}
        onClose={() => setPublishOpen(false)}
        onConfirm={(anuncioSn) =>
          void (dialogMode === "publish" ? publish(anuncioSn) : sync(anuncioSn))}
      />
    </>
  );
}
