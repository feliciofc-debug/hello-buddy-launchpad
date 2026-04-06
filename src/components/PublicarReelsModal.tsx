import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Video, Facebook, Instagram, Loader2, X, Sparkles, Check } from "lucide-react";

interface PublicarReelsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl?: string | null;
  videoNome?: string | null;
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

export function PublicarReelsModal({ open, onOpenChange, videoUrl, videoNome, produto }: PublicarReelsModalProps) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [descricaoVideo, setDescricaoVideo] = useState("");
  const [postFacebook, setPostFacebook] = useState(true);
  const [postInstagram, setPostInstagram] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [generatingCaption, setGeneratingCaption] = useState(false);
  const [captionOptions, setCaptionOptions] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasPreloadedVideo = !!videoUrl;
  const productName = produto?.nome || produto?.titulo || "";
  const productLink = produto?.link || produto?.link_afiliado || produto?.link_marketplace || "";

  useEffect(() => {
    if (!open) {
      setCaptionOptions([]);
      setSelectedOption(null);
      setDescricaoVideo("");
      setCaption("");
      if (!hasPreloadedVideo) {
        handleRemoveVideo();
      }
    }
  }, [open]);

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

  const handleGenerateCaptions = async () => {
    setGeneratingCaption(true);
    setCaptionOptions([]);
    setSelectedOption(null);

    try {
      const context = descricaoVideo || videoNome || productName || "vídeo promocional";

      const { data, error } = await supabase.functions.invoke("gerar-posts", {
        body: {
          produto: {
            nome: context,
            preco: produto?.preco || 0,
          },
        },
      });

      if (error) throw error;

      const posts = data?.posts;
      if (posts) {
        const options: string[] = [];
        if (posts.instagram?.opcaoA) options.push(posts.instagram.opcaoA);
        if (posts.instagram?.opcaoB) options.push(posts.instagram.opcaoB);
        if (posts.instagram?.opcaoC) options.push(posts.instagram.opcaoC);

        if (options.length === 0 && posts.facebook) {
          if (posts.facebook.opcaoA) options.push(posts.facebook.opcaoA);
          if (posts.facebook.opcaoB) options.push(posts.facebook.opcaoB);
          if (posts.facebook.opcaoC) options.push(posts.facebook.opcaoC);
        }

        if (options.length > 0) {
          setCaptionOptions(options.slice(0, 3));
          toast.success("3 opções de legenda geradas!");
        } else {
          toast.error("Não foi possível gerar legendas");
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar legendas com IA");
    } finally {
      setGeneratingCaption(false);
    }
  };

  const selectCaptionOption = (index: number) => {
    setSelectedOption(index);
    setCaption(captionOptions[index]);
  };

  const handlePublish = async () => {
    const finalVideoUrl = hasPreloadedVideo ? videoUrl : null;

    if (!hasPreloadedVideo && !videoFile) {
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

      let publishVideoUrl = finalVideoUrl;

      if (!hasPreloadedVideo && videoFile) {
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

        const { data: urlData } = supabase.storage.from("videos").getPublicUrl(uploadData.path);
        publishVideoUrl = urlData.publicUrl;
      }

      console.log("📹 Vídeo para publicar:", publishVideoUrl);

      const platforms = [];
      if (postFacebook) platforms.push("facebook");
      if (postInstagram) platforms.push("instagram");

      let successCount = 0;

      for (const platform of platforms) {
        toast.info(`📹 Publicando Reels no ${platform === "facebook" ? "Facebook" : "Instagram"}...`);

        const { data: result, error: pubError } = await supabase.functions.invoke("meta-publish-reels", {
          body: {
            platform,
            video_url: publishVideoUrl,
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
        if (!hasPreloadedVideo) handleRemoveVideo();
        setCaption("");
        setCaptionOptions([]);
        setSelectedOption(null);
        onOpenChange(false);
      }
    } catch (err: any) {
      console.error("Erro geral:", err);
      toast.error(err.message || "Erro ao publicar Reels");
    } finally {
      setUploading(false);
    }
  };

  const hasVideo = hasPreloadedVideo || !!videoFile;

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

          {/* Vídeo pré-carregado OU upload */}
          <div>
            <Label className="text-sm font-medium">Vídeo</Label>

            {hasPreloadedVideo ? (
              <div className="mt-2">
                <video
                  src={videoUrl!}
                  controls
                  className="w-full rounded-lg max-h-[300px] bg-black"
                />
                <div className="flex items-center gap-2 mt-2">
                  <Badge className="bg-green-600 text-white gap-1">
                    <Check className="h-3 w-3" /> Vídeo já salvo
                  </Badge>
                  {videoNome && (
                    <Badge variant="outline" className="text-xs truncate max-w-[200px]">
                      {videoNome}
                    </Badge>
                  )}
                </div>
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>

          {/* Descrição do vídeo para IA */}
          <div>
            <Label className="text-sm font-medium">Sobre o que é esse vídeo? (opcional)</Label>
            <Textarea
              value={descricaoVideo}
              onChange={(e) => setDescricaoVideo(e.target.value)}
              placeholder="Ex: vídeo mostrando os produtos da loja, promoção de fim de semana, novo produto chegando..."
              className="min-h-[60px] mt-1"
              rows={2}
            />
          </div>

          {/* Botão gerar 3 opções */}
          <Button
            onClick={handleGenerateCaptions}
            disabled={generatingCaption}
            variant="outline"
            className="w-full"
          >
            {generatingCaption ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gerando 3 opções...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                ✨ Gerar 3 opções com IA
              </>
            )}
          </Button>

          {/* 3 opções de legenda */}
          {captionOptions.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Escolha uma opção:</Label>
              {captionOptions.map((option, idx) => (
                <Card
                  key={idx}
                  className={`p-3 cursor-pointer transition-all hover:border-primary/50 ${
                    selectedOption === idx
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-muted"
                  }`}
                  onClick={() => selectCaptionOption(idx)}
                >
                  <div className="flex items-start gap-2">
                    <Badge
                      variant={selectedOption === idx ? "default" : "outline"}
                      className="text-xs shrink-0 mt-0.5"
                    >
                      {idx === 0 ? "🎉 Animada" : idx === 1 ? "💼 Profissional" : "❓ Engajamento"}
                    </Badge>
                    {selectedOption === idx && (
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-4">{option}</p>
                </Card>
              ))}
            </div>
          )}

          {/* Legenda */}
          <div>
            <Label className="text-sm font-medium">Legenda</Label>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Escreva a legenda do seu Reels ou gere com IA acima..."
              className="min-h-[100px] mt-1"
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
            disabled={!hasVideo || !caption.trim() || uploading}
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
