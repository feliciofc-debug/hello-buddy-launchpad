import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { normalizeGestaoTrocaFotos } from "@/lib/gestao-troca-fotos.ts";
import {
  gestaoOsFotosVisiveis,
  gestaoOsOrdenarFotosDefeitoPrimeiro,
  type GestaoOsFotoRefRow,
} from "../../../../supabase/functions/_shared/gestao-os-fotos.ts";

type Props = {
  userId: string;
  osId: string;
  trocaId: string | null;
  trocaFotosRaw: unknown;
  fotosRef: GestaoOsFotoRefRow[];
  onReload: () => Promise<void>;
  disabled?: boolean;
};

export function GestaoOsFotosPanel({
  userId,
  osId,
  trocaId,
  trocaFotosRaw,
  fotosRef,
  onReload,
  disabled,
}: Props) {
  const trocaFotos = useMemo(() => normalizeGestaoTrocaFotos(trocaFotosRaw), [trocaFotosRaw]);
  const visiveis = useMemo(
    () => gestaoOsOrdenarFotosDefeitoPrimeiro(gestaoOsFotosVisiveis(fotosRef, trocaFotos)),
    [fotosRef, trocaFotos],
  );
  const [urls, setUrls] = useState<Record<string, string>>({});

  const refreshSigned = useCallback(async (paths: string[]) => {
    const next: Record<string, string> = {};
    await Promise.all(
      paths.map(async (path) => {
        const { data, error } = await supabase.storage.from("trocas").createSignedUrl(path, 600);
        if (!error && data?.signedUrl) next[path] = data.signedUrl;
      }),
    );
    setUrls(next);
  }, []);

  useEffect(() => {
    void refreshSigned(visiveis.map((f) => f.storage_path));
  }, [visiveis, refreshSigned]);

  const toggle = async (ref: GestaoOsFotoRefRow) => {
    if (disabled) return;
    const { error } = await supabase.from("gestao_os_foto_ref" as "veiculos_estoque")
      .update({ selecionada: !ref.selecionada } as never)
      .eq("user_id", userId).eq("id", ref.id);
    if (error) return toast.error(error.message);
    await onReload();
  };

  const sincronizar = async () => {
    if (!trocaId) return;
    const { error } = await (supabase as unknown as {
      rpc: (name: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    }).rpc("gestao_os_fotos_sincronizar_troca", { p_os_id: osId });
    if (error) return toast.error(error.message);
    toast.success("Fotos da troca vinculadas à OS.");
    await onReload();
  };

  if (!trocaId) {
    return (
      <p className="text-sm text-muted-foreground">
        OS avulsa — envie fotos nos documentos da vistoria.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Fotos da avaliação (referência, bucket trocas). Defeitos do laudo aparecem primeiro.
        </p>
        <Button size="sm" variant="outline" disabled={disabled} onClick={() => void sincronizar()}>
          Atualizar da troca
        </Button>
      </div>
      {visiveis.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma foto disponível (CRLV oculto).</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {visiveis.map((ref) => {
            const url = urls[ref.storage_path];
            const etiqueta = trocaFotos.find((f) => f.path === ref.storage_path)?.etiqueta ?? "Foto";
            return (
              <button
                key={ref.id}
                type="button"
                disabled={disabled}
                onClick={() => void toggle(ref)}
                className={`overflow-hidden rounded border text-left text-xs ${ref.selecionada ? "ring-2 ring-primary" : ""}`}
              >
                {url ? (
                  <img src={url} alt={etiqueta} className="aspect-video w-full object-cover" />
                ) : (
                  <div className="flex aspect-video items-center justify-center bg-muted">…</div>
                )}
                <div className="p-2">
                  <div className="font-medium">{etiqueta}</div>
                  <div className="text-muted-foreground">
                    {ref.selecionada ? "Incluir no PDF" : "Clique para incluir"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
