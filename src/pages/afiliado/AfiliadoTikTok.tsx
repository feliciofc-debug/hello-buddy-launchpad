import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, RefreshCw, Trash2, Video, Clock, CheckCircle, AlertCircle, Settings } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TikTokPost {
  id: string;
  title: string;
  content_type: string;
  post_mode: string;
  status: string;
  created_at: string;
  content_url: string;
}

export default function AfiliadoTikTok() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [posts, setPosts] = useState<TikTokPost[]>([]);
  const [defaultPostMode, setDefaultPostMode] = useState<"direct" | "draft">("draft");
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      // Carregar integração
      const { data: integrationData } = await supabase
        .from("integrations")
        .select("*")
        .eq("user_id", user.id)
        .eq("platform", "tiktok")
        .maybeSingle();

      if (integrationData) {
        const expiresAt = integrationData.token_expires_at ?? null;
        const isExpired = expiresAt ? new Date(expiresAt) < new Date() : true;

        setIsConnected(integrationData.is_active === true && !isExpired);
        setLastUpdated(integrationData.updated_at);
        setTokenExpired(isExpired);
      }

      // Carregar histórico de posts usando função RPC ou query direta com type assertion
      const { data: postsData, error: postsError } = await supabase
        .from("tiktok_posts" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!postsError && postsData) {
        setPosts(postsData as unknown as TikTokPost[]);
      }

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    // Pegar user_id para usar como state
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Você precisa estar logado");
      navigate("/login");
      return;
    }

    const clientKey = "aw2ouo90dyp4ju9w";
    const redirectUri = encodeURIComponent("https://amzofertas.com.br/tiktok/callback");
    const scope = "user.info.basic,user.info.profile,video.upload,video.publish";
    const state = user.id;

    const authUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&response_type=code&scope=${scope}&redirect_uri=${redirectUri}&state=${state}`;

    console.log("🔗 Redirecionando TikTok OAuth:", authUrl);
    window.location.href = authUrl;
  };

  const handleDisconnect = async () => {
    if (!confirm("Tem certeza que deseja desconectar sua conta TikTok?")) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from("integrations")
        .update({ is_active: false })
        .eq("user_id", user.id)
        .eq("platform", "tiktok");

      setIsConnected(false);
      toast.success("TikTok desconectado");
    } catch (error) {
      console.error("Erro ao desconectar:", error);
      toast.error("Erro ao desconectar");
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Salvar nas configurações do usuário via edge function ou localStorage
      localStorage.setItem("tiktok_default_post_mode", defaultPostMode);
      toast.success("Configurações salvas!");
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSavingSettings(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "published":
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Publicado</Badge>;
      case "draft":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Rascunho</Badge>;
      case "failed":
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Falhou</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/afiliado/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
              </svg>
              TikTok
            </h1>
            <p className="text-muted-foreground text-sm">Gerencie sua conexão e posts</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Status da Conexão */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Status da Conexão
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isConnected ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse" />
                    <span className="font-medium text-green-600">Conectado</span>
                  </div>
                  {tokenExpired && (
                    <Badge variant="destructive">Token Expirado</Badge>
                  )}
                </div>
                
                {lastUpdated && (
                  <p className="text-sm text-muted-foreground">
                    Última atualização: {format(new Date(lastUpdated), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}

                <div className="flex gap-2">
                  {tokenExpired ? (
                    <Button onClick={handleConnect}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Reconectar
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={handleDisconnect}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Desconectar
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 bg-gray-400 rounded-full" />
                  <span className="font-medium text-muted-foreground">Desconectado</span>
                </div>
                
                <div className="bg-muted rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium">Conecte sua conta para:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>✅ Postar vídeos diretamente no TikTok</li>
                    <li>✅ Salvar como rascunho para edição</li>
                    <li>✅ Compartilhar produtos e conteúdo da IA</li>
                  </ul>
                </div>

                <Button onClick={handleConnect} size="lg">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Conectar TikTok
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Configurações */}
        {isConnected && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configurações Padrão
              </CardTitle>
              <CardDescription>
                Defina o comportamento padrão ao compartilhar no TikTok
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Modo de Publicação Padrão</Label>
                <RadioGroup value={defaultPostMode} onValueChange={(v) => setDefaultPostMode(v as "direct" | "draft")}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="draft" id="default-draft" />
                    <Label htmlFor="default-draft" className="cursor-pointer">
                      📝 Salvar como Rascunho (recomendado)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="direct" id="default-direct" />
                    <Label htmlFor="direct" className="cursor-pointer">
                      🚀 Publicar Diretamente
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <Button onClick={saveSettings} disabled={savingSettings}>
                {savingSettings ? "Salvando..." : "Salvar Configurações"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Histórico de Posts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Histórico de Posts
            </CardTitle>
            <CardDescription>
              Últimos posts enviados para o TikTok
            </CardDescription>
          </CardHeader>
          <CardContent>
            {posts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Video className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum post enviado ainda</p>
                <p className="text-sm">Compartilhe produtos ou vídeos da IA para ver aqui</p>
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map((post) => (
                  <div 
                    key={post.id} 
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 bg-muted rounded flex items-center justify-center">
                        <Video className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium line-clamp-1">{post.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(post.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(post.status)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
