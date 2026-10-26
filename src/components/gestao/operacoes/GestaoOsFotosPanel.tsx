import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { normalizeGestaoTrocaFotos } from "@/lib/gestao-troca-fotos.ts";
import {
  GESTAO_OS_DOCUMENTO_MIME_TYPES,
  validarArquivoDocumentoOs,
} from "../../../../supabase/functions/_shared/gestao-os-domain.ts";
import { gestaoOsFotoLegenda } from "../../../../supabase/functions/_shared/gestao-os-foto-origens.ts";
import { resolveGestaoOsFotoSignedUrl } from "@/lib/gestao-os-foto-url.ts";
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
  const syncedOnce = useRef(false);

  const refreshSigned = useCallback(async (refs: GestaoOsFotoRefRow[]) => {
    const next: Record<string, string> = {};
    await Promise.all(
      refs.map(async (ref) => {
        const url = await resolveGestaoOsFotoSignedUrl(ref);
        if (url) next[ref.storage_path] = url;
      }),
    );
    setUrls(next);
  }, []);

  useEffect(() => {
    void refreshSigned(visiveis);
  }, [visiveis, refreshSigned]);

  const sincronizar = useCallback(async () => {
    const { error } = await (supabase as unknown as {
      rpc: (name: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    }).rpc("gestao_os_fotos_sincronizar", { p_os_id: osId });
    if (error) return toast.error(error.message);
    toast.success("Fotos atualizadas (anúncio, troca e OS).");
    await onReload();
  }, [osId, onReload]);

  useEffect(() => {
    if (syncedOnce.current || disabled) return;
    syncedOnce.current = true;
    void sincronizar();
  }, [disabled, sincronizar]);

  const toggle = async (ref: GestaoOsFotoRefRow) => {
    if (disabled) return;
    const { error } = await supabase.from("gestao_os_foto_ref" as "veiculos_estoque")
      .update({ selecionada: !ref.selecionada } as never)
      .eq("user_id", userId).eq("id", ref.id);
    if (error) return toast.error(error.message);
    await onReload();
  };

  const adicionarFoto = async (file: File | null) => {
    if (!file || disabled) return;
    const validacao = validarArquivoDocumentoOs(file);
    if (!validacao.ok) return toast.error(validacao.mensagem);
    if (!file.type.startsWith("image/")) {
      return toast.error("Use uma imagem (JPEG, PNG ou WebP).");
    }
    const path = `${userId}/os/${osId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("gestao-os-documentos").upload(path, file);
    if (upErr) return toast.error(upErr.message);
    const { error: docErr } = await supabase.from("gestao_os_documento" as "veiculos_estoque").insert({
      user_id: userId,
      os_id: osId,
      tipo: "outro",
      storage_path: path,
      mime_type: file.type,
      tamanho_bytes: file.size,
    } as never);
    if (docErr) return toast.error(docErr.message);
    await sincronizar();
    toast.success("Foto adicionada à galeria da OS.");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Anúncio do veículo, avaliação da troca (se houver) e fotos enviadas na OS.
          Marque as que entram no PDF e no WhatsApp do parceiro.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={disabled} onClick={() => void sincronizar()}>
            Atualizar fotos
          </Button>
          <Label className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-3 py-2 text-sm">
            <ImagePlus className="h-4 w-4" />
            Adicionar foto
            <input
              className="hidden"
              type="file"
              accept={GESTAO_OS_DOCUMENTO_MIME_TYPES.filter((m) => m.startsWith("image/")).join(",")}
              disabled={disabled}
              onChange={(e) => void adicionarFoto(e.target.files?.[0] ?? null)}
            />
          </Label>
        </div>
      </div>
      {!trocaId && (
        <p className="text-xs text-muted-foreground">
          OS sem troca: as fotos do anúncio do estoque aparecem aqui automaticamente.
        </p>
      )}
      {visiveis.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma foto disponível. Cadastre fotos no anúncio do veículo ou use Adicionar foto.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {visiveis.map((ref) => {
            const url = urls[ref.storage_path];
            const etiqueta = gestaoOsFotoLegenda(
              ref,
              trocaFotos.find((f) => f.path === ref.storage_path)?.etiqueta,
            );
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
