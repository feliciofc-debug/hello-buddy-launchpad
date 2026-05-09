import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Video, Image, ExternalLink, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

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

  useEffect(() => {
    if (open) {
      checkTikTokConnection();
      // Preencher caption com título do produto se disponível
      if (content.title) {
        setCaption(`${content.title}\n\n🔥 Confira essa oferta incrível!\n\n#tiktok #ofertas #promocao #fyp #viral`);
      }
    }
  }, [open, content.title]);

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

    const clientKey = "aw2ouo90dyp4ju9w";
    const redirectUri = encodeURIComponent("https://amzofertas.com.br/tiktok/callback");
    const scope = "user.info.basic,user.info.profile,video.upload,video.publish";
    const state = user.id;

    const authUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&response_type=code&scope=${scope}&redirect_uri=${redirectUri}&state=${state}`;

    onOpenChange(false);
    window.location.href = authUrl;
  };

  const handlePost = async () => {
    if (!caption.trim()) {
      toast.error("Digite uma legenda para o post");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado");
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
        toast.success(
          postMode === "draft" 
            ? "✅ Vídeo enviado para rascunhos do TikTok!" 
            : "✅ Vídeo publicado no TikTok!"
        );
        onOpenChange(false);
      } else {
        throw new Error(data.error || "Erro ao postar no TikTok");
      }
    } catch (error: any) {
      console.error("Erro ao postar:", error);
      toast.error(error.message || "Erro ao enviar para o TikTok");
    } finally {
      setLoading(false);
    }
  };

  if (checkingConnection) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
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
      <Dialog open={open} onOpenChange={onOpenChange}>
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
    <Dialog open={open} onOpenChange={onOpenChange}>
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
