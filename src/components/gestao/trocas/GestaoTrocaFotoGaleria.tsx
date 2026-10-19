import { useCallback, useEffect, useMemo, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GESTAO_TROCA_FOTO_ETIQUETA_A_CLASSIFICAR,
  GESTAO_TROCA_FOTO_ETIQUETAS,
  gestaoTrocaFotoEntryComEtiquetaUsuario,
  normalizeGestaoTrocaFotos,
  type GestaoTrocaFotoEntry,
} from "@/lib/gestao-troca-fotos.ts";

const MAX_FOTOS = 40;
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = ["image/jpeg", "image/png", "image/webp"];

type Props = {
  userId: string;
  trocaId: string;
  fotosRaw: unknown;
  onFotosChange: (fotos: GestaoTrocaFotoEntry[]) => void;
  disabled?: boolean;
};

export function GestaoTrocaFotoGaleria({
  userId,
  trocaId,
  fotosRaw,
  onFotosChange,
  disabled,
}: Props) {
  const fotos = useMemo(() => normalizeGestaoTrocaFotos(fotosRaw), [fotosRaw]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);

  const refreshSigned = useCallback(async (entries: GestaoTrocaFotoEntry[]) => {
    const next: Record<string, string> = {};
    await Promise.all(
      entries.map(async ({ path }) => {
        const { data, error } = await supabase.storage.from("trocas").createSignedUrl(path, 3600);
        if (!error && data?.signedUrl) next[path] = data.signedUrl;
      }),
    );
    setUrls(next);
  }, []);

  useEffect(() => {
    void refreshSigned(fotos);
  }, [fotos, refreshSigned]);

  const setEtiqueta = (path: string, etiqueta: string) => {
    onFotosChange(
      fotos.map((f) =>
        f.path === path ? gestaoTrocaFotoEntryComEtiquetaUsuario(f, etiqueta) : f
      ),
    );
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length || disabled) return;
    if (fotos.length >= MAX_FOTOS) {
      toast.error(`Máximo de ${MAX_FOTOS} fotos.`);
      return;
    }
    setUploading(true);
    const added: GestaoTrocaFotoEntry[] = [];
    for (const file of Array.from(files)) {
      if (fotos.length + added.length >= MAX_FOTOS) break;
      if (!ACCEPT.includes(file.type)) {
        toast.error(`${file.name}: use JPG, PNG ou WebP.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name}: máximo 10 MB.`);
        continue;
      }
      const path = `${userId}/${trocaId}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
      const { error } = await supabase.storage.from("trocas").upload(path, file);
      if (error) {
        toast.error(`Falha ao enviar ${file.name}.`);
        continue;
      }
      added.push({ path, etiqueta: GESTAO_TROCA_FOTO_ETIQUETA_A_CLASSIFICAR });
    }
    setUploading(false);
    if (added.length) onFotosChange([...fotos, ...added]);
  };

  const removeFoto = async (path: string) => {
    if (disabled) return;
    await supabase.storage.from("trocas").remove([path]);
    onFotosChange(fotos.filter((f) => f.path !== path));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Envie na ordem que quiser — cada foto entra como «A classificar». A IA organiza o roteiro na
        análise. Use o seletor só para CRLV ou se quiser marcar o ângulo manualmente.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={disabled || uploading}
          className="max-w-xs"
          onChange={(e) => {
            void uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <span className="text-xs text-muted-foreground">
          {fotos.length}/{MAX_FOTOS} · até 10 MB cada
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {fotos.map((foto) => (
          <div key={foto.path} className="relative overflow-hidden rounded border bg-muted/30">
            {urls[foto.path] ? (
              <img src={urls[foto.path]} alt="" className="aspect-[4/3] w-full object-cover" />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center text-xs text-muted-foreground">
                …
              </div>
            )}
            <div className="space-y-1 p-2">
              <Select
                value={foto.etiqueta}
                onValueChange={(v) => setEtiqueta(foto.path, v)}
                disabled={disabled}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GESTAO_TROCA_FOTO_ETIQUETAS.map((e) => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="absolute right-1 top-1 h-7 w-7"
              disabled={disabled}
              onClick={() => void removeFoto(foto.path)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
      {!fotos.length && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Upload className="h-3 w-3" /> Nenhuma foto ainda.
        </p>
      )}
    </div>
  );
}
