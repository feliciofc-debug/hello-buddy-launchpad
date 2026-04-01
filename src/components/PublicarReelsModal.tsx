import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Video, Facebook, Instagram, Loader2, X, Sparkles } from "lucide-react";

interface PublicarReelsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produto?: {
    id?: string;
    nome?: string;
    titulo?: string;
    descricao?: string | null;
    preco?: number | null;
    link?: string | null;
    link_afiliado?: string;
    link_marketplace?: string | null;
    imagem_url?: string | null;
  } | null;
}

export function PublicarReelsModal({ open, onOpenChange, produto }: PublicarReelsModalProps) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [postFacebook, setPostFacebook] = useState(true);
  const [postInstagram, setPostInstagram] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [generatingCaption, setGeneratingCaption] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const productName = produto?.nome || produto?.titulo || "";
  const productLink = produto?.link || produto?.link_afiliado || produto?.link_marketplace || "";

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast.error("Selecione um arquivo de vídeo (MP4)");
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      toast.error("Vídeo muito grande. Máximo 100MB.");
      return;
    }

    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const handleRemoveVideo = () => {
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoFile(null);
    setVideoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleGenerateCaption = async () => {
    if (!productName) {
      toast.error("Nenhum produto selecionado para gerar legenda");
      return;
    }

    setGeneratingCaption(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-posts", {
        body: {
          produto: productName,
          preco: produto?.preco ? `R$ ${produto.preco.toFixed(2)}` : "",
          url: productLink,
          tipo: "reels",
        },
      });

      if (error) throw error;

      const text = data?.instagram?.opcaoA || data?.facebook?.opcaoA || "";
      if (text) {
        setCaption(text);
        toast.success("Legenda gerada com IA!");
      } else {
        toast.error("Não foi possível gerar a legenda");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar legenda com IA");
    } finally {
      setGeneratingCaption(false);
    }
  };

  const handlePublish = async () => {
    if (!videoFile) {
      toast.error("Selecione um vídeo primeiro");
      return;
    }
    if (!caption.trim()) {
      toast.error("Escreva uma legenda");
      return;
    }
    if (!postFacebook && !postInstagram) {
      toast.error("Selecione pelo menos uma rede social");
      return;
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // 1. Upload do vídeo para o storage
      const ext = videoFile.name.split(".").pop() || "mp4";
      const filePath = `reels/${user.id}/${Date.now()}.${ext}`;

      toast.info("📤 Enviando vídeo...");

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("videos")
        .upload(filePath, videoFile, {
          contentType: videoFile.type,
          upsert: false,
        });

      if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`);

      // 2. Gerar URL pública
      const { data: urlData } = supabase.storage.from("videos").getPublicUrl(uploadData.path);
      const videoUrl = urlData.publicUrl;

      console.log("📹 Vídeo uploaded:", videoUrl);

      // 3. Publicar como Reels
      const platforms = [];
      if (postFacebook) platforms.push("facebook");
      if (postInstagram) platforms.push("instagram");

      let successCount = 0;

      for (const platform of platforms) {
        toast.info(`📹 Publicando Reels no ${platform === "facebook" ? "Facebook" : "Instagram"}...`);

        const { data: result, error: pubError } = await supabase.functions.invoke("meta-publish-reels", {
          body: {
            platform,
            video_url: videoUrl,
            caption: caption,
            user_id: user.id,
          },
        });

        if (pubError) {
          console.error(`Erro ${platform}:`, pubError);
          toast.error(`❌ Erro ao publicar no ${platform}: ${pubError.message}`);
          continue;
        }

        if (result?.success) {
          successCount++;
          toast.success(`✅ Reels publicado no ${platform === "facebook" ? "Facebook" : "Instagram"}!`);

          // Registrar na social_posts_queue
          await supabase.from("social_posts_queue" as any).insert({
            user_id: user.id,
            platform,
            post_text: caption,
            status: "publicado",
            fb_post_id: result.post_id,
            published_at: new Date().toISOString(),
            produto_id: produto?.id || null,
            produto_source: produto?.id ? "produtos" : null,
          });
        } else {
          toast.error(`❌ ${platform}: ${result?.error || "Erro desconhecido"}`);
        }
      }

      if (successCount > 0) {
        handleRemoveVideo();
        setCaption("");
        onOpenChange(false);
      }
    } catch (err: any) {
      console.error("Erro geral:", err);
      toast.error(err.message || "Erro ao publicar Reels");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            📹 Publicar Reels
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info do produto */}
          {productName && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium">{productName}</p>
              {produto?.preco && (
                <p className="text-xs text-muted-foreground">R$ {produto.preco.toFixed(2)}</p>
              )}
            </div>
          )}

          {/* Upload de vídeo */}
          <div>
            <Label className="text-sm font-medium">Vídeo (MP4, máx 100MB)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            {!videoFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all"
              >
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Clique para selecionar o vídeo</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Formato vertical (9:16) • 15s a 90s • MP4
                </p>
              </div>
            ) : (
              <div className="mt-2 relative">
                <video
                  src={videoPreview || ""}
                  controls
                  className="w-full rounded-lg max-h-[300px] bg-black"
                />
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={handleRemoveVideo}
                >
                  <X className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline">{videoFile.name}</Badge>
                  <Badge variant="secondary">
                    {(videoFile.size / (1024 * 1024)).toFixed(1)} MB
                  </Badge>
                </div>
              </div>
            )}
          </div>

          {/* Legenda */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-sm font-medium">Legenda</Label>
              {productName && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleGenerateCaption}
                  disabled={generatingCaption}
                  className="text-xs h-7"
                >
                  {generatingCaption ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Sparkles className="h-3 w-3 mr-1" />
                  )}
                  Gerar com IA
                </Button>
              )}
            </div>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Escreva a legenda do seu Reels..."
              className="min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {caption.length}/2200 caracteres
            </p>
          </div>

          {/* Plataformas */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Publicar em:</Label>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="reels-fb"
                  checked={postFacebook}
                  onCheckedChange={(v) => setPostFacebook(!!v)}
                />
                <label htmlFor="reels-fb" className="text-sm flex items-center gap-1 cursor-pointer">
                  <Facebook className="h-4 w-4 text-blue-600" />
                  Facebook Reels
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="reels-ig"
                  checked={postInstagram}
                  onCheckedChange={(v) => setPostInstagram(!!v)}
                />
                <label htmlFor="reels-ig" className="text-sm flex items-center gap-1 cursor-pointer">
                  <Instagram className="h-4 w-4 text-pink-600" />
                  Instagram Reels
                </label>
              </div>
            </div>
          </div>

          {/* Botão publicar */}
          <Button
            onClick={handlePublish}
            disabled={!videoFile || !caption.trim() || uploading}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
            size="lg"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Publicando...
              </>
            ) : (
              <>
                <Video className="mr-2 h-5 w-5" />
                🚀 Publicar Reels
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            📱 Dica: Grave vídeos verticais (9:16) de 15 a 90 segundos para melhor performance
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
