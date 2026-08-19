import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Linkedin, Loader2, CheckCircle, XCircle, RefreshCw, Send } from "lucide-react";
import { formatSaoPauloDateTime } from "@/lib/sao-paulo-time";

export default function LinkedInPainel() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [conn, setConn] = useState<any>(null);
  const [historico, setHistorico] = useState<any[]>([]);
  const [conectando, setConectando] = useState(false);
  const [publicando, setPublicando] = useState(false);

  const [texto, setTexto] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [comentario, setComentario] = useState("");
  const [linkNoComentario, setLinkNoComentario] = useState(true);

  useEffect(() => {
    const status = searchParams.get("linkedin");
    if (status === "conectado") toast.success("LinkedIn conectado com sucesso!");
    if (status === "erro") toast.error(`Falha ao conectar o LinkedIn: ${searchParams.get("motivo") || "erro"}`);
    if (status) {
      searchParams.delete("linkedin");
      searchParams.delete("motivo");
      setSearchParams(searchParams, { replace: true });
    }
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const carregar = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: connData } = await supabase
        .from("linkedin_connections" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      setConn(connData);

      const { data: posts } = await supabase
        .from("social_posts_queue" as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("platform", "linkedin")
        .order("created_at", { ascending: false })
        .limit(30);
      setHistorico((posts || []) as any[]);
    } finally {
      setLoading(false);
    }
  };

  const conectar = async () => {
    setConectando(true);
    try {
      const { data, error } = await supabase.functions.invoke("linkedin-oauth-start", {
        body: { redirect_to: "/linkedin" },
      });
      if (error) throw error;
      if (!data?.auth_url) throw new Error(data?.error || "Não foi possível iniciar a conexão");
      window.location.href = data.auth_url;
    } catch (err: any) {
      toast.error(err?.message || "Erro ao iniciar conexão com o LinkedIn");
      setConectando(false);
    }
  };

  const desconectar = async () => {
    if (!window.confirm("Desconectar a conta do LinkedIn?")) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("linkedin_connections" as any).delete().eq("user_id", user.id);
    if (error) return toast.error("Erro ao desconectar");
    setConn(null);
    toast.success("Conta do LinkedIn desconectada");
  };

  const publicar = async () => {
    if (!texto.trim()) return toast.error("Escreva o texto do post");
    setPublicando(true);
    try {
      const { data, error } = await supabase.functions.invoke("linkedin-publish", {
        body: {
          texto,
          image_url: imageUrl || undefined,
          link_url: linkUrl || undefined,
          comentario: comentario || undefined,
          link_no_primeiro_comentario: linkNoComentario,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha na publicação");

      if (data.link_no_corpo) {
        toast.success("Publicado no LinkedIn com o link no fim do post");
      } else {
        toast.success("Publicado no LinkedIn");
      }


      setTexto(""); setImageUrl(""); setLinkUrl(""); setComentario("");
      carregar();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao publicar");
    } finally {
      setPublicando(false);
    }
  };

  const preencherComentarioSugerido = () => {
    const link = linkUrl.trim();
    setComentario(link ? `Deixo o link aqui para quem quiser ver os detalhes: ${link}` : "");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <Button onClick={() => navigate("/dashboard")} variant="ghost" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Linkedin className="h-6 w-6 text-[#0A66C2]" /> LinkedIn
        </h1>
        <p className="text-muted-foreground">Publique no seu perfil pessoal com o link no fim do post</p>
      </div>

      {/* Conexão */}
      <Card>
        <CardContent className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-full bg-[#0A66C2]/10">
            <Linkedin className="h-6 w-6 text-[#0A66C2]" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">{conn?.nome || "Perfil pessoal"}</p>
            <p className="text-sm text-muted-foreground">
              {conn ? "Conta conectada" : "Nenhuma conta conectada"}
              {conn?.token_expires_at ? ` • token válido até ${formatSaoPauloDateTime(conn.token_expires_at, { day: "2-digit", month: "2-digit", year: "numeric" })}` : ""}
            </p>
          </div>
          {conn ? (
            <div className="flex items-center gap-2">
              <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" /> Conectado</Badge>
              <Button size="sm" variant="outline" onClick={conectar} disabled={conectando}>
                <RefreshCw className="h-4 w-4 mr-1" /> Reconectar
              </Button>
              <Button size="sm" variant="destructive" onClick={desconectar}>Desconectar</Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" /> Desconectado</Badge>
              <Button size="sm" onClick={conectar} disabled={conectando}>
                {conectando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Conectar LinkedIn
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {conn?.alert_status === "reconectar" && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-700">
          <CardContent className="p-4 text-sm text-foreground">
            O acesso ao LinkedIn precisa ser renovado. Clique em <strong>Reconectar</strong> para continuar publicando.
          </CardContent>
        </Card>
      )}

      {/* Compositor */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Novo post</CardTitle>
          <CardDescription>Tom profissional, sem emojis em excesso. Estrutura: observação, um argumento técnico, fecho sem convite, link e 2-3 hashtags. O link entra no fim do post — assim que a permissão de parceiro do LinkedIn for aprovada, ele volta para o primeiro comentário automaticamente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="li-texto">Texto do post</Label>
            <Textarea
              id="li-texto"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={8}
              placeholder="Escreva o conteúdo do post…"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="li-img">URL da imagem (opcional)</Label>
              <Input id="li-img" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="li-link">Link (opcional)</Label>
              <Input id="li-link" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Tentar link no primeiro comentário</p>
              <p className="text-xs text-muted-foreground">Hoje o LinkedIn ainda não libera comentários para o app, então o link entra no fim do post. Deixe ligado: quando a permissão de parceiro sair, ele volta para o comentário sozinho.</p>
            </div>
            <Switch checked={linkNoComentario} onCheckedChange={setLinkNoComentario} />
          </div>

          {linkNoComentario && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="li-coment">Comentário sugerido</Label>
                <Button type="button" size="sm" variant="ghost" onClick={preencherComentarioSugerido}>
                  Sugerir texto
                </Button>
              </div>
              <Input id="li-coment" value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Link: https://…" />
            </div>
          )}

          <Button onClick={publicar} disabled={publicando || !conn} className="w-full">
            {publicando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Publicar no LinkedIn
          </Button>
          {!conn && <p className="text-xs text-muted-foreground text-center">Conecte sua conta para publicar.</p>}
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {historico.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum post no LinkedIn ainda</p>
          ) : (
            <div className="space-y-3">
              {historico.map((post) => (
                <div key={post.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  {post.image_url && <img src={post.image_url} alt="" className="w-12 h-12 rounded object-cover" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {(post.post_text_linkedin || post.post_text || "").substring(0, 90)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {post.published_at
                        ? formatSaoPauloDateTime(post.published_at, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                        : post.scheduled_at
                          ? `Agendado ${formatSaoPauloDateTime(post.scheduled_at, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
                          : "Aguardando"}
                    </p>
                    {post.error_message && <p className="text-xs text-destructive">{post.error_message}</p>}
                  </div>
                  <Badge variant={post.status === "publicado" ? "default" : post.status === "erro" ? "destructive" : "secondary"}>
                    {post.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
