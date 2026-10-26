import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const [tirarOpen, setTirarOpen] = useState(false);
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

  const onAir = props.portal?.status === "published";
  const offAir = props.portal?.status === "closed" || !props.portal?.status;

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
    toast.success(
      offAir && props.portal?.status === "closed"
        ? "Anúncio publicado novamente na Webmotors."
        : "Publicado na Webmotors.",
    );
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

  const tirarDoAr = async () => {
    setBusy(true);
    const r = await invokeFunctionComCorpo("webmotors-vehicle-unpublish", {
      body: { veiculo_id: props.veiculoId },
    });
    setBusy(false);
    setTirarOpen(false);
    if (!r.success) {
      toast.error(formatInvokeErrorToast({
        error: r.error,
        fallback: "Falha ao tirar o anúncio do ar.",
      }));
      props.onChanged();
      return;
    }
    toast.success("Anúncio removido da Webmotors.");
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
        {offAir ? (
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
            {props.portal?.status === "closed"
              ? "Voltar a anunciar"
              : "Publicar na Webmotors"}
          </Button>
        ) : onAir ? (
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
            <Button
              size="sm"
              variant="destructive"
              className="w-full"
              disabled={busy}
              onClick={() => setTirarOpen(true)}
            >
              Tirar do ar
            </Button>
          </>
        ) : null}
      </div>
      <AlertDialog open={tirarOpen} onOpenChange={setTirarOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tirar anúncio do ar?</AlertDialogTitle>
            <AlertDialogDescription>
              O anúncio será excluído na Webmotors. Só é possível remover anúncios
              criados por esta plataforma. Para voltar a vender, use &quot;Voltar a
              anunciar&quot; (novo anúncio e perguntas Sim/Não).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void tirarDoAr()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Tirar do ar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
