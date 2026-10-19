import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import {
  PortalPublishChecklist,
  type PortalPublishReadiness,
} from "@/components/portals/PortalPublishChecklist.tsx";
import { formatInvokeErrorToast, invokeFunctionComCorpo } from "@/lib/invoke-function-com-corpo.ts";

export type OlxVehicleListing = {
  status: string;
  olx_url: string | null;
  last_error: string | null;
};

export function OlxVehicleActions(props: {
  veiculoId: string;
  listing: OlxVehicleListing | null;
  olxConnected: boolean;
  readiness: PortalPublishReadiness;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);

  if (!props.olxConnected) return null;

  const published = props.listing?.status === "publicado";
  const pending = props.listing?.status === "pendente";

  const invoke = async (acao: "publicar" | "atualizar" | "remover" | "verificar_status") => {
    setBusy(true);
    const r = await invokeFunctionComCorpo("olx-vehicle-publish", {
      body: { veiculo_id: props.veiculoId, acao },
    });
    setBusy(false);
    if (!r.success) {
      toast.error(formatInvokeErrorToast({
        error: r.error,
        blocking: r.blocking,
        fallback: "Operação rejeitada pela OLX.",
      }));
      props.onChanged();
      return;
    }
    if (acao === "verificar_status") {
      if (r.data?.status === "publicado") toast.success("Anúncio publicado na OLX.");
      else if (r.data?.status === "erro") toast.error(String(r.data?.error ?? r.data?.last_error ?? "OLX recusou o anúncio."));
      else toast.message("Status ainda em processamento na OLX.");
    } else if (acao === "remover") toast.success("Remoção enviada à OLX.");
    else if (acao === "atualizar") toast.success("Atualização enviada à OLX.");
    else toast.success("Publicação enviada à OLX.");
    props.onChanged();
  };

  return (
    <>
      <div className="space-y-2 border-t pt-3">
        <p className="text-xs font-medium text-muted-foreground">OLX</p>
        <PortalPublishChecklist portal="olx" readiness={props.readiness} />
        {props.listing?.last_error && (
          <p className="text-xs text-destructive">{props.listing.last_error}</p>
        )}
        {pending && (
          <p className="text-xs text-muted-foreground">Processando na fila OLX…</p>
        )}
        {pending && (
          <Button
            size="sm"
            variant="secondary"
            className="w-full"
            disabled={busy}
            onClick={() => void invoke("verificar_status")}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verificar status na OLX"}
          </Button>
        )}
        {!published && !pending ? (
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => setConfirmPublish(true)}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publicar na OLX"}
          </Button>
        ) : (
          <>
            {props.listing?.olx_url && (
              <Button size="sm" variant="outline" className="w-full gap-2" asChild>
                <a href={props.listing.olx_url} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Ver anúncio
                </a>
              </Button>
            )}
            {published && (
              <Button
                size="sm"
                variant="ghost"
                className="w-full"
                disabled={busy}
                onClick={() => void invoke("atualizar")}
              >
                Atualizar na OLX
              </Button>
            )}
            {(published || pending) && (
              <Button
                size="sm"
                variant="outline"
                className="w-full text-destructive"
                disabled={busy}
                onClick={() => void invoke("remover")}
              >
                Remover da OLX
              </Button>
            )}
          </>
        )}
      </div>

      <AlertDialog open={confirmPublish} onOpenChange={setConfirmPublish}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publicar na OLX?</AlertDialogTitle>
            <AlertDialogDescription>
              A publicação é manual e usa os dados públicos do veículo (preço, fotos, descrição).
              {props.readiness.phonePreview
                ? ` Telefone no anúncio: ${props.readiness.phonePreview}.`
                : ""}
              {" "}Certifique-se de que sua conta OLX tem plano profissional ativo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmPublish(false);
                void invoke("publicar");
              }}
            >
              Publicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
