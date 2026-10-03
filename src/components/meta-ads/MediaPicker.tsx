import { useCallback, useEffect, useRef, useState } from "react";
import {
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Upload,
  Video,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";

export type MetaAdsMedia = {
  id: string;
  media_source:
    | "midias_whatsapp"
    | "video_render_jobs"
    | "video_motion_jobs";
  midia_url: string;
  thumbnail_url: string | null;
  legenda_gerada: string | null;
  contexto_original: string | null;
  tipo: "foto" | "video";
  created_at: string;
  display_name: string;
  media_bucket?: string;
  media_path?: string;
};

type MediaPickerProps = {
  selectedId: string;
  onSelect: (media: MetaAdsMedia) => void;
};

export function MediaPicker({
  selectedId,
  onSelect,
}: MediaPickerProps) {
  const [receivedMedia, setReceivedMedia] = useState<MetaAdsMedia[]>([]);
  const [generatedMedia, setGeneratedMedia] = useState<MetaAdsMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMedia = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setLoadError("Sua sessão expirou. Entre novamente.");
      setLoading(false);
      return;
    }

    const [receivedResult, renderResult, motionResult] = await Promise.all([
      supabase
        .from("midias_whatsapp")
        .select(
          "id, midia_url, thumbnail_url, legenda_gerada, contexto_original, tipo, status, created_at",
        )
        .eq("user_id", auth.user.id)
        .in("tipo", ["foto", "video"])
        .neq("status", "arquivado")
        .order("created_at", { ascending: false })
        .limit(1_000),
      supabase
        .from("video_render_jobs")
        .select(
          "id, caption, copy_escolhida, resultado_bucket, resultado_path, status, created_at",
        )
        .eq("user_id", auth.user.id)
        .eq("status", "concluido")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("video_motion_jobs")
        .select(
          "id, titulo, legenda_post, resultado_bucket, resultado_path, status, created_at",
        )
        .eq("user_id", auth.user.id)
        .eq("status", "concluido")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    const failures = [
      receivedResult.error?.message,
      renderResult.error?.message,
      motionResult.error?.message,
    ].filter(Boolean);
    if (failures.length) {
      setLoadError(
        "Não foi possível carregar a biblioteca de mídias. Atualize a lista ou tente novamente.",
      );
    }

    setReceivedMedia(((receivedResult.data ?? []) as Array<{
      id: string;
      midia_url: string;
      thumbnail_url: string | null;
      legenda_gerada: string | null;
      contexto_original: string | null;
      tipo: string;
      created_at: string;
    }>).map((item) => ({
      id: item.id,
      media_source: "midias_whatsapp",
      midia_url: item.midia_url,
      thumbnail_url: item.thumbnail_url,
      legenda_gerada: item.legenda_gerada,
      contexto_original: item.contexto_original,
      tipo: item.tipo === "video" ? "video" : "foto",
      created_at: item.created_at,
      display_name: item.contexto_original?.trim().slice(0, 80) ||
        (item.tipo === "video" ? "Vídeo recebido" : "Foto recebida"),
    })));

    const generatedRows = [
      ...(renderResult.data ?? []).map((item) => ({
        ...item,
        source: "video_render_jobs" as const,
        title: item.caption || item.copy_escolhida || "Vídeo com legenda",
      })),
      ...(motionResult.data ?? []).map((item) => ({
        ...item,
        source: "video_motion_jobs" as const,
        title: item.titulo || item.legenda_post || "Vídeo animado",
      })),
    ].filter((item) => item.resultado_bucket && item.resultado_path);

    const generated = await Promise.all(generatedRows.map(async (item) => {
      const bucket = String(item.resultado_bucket);
      const path = String(item.resultado_path);
      const { data: signed } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 3_600);
      const fallback = supabase.storage.from(bucket).getPublicUrl(path)
        .data.publicUrl;
      return {
        id: item.id,
        media_source: item.source,
        midia_url: signed?.signedUrl || fallback,
        thumbnail_url: null,
        legenda_gerada: null,
        contexto_original: item.title,
        tipo: "video" as const,
        created_at: item.created_at,
        display_name: item.title,
        media_bucket: bucket,
        media_path: path,
      };
    }));
    setGeneratedMedia(generated.filter((item) =>
      item.midia_url.startsWith("https://")
    ));
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadMedia();
  }, [loadMedia]);

  const uploadMedia = async (file: File) => {
    const acceptedTypes = new Set(["image/jpeg", "image/png", "video/mp4"]);
    if (!acceptedTypes.has(file.type)) {
      toast.error("Envie uma imagem JPG/PNG ou um vídeo MP4.");
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 200 MB.");
      return;
    }
    setUploading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Sua sessão expirou. Entre novamente.");
      const extension = file.type === "image/png"
        ? "png"
        : file.type === "video/mp4"
        ? "mp4"
        : "jpg";
      const path =
        `whatsapp-images/${auth.user.id}/meta-ads-${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("produtos")
        .upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
      if (uploadError) throw uploadError;
      const publicUrl = supabase.storage.from("produtos").getPublicUrl(path)
        .data.publicUrl;
      if (!publicUrl?.startsWith("https://")) {
        throw new Error("Não foi possível gerar a URL HTTPS da mídia.");
      }
      const tipo = file.type === "video/mp4" ? "video" : "foto";
      const { data: inserted, error: insertError } = await supabase
        .from("midias_whatsapp")
        .insert({
          user_id: auth.user.id,
          origem: "upload",
          tipo,
          midia_url: publicUrl,
          mime_type: file.type,
          tamanho_bytes: file.size,
          contexto_original: `Upload para anúncio: ${file.name}`.slice(0, 500),
          status: "pendente",
        })
        .select(
          "id, midia_url, thumbnail_url, legenda_gerada, contexto_original, tipo, created_at",
        )
        .single();
      if (insertError || !inserted) {
        await supabase.storage.from("produtos").remove([path]);
        throw insertError ?? new Error("Não foi possível registrar a mídia.");
      }
      const selected: MetaAdsMedia = {
        id: inserted.id,
        media_source: "midias_whatsapp",
        midia_url: inserted.midia_url,
        thumbnail_url: inserted.thumbnail_url,
        legenda_gerada: inserted.legenda_gerada,
        contexto_original: inserted.contexto_original,
        tipo: inserted.tipo === "video" ? "video" : "foto",
        created_at: inserted.created_at,
        display_name: file.name,
        media_bucket: "produtos",
        media_path: path,
      };
      onSelect(selected);
      await loadMedia();
      toast.success("Mídia enviada e selecionada.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar a mídia.",
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const mediaGrid = (items: MetaAdsMedia[], emptyMessage: string) =>
    items.length ? (
      <div className="grid max-h-80 grid-cols-2 gap-3 overflow-y-auto md:grid-cols-4">
        {items.map((item) => (
          <button
            key={`${item.media_source}-${item.id}`}
            type="button"
            onClick={() => onSelect(item)}
            className={`overflow-hidden rounded-md border-2 text-left ${
              selectedId === item.id
                ? "border-blue-600"
                : "border-transparent"
            }`}
          >
            {item.tipo === "video" ? (
              <div className="relative">
                <video
                  src={item.midia_url}
                  className="aspect-square w-full bg-black object-cover"
                  muted
                  preload="metadata"
                />
                <Video className="absolute bottom-2 right-2 h-5 w-5 text-white drop-shadow" />
              </div>
            ) : (
              <img
                src={item.thumbnail_url || item.midia_url}
                alt={item.display_name}
                className="aspect-square w-full object-cover"
              />
            )}
            <span className="block truncate px-2 pt-2 text-xs font-medium">
              {item.display_name}
            </span>
            <span className="flex items-center justify-between gap-1 px-2 pb-2 pt-1 text-[11px] text-muted-foreground">
              <Badge variant="secondary" className="text-[10px]">
                {item.tipo === "video" ? "Vídeo" : "Imagem"}
              </Badge>
              {new Date(item.created_at).toLocaleDateString("pt-BR")}
            </span>
          </button>
        ))}
      </div>
    ) : (
      <div className="rounded-md border border-dashed p-6 text-center">
        <ImageIcon className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );

  return (
    <div className="space-y-3">
      <Label>Escolha a imagem ou vídeo do anúncio</Label>
      {loadError && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {loadError}
        </div>
      )}
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando mídias...
        </p>
      ) : (
        <Tabs defaultValue="received" className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-1 sm:grid-cols-3">
            <TabsTrigger value="received">Recebidas no WhatsApp</TabsTrigger>
            <TabsTrigger value="generated">Vídeos gerados</TabsTrigger>
            <TabsTrigger value="upload">Enviar do computador</TabsTrigger>
          </TabsList>
          <TabsContent value="received" className="space-y-3">
            {mediaGrid(
              receivedMedia,
              "Envie uma foto ou vídeo para o seu assistente no WhatsApp e atualize esta lista.",
            )}
            <Button variant="outline" onClick={() => void loadMedia()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar lista
            </Button>
          </TabsContent>
          <TabsContent value="generated" className="space-y-3">
            {mediaGrid(
              generatedMedia,
              "Nenhum vídeo gerado concluído foi encontrado.",
            )}
            <Button variant="outline" onClick={() => void loadMedia()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar lista
            </Button>
          </TabsContent>
          <TabsContent value="upload">
            <div className="rounded-md border border-dashed p-6 text-center">
              <Upload className="mx-auto mb-3 h-7 w-7 text-muted-foreground" />
              <p className="mb-3 text-sm text-muted-foreground">
                Envie uma imagem JPG/PNG ou um vídeo MP4 de até 200 MB.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,video/mp4"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadMedia(file);
                }}
              />
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <Upload className="mr-2 h-4 w-4" />}
                Escolher arquivo
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
