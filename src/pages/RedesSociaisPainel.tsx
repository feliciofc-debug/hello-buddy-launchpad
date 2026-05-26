import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatSaoPauloDateTime, toSaoPauloDateKey } from "@/lib/sao-paulo-time";
import {
  Facebook, Instagram, ArrowLeft, CheckCircle, XCircle, Clock,
  RefreshCw, Loader2, AlertTriangle, CalendarDays, Pencil, Trash2
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { TikTokIcon } from "@/components/tiktok/TikTokIcon";
import { CancelarAgendamentoDialog } from "@/components/social/CancelarAgendamentoDialog";
import { EditarAgendamentoModal } from "@/components/social/EditarAgendamentoModal";
import { VideosAgendadosLista } from "@/components/VideosAgendadosLista";

export default function RedesSociaisPainel() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, publicados: 0, hoje: 0, pendentes: 0, erros: 0 });
  const [metaConn, setMetaConn] = useState<any>(null);
  const [tiktokConn, setTiktokConn] = useState<any>(null);
  const showTikTok = useFeatureFlag('tiktok_integration');
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<any | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: connData } = await supabase
        .from("meta_connections" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      setMetaConn(connData);

      // TikTok connection
      const { data: tiktokData } = await supabase
        .from("integrations" as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("platform", "tiktok")
        .maybeSingle();
      setTiktokConn(tiktokData);

      const { data: postsData } = await supabase
        .from("social_posts_queue" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      const allPosts = (postsData || []) as any[];
      setPosts(allPosts);

      const today = toSaoPauloDateKey();
      setStats({
        total: allPosts.length,
        publicados: allPosts.filter((p: any) => p.status === "publicado").length,
        hoje: allPosts.filter((p: any) => p.status === "publicado" && p.published_at && toSaoPauloDateKey(p.published_at) === today).length,
        pendentes: allPosts.filter((p: any) => p.status === "pendente").length,
        erros: allPosts.filter((p: any) => p.status === "erro").length,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
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
        <p className="text-muted-foreground">Métricas e histórico de publicações</p>
      </div>

      {/* Status das conexões — somente leitura */}
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
              <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" /> Conectado</Badge>
            ) : (
              <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" /> Desconectado</Badge>
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
              <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" /> Conectado</Badge>
            ) : (
              <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" /> Desconectado</Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-full bg-muted">
              <TikTokIcon className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">TikTok</p>
              <p className="text-sm text-muted-foreground">
                {showTikTok
                  ? (tiktokConn ? "Conta conectada" : "Não conectado")
                  : "Em breve"}
              </p>
            </div>
            {showTikTok ? (
              tiktokConn ? (
                <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" /> Conectado</Badge>
              ) : (
                <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" /> Desconectado</Badge>
              )
            ) : (
              <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Pendente</Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Aviso se não conectado — link para configurações */}
      {!facebookConnected && !instagramConnected && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-700">
          <CardContent className="p-4 text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <p className="text-sm font-medium text-foreground">
                Nenhuma conta conectada
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Conecte sua conta do Facebook/Instagram em{" "}
              <Link to="/configuracoes" className="text-primary underline font-medium">
                Configurações → Meta
              </Link>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Total de posts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.hoje}</p>
            <p className="text-sm text-muted-foreground">Publicados hoje</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{stats.pendentes}</p>
            <p className="text-sm text-muted-foreground">Agendados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.erros}</p>
            <p className="text-sm text-muted-foreground">Com erro</p>
          </CardContent>
        </Card>
      </div>

      {/* Botão recarregar */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={loadData} size="sm">
          <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
        </Button>
      </div>

      {/* Tabs de histórico */}
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
                          {post.published_at ? ` • ${formatSaoPauloDateTime(post.published_at, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}
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
                          {post.scheduled_at ? ` • Agendado ${formatSaoPauloDateTime(post.scheduled_at, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : " • Aguardando"}
                        </p>
                      </div>
                      <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Agendado</Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditTarget(post)}
                        title="Editar agendamento"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setCancelTarget(post.id)}
                        title="Cancelar agendamento"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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

      <CancelarAgendamentoDialog
        open={!!cancelTarget}
        onOpenChange={(o) => { if (!o) setCancelTarget(null); }}
        postId={cancelTarget}
        onSuccess={loadData}
      />

      <EditarAgendamentoModal
        open={!!editTarget}
        onOpenChange={(o) => { if (!o) setEditTarget(null); }}
        post={editTarget}
        onSuccess={loadData}
      />
    </div>
  );
}
