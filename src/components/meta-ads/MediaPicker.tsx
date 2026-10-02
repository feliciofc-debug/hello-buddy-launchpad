import { useEffect, useState } from "react";
import { Image as ImageIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type MediaRow = Database["public"]["Tables"]["midias_whatsapp"]["Row"];

export type MetaAdsMedia = Pick<
  MediaRow,
  | "id"
  | "midia_url"
  | "thumbnail_url"
  | "arquivo_nome"
  | "legenda_gerada"
  | "contexto_original"
  | "tipo"
  | "created_at"
>;

type MediaPickerProps = {
  selectedId: string;
  onSelect: (media: MetaAdsMedia) => void;
  onOpenWhatsApp: () => void;
};

export function MediaPicker({
  selectedId,
  onSelect,
  onOpenWhatsApp,
}: MediaPickerProps) {
  const [media, setMedia] = useState<MetaAdsMedia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadMedia = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        toast.error("Entre novamente para criar uma campanha.");
        if (active) setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("midias_whatsapp")
        .select(
          "id, midia_url, thumbnail_url, arquivo_nome, legenda_gerada, contexto_original, tipo, created_at",
        )
        .eq("user_id", auth.user.id)
        .in("tipo", ["foto", "imagem", "video"])
        .order("created_at", { ascending: false })
        .limit(60);

      if (!active) return;
      if (error) toast.error("Não foi possível carregar suas mídias.");
      setMedia(data ?? []);
      setLoading(false);
    };

    void loadMedia();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-3">
      <Label>Escolha uma mídia recebida no seu WhatsApp</Label>
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando mídias...
        </p>
      ) : media.length ? (
        <div className="grid max-h-72 grid-cols-2 gap-3 overflow-y-auto md:grid-cols-4">
          {media.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className={`overflow-hidden rounded-md border-2 text-left ${
                selectedId === item.id
                  ? "border-blue-600"
                  : "border-transparent"
              }`}
            >
              {item.tipo === "video" ? (
                <video
                  src={item.midia_url}
                  poster={item.thumbnail_url ?? undefined}
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <img
                  src={item.thumbnail_url || item.midia_url}
                  alt={item.arquivo_nome || "Mídia do WhatsApp"}
                  className="aspect-square w-full object-cover"
                />
              )}
              <span className="block truncate p-2 text-xs">
                {item.arquivo_nome || item.tipo}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-6 text-center">
          <ImageIcon className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm">Nenhuma imagem ou vídeo recebido.</p>
          <Button variant="link" onClick={onOpenWhatsApp}>
            Abrir WhatsApp
          </Button>
        </div>
      )}
    </div>
  );
}
