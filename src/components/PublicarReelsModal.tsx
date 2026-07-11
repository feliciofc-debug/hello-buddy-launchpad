import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Video, Facebook, Instagram, Loader2, X, Sparkles, Check, Clock, CalendarClock, Save } from "lucide-react";

interface PublishResult {
  facebook?: { ok: boolean; postId?: string; error?: string };
  instagram?: { ok: boolean; postId?: string; error?: string };
}

interface PublicarReelsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl?: string | null;
  videoNome?: string | null;
  videoId?: string | null;
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
  publicadoFacebook?: boolean;
  publicadoInstagram?: boolean;
  onPublished?: (result: PublishResult) => void | Promise<void>;
}

export function PublicarReelsModal({
  open,
  onOpenChange,
  videoUrl,
  videoNome,
  videoId,
  produto,
  publicadoFacebook = false,
  publicadoInstagram = false,
  onPublished,
}: PublicarReelsModalProps) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [descricaoVideo, setDescricaoVideo] = useState("");
  const [whatsappLink, setWhatsappLink] = useState("");
  const [postFacebook, setPostFacebook] = useState(!publicadoFacebook);
  const [postInstagram, setPostInstagram] = useState(!publicadoInstagram);
  const [uploading, setUploading] = useState(false);
  const [generatingCaption, setGeneratingCaption] = useState(false);
  const [captionOptions, setCaptionOptions] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [agendar, setAgendar] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<string>("");
  const [scheduledTime, setScheduledTime] = useState<string>("");
  const [savingDescricao, setSavingDescricao] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasPreloadedVideo = !!videoUrl;
  const productName = produto?.nome || produto?.titulo || "";
  const productLink = produto?.link || produto?.link_afiliado || produto?.link_marketplace || "";

  useEffect(() => {
    if (open) {
      // Reset checkboxes baseado no estado atual de publicação ao abrir
      setPostFacebook(!publicadoFacebook);
      setPostInstagram(!publicadoInstagram);
      setAgendar(false);
      setScheduledDate("");
      setScheduledTime("");
      // Carregar descrição salva do vídeo (usada pela IA no Autopilot)
      if (videoId) {
        (async () => {
          const { data } = await supabase
            .from("produto_videos" as any)
            .select("descricao_ia, whatsapp_link")
            .eq("id", videoId)
            .maybeSingle();
          if (data) {
            if ((data as any).descricao_ia) setDescricaoVideo((data as any).descricao_ia);
            if ((data as any).whatsapp_link) setWhatsappLink((data as any).whatsapp_link);
          }
        })();
      }
    } else {
      setCaptionOptions([]);
      setSelectedOption(null);
      setDescricaoVideo("");
      setWhatsappLink("");
      setCaption("");
      if (!hasPreloadedVideo) {
        handleRemoveVideo();
      }
    }
  }, [open, publicadoFacebook, publicadoInstagram, videoId]);

  const handleSalvarDescricao = async () => {
    if (!videoId) {
      toast.error("Não é possível salvar (vídeo não identificado)");
      return;
    }
    setSavingDescricao(true);
    try {
      const { error } = await supabase
        .from("produto_videos" as any)
        .update({ descricao_ia: descricaoVideo.trim() || null })
        .eq("id", videoId);
      if (error) throw error;
      toast.success("💾 Comentário salvo! A IA do Autopilot vai usar isso.");
    } catch (err: any) {
      console.error("[REELS] Erro ao salvar descrição:", err);
      toast.error(err.message || "Erro ao salvar comentário");
    } finally {
      setSavingDescricao(false);
    }
  };

  // Validação client-side da duração do vídeo (Instagram: 3-90s, Facebook: até 900s)
  const validarDuracao = (): Promise<{ ok: boolean; error?: string }> => {
    return new Promise((resolve) => {
      if (!hasPreloadedVideo) {
        resolve({ ok: true }); // upload manual: confia no FFmpeg
        return;
      }
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => {
        const dur = v.duration;
        if (!isFinite(dur) || dur <= 0) {
          resolve({ ok: true }); // não conseguiu ler, deixa API validar
          return;
        }
        if (dur < 3) {
          resolve({ ok: false, error: `Vídeo muito curto (${dur.toFixed(1)}s). Mínimo: 3 segundos.` });
          return;
        }
        if (postInstagram && dur > 90) {
          resolve({ ok: false, error: `Vídeo muito longo para Instagram (${dur.toFixed(1)}s). Máximo: 90s. Desmarque IG ou regenere o reel.` });
          return;
        }
        if (postFacebook && dur > 900) {
          resolve({ ok: false, error: `Vídeo muito longo para Facebook Reels (${dur.toFixed(1)}s). Máximo: 15 minutos.` });
          return;
        }
        resolve({ ok: true });
      };
      v.onerror = () => resolve({ ok: true }); // erro de leitura: deixa API validar
      v.src = videoUrl!;
    });
  };

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

    // Validar agendamento
    let scheduledFor: Date | null = null;
    if (agendar) {
      if (!scheduledDate || !scheduledTime) {
        toast.error("Escolha data e horário do agendamento");
        return;
      }
      scheduledFor = new Date(`${scheduledDate}T${scheduledTime}:00`);
      if (isNaN(scheduledFor.getTime())) {
        toast.error("Data ou horário inválido");
        return;
      }
      if (scheduledFor.getTime() < Date.now() + 60_000) {
        toast.error("O agendamento precisa ser pelo menos 1 minuto no futuro");
        return;
      }
      // Agendamento exige vídeo já pré-carregado (não dá pra subir on-demand depois)
      if (!hasPreloadedVideo) {
        toast.error("Para agendar, use um vídeo da Área de Vídeos (já salvo).");
        return;
      }
    }

    // Validação de duração ANTES de iniciar
    const validacao = await validarDuracao();
    if (!validacao.ok) {
      toast.error(validacao.error || "Vídeo inválido");
      return;
    }

    setUploading(true);
    const publishResult: PublishResult = {};

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

      const platforms: ("facebook" | "instagram")[] = [];
      if (postFacebook) platforms.push("facebook");
      if (postInstagram) platforms.push("instagram");

      // Se for agendamento, salvar no banco e sair
      if (agendar && scheduledFor) {
        const { error: agErr } = await supabase.from("videos_agendados").insert({
          user_id: user.id,
          tipo: "reels",
          video_url: publishVideoUrl!,
          video_nome: videoNome || null,
          caption,
          canais: platforms,
          produto_id: produto?.id || null,
          scheduled_for: scheduledFor.toISOString(),
          status: "pendente",
        });
        if (agErr) throw agErr;
        toast.success(`📅 Reels agendado para ${scheduledFor.toLocaleString("pt-BR")}`);
        setCaption("");
        setCaptionOptions([]);
        setSelectedOption(null);
        onOpenChange(false);
        return;
      }

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
          publishResult[platform] = { ok: false, error: pubError.message };
          continue;
        }

        if (result?.success) {
          successCount++;
          toast.success(`✅ Reels publicado no ${platform === "facebook" ? "Facebook" : "Instagram"}!`);
          publishResult[platform] = { ok: true, postId: result.post_id };

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
          publishResult[platform] = { ok: false, error: result?.error || "Erro desconhecido" };
        }
      }

      // Notifica componente pai com resultado de cada plataforma
      if (onPublished && (publishResult.facebook?.ok || publishResult.instagram?.ok)) {
        await onPublished(publishResult);
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
            <div className="flex items-center justify-between mb-1">
              <Label className="text-sm font-medium">Sobre o que é esse vídeo? (opcional)</Label>
              {videoId && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleSalvarDescricao}
                  disabled={savingDescricao}
                  className="h-7 text-xs"
                  title="Salvar para o Autopilot usar como contexto ao gerar legendas"
                >
                  {savingDescricao ? (
                    <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Salvando</>
                  ) : (
                    <><Save className="mr-1 h-3 w-3" /> Salvar comentário</>
                  )}
                </Button>
              )}
            </div>
            <Textarea
              value={descricaoVideo}
              onChange={(e) => setDescricaoVideo(e.target.value)}
              placeholder="Ex: vídeo mostrando os produtos da loja, promoção de fim de semana, novo produto chegando..."
              className="min-h-[60px] mt-1"
              rows={2}
            />
            {videoId && (
              <p className="text-[10px] text-muted-foreground mt-1">
                💡 Salve o comentário para que o Autopilot da IA saiba do que se trata o vídeo ao gerar legendas automaticamente.
              </p>
            )}
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
            <div className="flex gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="reels-fb"
                  checked={postFacebook}
                  disabled={publicadoFacebook}
                  onCheckedChange={(v) => setPostFacebook(!!v)}
                />
                <label
                  htmlFor="reels-fb"
                  className={`text-sm flex items-center gap-1 ${publicadoFacebook ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <Facebook className="h-4 w-4 text-blue-600" />
                  Facebook Reels
                  {publicadoFacebook && (
                    <Badge variant="secondary" className="ml-1 text-[10px] gap-1">
                      <Check className="h-3 w-3" /> Já publicado
                    </Badge>
                  )}
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="reels-ig"
                  checked={postInstagram}
                  disabled={publicadoInstagram}
                  onCheckedChange={(v) => setPostInstagram(!!v)}
                />
                <label
                  htmlFor="reels-ig"
                  className={`text-sm flex items-center gap-1 ${publicadoInstagram ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <Instagram className="h-4 w-4 text-pink-600" />
                  Instagram Reels
                  {publicadoInstagram && (
                    <Badge variant="secondary" className="ml-1 text-[10px] gap-1">
                      <Check className="h-3 w-3" /> Já publicado
                    </Badge>
                  )}
                </label>
              </div>
            </div>
          </div>

          {/* Agendamento (apenas vídeos pré-carregados) */}
          {hasPreloadedVideo && (
            <div className="space-y-2 border-t pt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={agendar}
                  onCheckedChange={(c) => setAgendar(!!c)}
                  disabled={uploading}
                />
                <CalendarClock className="h-4 w-4" />
                <span className="text-sm font-medium">Agendar para depois</span>
              </label>

              {agendar && (
                <div className="grid grid-cols-2 gap-2 pl-6">
                  <div>
                    <Label className="text-xs">Data</Label>
                    <Input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      disabled={uploading}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Horário</Label>
                    <Input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      disabled={uploading}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Botão publicar */}
          <Button
            onClick={handlePublish}
            disabled={!hasVideo || uploading}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
            size="lg"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {agendar ? "Agendando..." : "Publicando..."}
              </>
            ) : agendar ? (
              <>
                <Clock className="mr-2 h-5 w-5" />
                📅 Agendar Reels
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
