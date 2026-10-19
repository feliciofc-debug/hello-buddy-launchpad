import { useCallback, useEffect, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GESTAO_TROCA_FOTO_SUGESTOES } from "@/lib/gestao-troca-checklist.ts";

const MAX_FOTOS = 40;
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = ["image/jpeg", "image/png", "image/webp"];

type Props = {
  userId: string;
  trocaId: string;
  fotos: string[];
  onFotosChange: (paths: string[]) => void;
  disabled?: boolean;
};

export function GestaoTrocaFotoGaleria({
  userId,
  trocaId,
  fotos,
  onFotosChange,
  disabled,
}: Props) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);

  const refreshSigned = useCallback(async (paths: string[]) => {
    const next: Record<string, string> = {};
    await Promise.all(
      paths.map(async (path) => {
        const { data, error } = await supabase.storage.from("trocas").createSignedUrl(path, 3600);
        if (!error && data?.signedUrl) next[path] = data.signedUrl;
      }),
    );
    setUrls(next);
  }, []);

  useEffect(() => {
    void refreshSigned(fotos);
  }, [fotos, refreshSigned]);

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length || disabled) return;
    if (fotos.length >= MAX_FOTOS) {
      toast.error(`Máximo de ${MAX_FOTOS} fotos.`);
      return;
    }
    setUploading(true);
    const added: string[] = [];
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
      added.push(path);
    }
    setUploading(false);
    if (added.length) onFotosChange([...fotos, ...added]);
  };

  const removeFoto = async (path: string) => {
    if (disabled) return;
    await supabase.storage.from("trocas").remove([path]);
    onFotosChange(fotos.filter((p) => p !== path));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Ordem sugerida: {GESTAO_TROCA_FOTO_SUGESTOES.join(" · ")}
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {fotos.map((path, i) => (
          <div key={path} className="relative overflow-hidden rounded border bg-muted/30">
            {urls[path] ? (
              <img src={urls[path]} alt="" className="aspect-[4/3] w-full object-cover" />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center text-xs text-muted-foreground">
                …
              </div>
            )}
            <p className="truncate px-1 text-[10px] text-muted-foreground">
              {GESTAO_TROCA_FOTO_SUGESTOES[i] ?? `#${i + 1}`}
            </p>
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="absolute right-1 top-1 h-7 w-7"
              disabled={disabled}
              onClick={() => void removeFoto(path)}
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
