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

export type VeiculoPortalMl = {
  status: string;
  permalink: string | null;
  last_error: string | null;
};

type DuplicateCandidate = {
  item_id: string;
  permalink: string | null;
  title: string;
};

export function MlVehicleActions(props: {
  veiculoId: string;
  portal: VeiculoPortalMl | null;
  mlConnected: boolean;
  readiness: PortalPublishReadiness;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [dupCandidates, setDupCandidates] = useState<DuplicateCandidate[]>([]);

  const publish = async (confirmDuplicate = false) => {
    setBusy(true);
    const r = await invokeFunctionComCorpo("ml-vehicle-publish", {
      body: { veiculo_id: props.veiculoId, confirm_duplicate: confirmDuplicate },
    });
    setBusy(false);
    if (!r.success && r.data?.duplicate_warning && Array.isArray(r.data.duplicate_candidates)) {
      setDupCandidates(r.data.duplicate_candidates as DuplicateCandidate[]);
      setDupOpen(true);
      return;
    }
    if (!r.success) {
      toast.error(formatInvokeErrorToast({
        error: r.error,
        blocking: r.blocking,
        fallback: "Erro ao publicar no Mercado Livre.",
      }));
      props.onChanged();
      return;
    }
    toast.success("Publicado no Mercado Livre.");
    props.onChanged();
  };

  const sync = async () => {
    setBusy(true);
    const r = await invokeFunctionComCorpo("ml-vehicle-sync", {
      body: { veiculo_id: props.veiculoId },
    });
    setBusy(false);
    if (!r.success) {
      toast.error(formatInvokeErrorToast({
        error: r.error,
        blocking: r.blocking,
        fallback: "Falha ao sincronizar.",
      }));
      props.onChanged();
      return;
    }
    toast.success("Sincronizado com Mercado Livre.");
    props.onChanged();
  };

  if (!props.mlConnected) return null;

  const published = props.portal?.status === "published" || props.portal?.status === "paused";
  const dupLink = dupCandidates[0]?.permalink;

  return (
    <>
      <div className="space-y-2 border-t pt-3">
        <p className="text-xs font-medium text-muted-foreground">Mercado Livre</p>
        <PortalPublishChecklist portal="mercadolivre" readiness={props.readiness} />
        {props.portal?.last_error && (
          <p className="text-xs text-destructive">{props.portal.last_error}</p>
        )}
      {!published ? (
        <>
          {props.readiness.mlPackLabel && props.readiness.hasMlPackage && (
            <p className="text-xs text-muted-foreground">
              Será publicado como: <strong>{props.readiness.mlPackLabel}</strong>
            </p>
          )}
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => void publish(false)}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publicar no Mercado Livre"}
          </Button>
        </>
      ) : (
          <>
            {props.portal?.permalink && (
              <Button size="sm" variant="outline" className="w-full gap-2" asChild>
                <a href={props.portal.permalink} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Ver anúncio
                </a>
              </Button>
            )}
            <Button size="sm" variant="ghost" className="w-full" disabled={busy} onClick={() => void sync()}>
              Sincronizar preço/fotos
            </Button>
          </>
        )}
        {props.portal?.status === "paused" && (
          <p className="text-xs text-amber-600">Anúncio pausado no ML</p>
        )}
      </div>

      <AlertDialog open={dupOpen} onOpenChange={setDupOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Carro parecido já anunciado</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Este carro pode já estar anunciado por outro sistema (Auto Certo, etc.).
                  A AMZ não altera anúncios que não publicou.
                </p>
                {dupCandidates.slice(0, 3).map((c) => (
                  <p key={c.item_id}>
                    {c.title}
                    {c.permalink ? (
                      <>
                        {" "}
                        (
                        <a href={c.permalink} target="_blank" rel="noreferrer" className="underline">
                          ver anúncio
                        </a>
                        )
                      </>
                    ) : null}
                  </p>
                ))}
                {dupLink && (
                  <p>
                    Link:{" "}
                    <a href={dupLink} target="_blank" rel="noreferrer" className="underline">
                      {dupLink}
                    </a>
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDupOpen(false);
                void publish(true);
              }}
            >
              Publicar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
