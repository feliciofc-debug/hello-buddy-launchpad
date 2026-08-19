import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Linkedin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatSaoPauloDateTime } from '@/lib/sao-paulo-time';
import LinkedInComposer from '@/components/produtos/LinkedInComposer';
import LinkedInProdutosGrid from '@/components/produtos/LinkedInProdutosGrid';

interface LinkedInConn {
  id: string;
  nome: string | null;
  is_active: boolean | null;
  token_expires_at: string | null;
}

interface HistoricoItem {
  id: string;
  post_text: string | null;
  post_text_linkedin: string | null;
  image_url: string | null;
  video_url: string | null;
  status: string | null;
  created_at: string | null;
}

export default function LinkedInTab() {
  const [loading, setLoading] = useState(true);
  const [conn, setConn] = useState<LinkedInConn | null>(null);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [subAba, setSubAba] = useState<'fotos' | 'videos' | 'produtos'>('fotos');

  const conectado = Boolean(conn && conn.is_active);

  useEffect(() => {
    void carregar();
  }, []);

  const carregar = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: c }, { data: h }] = await Promise.all([
        supabase.from('linkedin_connections').select('*').eq('user_id', user.id).maybeSingle(),
        supabase
          .from('social_posts_queue')
          .select('*')
          .eq('user_id', user.id)
          .eq('platform', 'linkedin')
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      setConn((c as LinkedInConn) || null);
      setHistorico((h as HistoricoItem[]) || []);
    } catch (err) {
      console.error('LinkedInTab carregar:', err);
    } finally {
      setLoading(false);
    }
  };

  const carregarHistorico = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('social_posts_queue')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'linkedin')
      .order('created_at', { ascending: false })
      .limit(20);
    setHistorico((data as HistoricoItem[]) || []);
  };

  const conectarLinkedIn = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-oauth-start', {
        body: { redirect_to: '/meus-produtos' },
      });
      if (error) throw error;
      if (!data?.auth_url) throw new Error(data?.error || 'Não foi possível iniciar a conexão');
      window.location.href = data.auth_url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao conectar LinkedIn');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const historicoFiltrado = historico.filter((item) =>
    subAba === 'fotos' ? Boolean(item.image_url) : Boolean(item.video_url),
  );

  return (
    <div className="space-y-6">
      {/* Conexão */}
      {!conectado ? (
        <Card>
          <CardContent className="py-10 flex flex-col items-center gap-4 text-center">
            <Linkedin className="h-10 w-10 text-primary" />
            <p className="text-sm text-muted-foreground">Conecte sua conta do LinkedIn para publicar</p>
            <Button onClick={conectarLinkedIn}>Conectar LinkedIn</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-4 flex flex-wrap items-center gap-3">
            <Linkedin className="h-5 w-5 text-primary" />
            <Badge className="bg-green-600 hover:bg-green-600 text-white">Conectado</Badge>
            <span className="text-sm font-medium">{conn?.nome || 'Perfil LinkedIn'}</span>
            {conn?.token_expires_at && (
              <span className="text-xs text-muted-foreground">
                Token válido até {formatSaoPauloDateTime(conn.token_expires_at)}
              </span>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sub-abas Fotos / Vídeos / Produtos */}
      <Tabs value={subAba} onValueChange={(v) => setSubAba(v as 'fotos' | 'videos' | 'produtos')}>
        <TabsList>
          <TabsTrigger value="fotos">Fotos</TabsTrigger>
          <TabsTrigger value="videos">Vídeos</TabsTrigger>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
        </TabsList>

        <TabsContent value="fotos" className="mt-4">
          <LinkedInComposer midia="foto" conectado={conectado} onPublicado={carregarHistorico} />
        </TabsContent>

        <TabsContent value="videos" className="mt-4">
          <LinkedInComposer midia="video" conectado={conectado} onPublicado={carregarHistorico} />
        </TabsContent>

        <TabsContent value="produtos" className="mt-4">
          <LinkedInProdutosGrid />
        </TabsContent>
      </Tabs>


      {/* Histórico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Histórico — {subAba === 'fotos' ? 'Fotos' : 'Vídeos'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {historicoFiltrado.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum post publicado ainda.</p>
          ) : (
            historicoFiltrado.map((item) => {
              const txt = item.post_text_linkedin || item.post_text || '';
              return (
                <div key={item.id} className="flex items-start gap-3 border-b pb-3 last:border-0 last:pb-0">
                  {item.image_url ? (
                    <img src={item.image_url} alt="Miniatura do post" className="h-12 w-12 rounded object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                      <Linkedin className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm line-clamp-2">{txt.slice(0, 90)}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.created_at ? formatSaoPauloDateTime(item.created_at) : ''}
                    </p>
                  </div>
                  <Badge variant={item.status === 'erro' ? 'destructive' : 'secondary'}>{item.status}</Badge>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
