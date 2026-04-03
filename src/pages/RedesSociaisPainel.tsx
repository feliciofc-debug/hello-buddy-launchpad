import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  Facebook, Instagram, ArrowLeft, CheckCircle, XCircle, Clock,
  RefreshCw, Loader2, LinkIcon
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export default function RedesSociaisPainel() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, publicados: 0, pendentes: 0, erros: 0 });
  const [metaConn, setMetaConn] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Carregar conexão Meta do cliente
      const { data: connData } = await supabase
        .from("meta_connections" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      setMetaConn(connData);

      const { data: postsData } = await supabase
        .from("social_posts_queue" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      const allPosts = (postsData || []) as any[];
      setPosts(allPosts);

      setStats({
        total: allPosts.length,
        publicados: allPosts.filter((p: any) => p.status === "publicado").length,
        pendentes: allPosts.filter((p: any) => p.status === "pendente").length,
        erros: allPosts.filter((p: any) => p.status === "erro").length,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectMeta = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Você precisa estar logado para conectar.");
      return;
    }
    const authUrl = `https://www.facebook.com/v25.0/dialog/oauth?client_id=1254152493364240&redirect_uri=${encodeURIComponent('https://www.amzofertas.com.br/auth/callback/meta')}&scope=pages_show_list,pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish&response_type=code&state=${user.id}`;
    window.location.href = authUrl;
  };

  const facebookConnected = !!metaConn?.page_id;
  const instagramConnected = !!metaConn?.ig_account_id;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <Button onClick={() => navigate("/dashboard")} variant="ghost" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Redes Sociais</h1>
        <p className="text-muted-foreground">Gerencie suas conexões e veja o histórico de publicações</p>
      </div>

      {/* Status das conexões */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
              <Facebook className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Facebook</p>
              <p className="text-sm text-muted-foreground">
                {facebookConnected ? metaConn?.page_name || "Página conectada" : "Não conectado"}
              </p>
            </div>
            {facebookConnected ? (
              <Badge variant="default">
                <CheckCircle className="h-3 w-3 mr-1" /> Conectado
              </Badge>
            ) : (
              <Button size="sm" variant="outline" onClick={handleConnectMeta}>
                <LinkIcon className="h-3 w-3 mr-1" /> Conectar
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-pink-100 dark:bg-pink-900/30">
              <Instagram className="h-6 w-6 text-pink-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Instagram</p>
              <p className="text-sm text-muted-foreground">
                {instagramConnected ? `@${metaConn?.ig_username || "conectado"}` : "Não conectado"}
              </p>
            </div>
            {instagramConnected ? (
              <Badge variant="default">
                <CheckCircle className="h-3 w-3 mr-1" /> Conectado
              </Badge>
            ) : (
              <Button size="sm" variant="outline" onClick={handleConnectMeta}>
                <LinkIcon className="h-3 w-3 mr-1" /> Conectar
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-muted">
              <svg className="h-6 w-6 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.88-2.88 2.89 2.89 0 012.88-2.88c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.3a6.34 6.34 0 0010.86 4.46 6.34 6.34 0 001.83-4.46V8.76a8.26 8.26 0 004.79 1.52V6.84a4.85 4.85 0 01-1.04-.15z"/>
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">TikTok</p>
              <p className="text-sm text-muted-foreground">Em breve</p>
            </div>
            <Badge variant="secondary">
              <Clock className="h-3 w-3 mr-1" /> Pendente
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Aviso se não conectado */}
      {!facebookConnected && !instagramConnected && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-700">
          <CardContent className="p-4 text-center space-y-3">
            <p className="text-sm font-medium text-foreground">
              ⚠️ Você ainda não conectou sua conta do Facebook/Instagram
            </p>
            <p className="text-xs text-muted-foreground">
              Conecte sua conta para publicar posts diretamente na sua página.
            </p>
            <Button onClick={handleConnectMeta} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Facebook className="h-4 w-4 mr-2" /> Conectar Facebook & Instagram
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{stats.total}</p><p className="text-sm text-muted-foreground">Total de posts</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">{stats.publicados}</p><p className="text-sm text-muted-foreground">Publicados</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-yellow-600">{stats.pendentes}</p><p className="text-sm text-muted-foreground">Agendados</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-red-600">{stats.erros}</p><p className="text-sm text-muted-foreground">Com erro</p></CardContent></Card>
      </div>

      {/* Botão recarregar */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={loadData} size="sm">
          <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="publicados">
        <TabsList>
          <TabsTrigger value="publicados">Publicados</TabsTrigger>
          <TabsTrigger value="agendados">Agendados</TabsTrigger>
          <TabsTrigger value="erros">Com Erro</TabsTrigger>
        </TabsList>

        <TabsContent value="publicados">
          <Card>
            <CardContent className="p-4">
              {posts.filter((p: any) => p.status === "publicado").length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum post publicado ainda</p>
              ) : (
                <div className="space-y-3">
                  {posts.filter((p: any) => p.status === "publicado").slice(0, 20).map((post: any) => (
                    <div key={post.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      {post.image_url && (
                        <img src={post.image_url} alt="" className="w-12 h-12 rounded object-cover" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{post.post_text?.substring(0, 80)}...</p>
                        <p className="text-xs text-muted-foreground">
                          {post.platform === "facebook" ? "📘 Facebook" : "📸 Instagram"}
                          {post.published_at ? ` • Publicado ${format(new Date(post.published_at), "dd/MM HH:mm", { locale: ptBR })}` : ""}
                        </p>
                      </div>
                      <Badge variant="default">Publicado</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agendados">
          <Card>
            <CardContent className="p-4">
              {posts.filter((p: any) => p.status === "pendente").length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum post agendado</p>
              ) : (
                <div className="space-y-3">
                  {posts.filter((p: any) => p.status === "pendente").map((post: any) => (
                    <div key={post.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      {post.image_url && (
                        <img src={post.image_url} alt="" className="w-12 h-12 rounded object-cover" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{post.post_text?.substring(0, 80)}...</p>
                        <p className="text-xs text-muted-foreground">
                          {post.platform === "facebook" ? "📘 Facebook" : "📸 Instagram"}
                          {post.scheduled_at ? ` • Agendado ${format(new Date(post.scheduled_at), "dd/MM HH:mm", { locale: ptBR })}` : " • Aguardando"}
                        </p>
                      </div>
                      <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Agendado</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="erros">
          <Card>
            <CardContent className="p-4">
              {posts.filter((p: any) => p.status === "erro").length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum erro registrado 🎉</p>
              ) : (
                <div className="space-y-3">
                  {posts.filter((p: any) => p.status === "erro").map((post: any) => (
                    <div key={post.id} className="flex items-center gap-3 p-3 border rounded-lg border-destructive/30">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{post.post_text?.substring(0, 80)}...</p>
                        <p className="text-xs text-destructive">{post.error_message || "Erro desconhecido"}</p>
                      </div>
                      <Badge variant="destructive">Erro</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
