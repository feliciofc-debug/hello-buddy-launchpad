import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export type VeiculoPortalMl = {
  status: string;
  permalink: string | null;
  last_error: string | null;
};

export function MlVehicleActions(props: {
  veiculoId: string;
  portal: VeiculoPortalMl | null;
  mlConnected: boolean;
  onChanged: () => void;
}) {
  const publish = async () => {
    const { data, error } = await supabase.functions.invoke("ml-vehicle-publish", {
      body: { veiculo_id: props.veiculoId },
    });
    if (error) {
      toast.error("Erro ao publicar no Mercado Livre.");
      return;
    }
    if (!data?.success) {
      if (Array.isArray(data?.blocking) && data.blocking.length) {
        toast.error(data.blocking.map((b: { message: string }) => b.message).join(" · "));
      } else {
        toast.error(data?.error ?? "Publicação rejeitada.");
      }
      props.onChanged();
      return;
    }
    toast.success("Publicado no Mercado Livre.");
    props.onChanged();
  };

  const sync = async () => {
    const { data, error } = await supabase.functions.invoke("ml-vehicle-sync", {
      body: { veiculo_id: props.veiculoId },
    });
    if (error || !data?.success) {
      toast.error(data?.error ?? "Falha ao sincronizar.");
      props.onChanged();
      return;
    }
    toast.success("Sincronizado com Mercado Livre.");
    props.onChanged();
  };

  if (!props.mlConnected) return null;

  const published = props.portal?.status === "published" || props.portal?.status === "paused";

  return (
    <div className="space-y-2 border-t pt-3">
      <p className="text-xs font-medium text-muted-foreground">Mercado Livre</p>
      {props.portal?.last_error && (
        <p className="text-xs text-destructive">{props.portal.last_error}</p>
      )}
      {!published ? (
        <Button size="sm" variant="outline" className="w-full" onClick={() => void publish()}>
          Publicar no Mercado Livre
        </Button>
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
          <Button size="sm" variant="ghost" className="w-full" onClick={() => void sync()}>
            Sincronizar preço/fotos
          </Button>
        </>
      )}
      {props.portal?.status === "paused" && (
        <p className="text-xs text-amber-600">Anúncio pausado no ML</p>
      )}
    </div>
  );
}
