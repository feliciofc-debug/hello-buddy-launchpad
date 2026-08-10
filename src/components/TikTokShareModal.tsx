import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Video, Image, ExternalLink, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { buildTikTokAuthUrl } from "@/config/tiktok";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TikTokShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: {
    type: "image" | "video";
    url: string;
    title?: string;
    description?: string;
  };
}

export const TikTokShareModal = ({ open, onOpenChange, content }: TikTokShareModalProps) => {
  const [loading, setLoading] = useState(false);
  const [caption, setCaption] = useState("");
  const [postMode, setPostMode] = useState<"direct" | "draft">("draft");
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(true);
  const [tiktokProfile, setTiktokProfile] = useState<{
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
    open_id: string | null;
    expired?: boolean;
  } | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  type PostStatus = "idle" | "uploading" | "processing" | "done" | "failed";
  const [postStatus, setPostStatus] = useState<PostStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [failReason, setFailReason] = useState<string>("");
  const [attempts, setAttempts] = useState(0);

  const pollTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  const clearTimers = useCallback(() => {
    cancelledRef.current = true;
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  // Cleanup: nunca deixar polling rodando em background
  useEffect(() => clearTimers, [clearTimers]);

  useEffect(() => {
    if (!open) {
      clearTimers();
      setPostStatus("idle");
      setStatusMessage("");
      setFailReason("");
      setAttempts(0);
      return;
    }

    cancelledRef.current = false;
    checkTikTokConnection();
    // Preencher caption com título do produto se disponível
    if (content.title) {
      setCaption(`${content.title}\n\n🔥 Confira essa oferta incrível!\n\n#tiktok #ofertas #promocao #fyp #viral`);
    }
  }, [open, content.title, clearTimers]);

  const MAX_ATTEMPTS = 40;

  const startPolling = (userId: string, publishId: string) => {
    let attempt = 0;

    const tick = async () => {
      if (cancelledRef.current) return;
      attempt += 1;
      setAttempts(attempt);

      try {
        const { data, error } = await supabase.functions.invoke("tiktok-post-status", {
          body: { user_id: userId, publish_id: publishId },
        });

        if (cancelledRef.current) return;

        if (!error && data?.success) {
          const status: string = data.status;

          if (status === "PUBLISH_COMPLETE") {
            setPostStatus("done");
            setStatusMessage("✅ Publicado no TikTok!");
            closeTimerRef.current = window.setTimeout(() => onOpenChange(false), 2000);
            return;
          }
          if (status === "SEND_TO_USER_INBOX") {
            setPostStatus("done");
            setStatusMessage(
              "✅ Vídeo enviado! Abra o app do TikTok, vá na Caixa de entrada e toque em publicar."
            );
            closeTimerRef.current = window.setTimeout(() => onOpenChange(false), 2000);
            return;
          }
          if (status === "FAILED") {
            setPostStatus("failed");
            setFailReason(data.fail_reason || "O TikTok não informou o motivo.");
            setStatusMessage("");
            return;
          }

          // PROCESSING_UPLOAD / PROCESSING_DOWNLOAD
          setPostStatus("processing");
          setStatusMessage(
            attempt >= 15
              ? "Ainda processando. Você pode fechar esta janela — o vídeo aparecerá na Caixa de entrada do TikTok."
              : "Processando no TikTok..."
          );
        }
      } catch (e) {
        console.error("Erro ao consultar status TikTok:", e);
      }

      if (cancelledRef.current) return;

      if (attempt >= MAX_ATTEMPTS) {
        // Estourar o limite NÃO é erro
        setPostStatus("processing");
        setStatusMessage("O TikTok ainda está processando. Confira no app em alguns minutos.");
        return;
      }

      const delay = attempt < 10 ? 3000 : 5000;
      pollTimerRef.current = window.setTimeout(tick, delay);
    };

    setPostStatus("processing");
    setStatusMessage("Processando no TikTok...");
    pollTimerRef.current = window.setTimeout(tick, 3000);
  };

  const checkTikTokConnection = async () => {
    setCheckingConnection(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsConnected(false);
        return;
      }

      const nowIso = new Date().toISOString();

      const { data: integration } = await supabase
        .from("integrations")
        .select("id, is_active, platform, token_expires_at")
        .eq("user_id", user.id)
        .eq("platform", "tiktok")
        .eq("is_active", true)
        .gt("token_expires_at", nowIso)
        .maybeSingle();

      const connected = !!integration;
      setIsConnected(connected);

      if (connected) {
        setLoadingProfile(true);
        try {
          const { data: profileData } = await supabase.functions.invoke(
            "tiktok-fetch-userinfo",
            { body: { user_id: user.id } }
          );
          if (profileData?.connected) {
            setTiktokProfile({
              display_name: profileData.display_name || null,
              username: profileData.username || null,
              avatar_url: profileData.avatar_url || null,
              open_id: profileData.open_id || null,
              expired: !!profileData.expired,
            });
          } else {
            setTiktokProfile(null);
          }
        } catch (e) {
          console.error("Erro ao buscar perfil TikTok:", e);
          setTiktokProfile(null);
        } finally {
          setLoadingProfile(false);
        }
      } else {
        setTiktokProfile(null);
      }
    } catch (error) {
      console.error("Erro ao verificar conexão TikTok:", error);
      setIsConnected(false);
    } finally {
      setCheckingConnection(false);
    }
  };

  const handleConnectTikTok = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Você precisa estar logado");
      return;
    }

    const authUrl = buildTikTokAuthUrl(user.id);


    onOpenChange(false);
    window.location.href = authUrl;
  };

  const handlePost = async () => {
    if (!caption.trim()) {
      toast.error("Digite uma legenda para o post");
      return;
    }

    cancelledRef.current = false;
    setFailReason("");
    setAttempts(0);
    setPostStatus("uploading");
    setStatusMessage("Enviando vídeo para o TikTok...");
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado");
        setPostStatus("idle");
        return;
      }

      const { data, error } = await supabase.functions.invoke("tiktok-post-content", {
        body: {
          user_id: user.id,
          content_type: content.type,
          content_url: content.url,
          title: caption,
          post_mode: postMode
        }
      });

      if (error) throw error;

      if (data.success) {
        if (data.publish_id) {
          startPolling(user.id, data.publish_id);
        } else {
          setPostStatus("done");
          setStatusMessage(data.message || "✅ Vídeo enviado ao TikTok!");
          closeTimerRef.current = window.setTimeout(() => onOpenChange(false), 2000);
        }
      } else {
        throw new Error(data.error || "Erro ao postar no TikTok");
      }
    } catch (error: any) {
      console.error("Erro ao postar:", error);
      setPostStatus("failed");
      setFailReason(error.message || "Erro ao enviar para o TikTok");
      toast.error(error.message || "Erro ao enviar para o TikTok");
    } finally {
      setLoading(false);
    }
  };

  const handleDialogChange = (next: boolean) => {
    if (!next) clearTimers();
    onOpenChange(next);
  };

  if (checkingConnection) {
    return (
      <Dialog open={open} onOpenChange={handleDialogChange}>
        <DialogContent className="sm:max-w-md">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!isConnected) {
    return (
      <Dialog open={open} onOpenChange={handleDialogChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
              </svg>
              Conectar TikTok
            </DialogTitle>
            <DialogDescription>
              Você precisa conectar sua conta do TikTok para compartilhar conteúdo.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium">Benefícios da conexão:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>✅ Postar vídeos diretamente no TikTok</li>
                <li>✅ Salvar como rascunho para edição</li>
                <li>✅ Gerenciar seus posts de um só lugar</li>
              </ul>
            </div>

            <Button onClick={handleConnectTikTok} className="w-full" size="lg">
              <ExternalLink className="mr-2 h-4 w-4" />
              Conectar TikTok
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
              <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
            </svg>
            Compartilhar no TikTok
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* TikTok Account Card */}
          {loadingProfile ? (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Loading TikTok account…</span>
            </div>
          ) : tiktokProfile ? (
            <div className="rounded-lg border bg-muted/40 p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  {tiktokProfile.avatar_url && (
                    <AvatarImage src={tiktokProfile.avatar_url} alt={tiktokProfile.display_name || "TikTok"} />
                  )}
                  <AvatarFallback>
                    {(tiktokProfile.display_name || tiktokProfile.username || "T").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Posting to TikTok account:</p>
                  <p className="font-semibold truncate">{tiktokProfile.display_name || "—"}</p>
                  {tiktokProfile.username && (
                    <p className="text-xs text-muted-foreground truncate">@{tiktokProfile.username}</p>
                  )}
                </div>
              </div>
              {tiktokProfile.expired && (
                <div className="mt-2 flex items-center gap-2 rounded-md bg-yellow-500/10 p-2 text-xs text-yellow-700 dark:text-yellow-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Token expired. Reconnect TikTok before posting.</span>
                </div>
              )}
            </div>
          ) : null}

          {/* Preview */}
          <div className="aspect-[9/16] max-h-[300px] bg-muted rounded-lg overflow-hidden flex items-center justify-center">
            {content.type === "video" ? (
              <video 
                src={content.url} 
                className="w-full h-full object-contain"
                controls
                muted
              />
            ) : (
              <img 
                src={content.url} 
                alt="Preview" 
                className="w-full h-full object-contain"
              />
            )}
          </div>

          {/* Caption */}
          <div className="space-y-2">
            <Label>Legenda / Título</Label>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Digite a legenda do seu post..."
              className="min-h-[100px]"
              maxLength={2200}
            />
            <p className="text-xs text-muted-foreground text-right">
              {caption.length}/2200 caracteres
            </p>
          </div>

          {/* Post Mode */}
          <div className="space-y-2">
            <Label>Modo de Publicação</Label>
            <RadioGroup value={postMode} onValueChange={(v) => setPostMode(v as "direct" | "draft")}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="draft" id="draft" />
                <Label htmlFor="draft" className="cursor-pointer">
                  📝 Salvar como Rascunho (recomendado)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="direct" id="direct" />
                <Label htmlFor="direct" className="cursor-pointer">
                  🚀 Publicar Diretamente
                </Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              {postMode === "draft" 
                ? "O vídeo será enviado para seus rascunhos no TikTok para você revisar antes de publicar."
                : "O vídeo será publicado imediatamente no seu perfil do TikTok."
              }
            </p>
          </div>

          {/* Botão de enviar */}
          <Button 
            onClick={handlePost} 
            disabled={loading || !caption.trim()}
            className="w-full bg-gradient-to-r from-pink-500 to-cyan-500 hover:from-pink-600 hover:to-cyan-600"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                {content.type === "video" ? <Video className="mr-2 h-5 w-5" /> : <Image className="mr-2 h-5 w-5" />}
                {postMode === "draft" ? "Salvar Rascunho" : "Publicar no TikTok"}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
