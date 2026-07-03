import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Image as ImageIcon,
  Video,
  Mic,
  Send,
  RefreshCw,
  Eye,
  Heart,
  MessageSquare,
  Sparkles,
  Loader2,
  Trash2,
} from 'lucide-react';

type Midia = {
  id: string;
  tipo: 'foto' | 'video' | 'audio';
  midia_url: string;
  thumbnail_url: string | null;
  contexto_original: string | null;
  legenda_gerada: string | null;
  hashtags: string[] | null;
  status: string;
  plataformas: string[] | null;
  post_urls: Record<string, string> | null;
  posted_at: string | null;
  views: number;
  likes: number;
  comments: number;
  reusos: number;
  created_at: string;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400' },
  aguardando_confirmacao: { label: 'Aguardando', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  publicado: { label: 'Publicado', color: 'bg-green-500/10 text-green-700 dark:text-green-400' },
  erro: { label: 'Erro', color: 'bg-red-500/10 text-red-700 dark:text-red-400' },
  arquivado: { label: 'Arquivado', color: 'bg-gray-500/10 text-gray-700 dark:text-gray-400' },
};

const TIPO_ICONS = {
  foto: ImageIcon,
  video: Video,
  audio: Mic,
};

export default function Midias() {
  const navigate = useNavigate();
  const [midias, setMidias] = useState<Midia[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [publicandoId, setPublicandoId] = useState<string | null>(null);

  useEffect(() => {
    carregar();
  }, []);

  const carregar = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/login');
      return;
    }
    const { data, error } = await supabase
      .from('midias_whatsapp')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      toast.error('Erro ao carregar mídias');
      console.error(error);
    } else {
      setMidias((data as any) || []);
    }
    setLoading(false);
  };

  const publicar = async (m: Midia) => {
    setPublicandoId(m.id);
    try {
      const { data, error } = await supabase.functions.invoke('publicar-midia-social', {
        body: { midia_id: m.id },
      });
      if (error || !data?.success) {
        toast.error(data?.error || 'Erro ao publicar');
      } else {
        toast.success('Publicado nas redes!');
        carregar();
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro');
    } finally {
      setPublicandoId(null);
    }
  };

  const repostar = async (m: Midia) => {
    setPublicandoId(m.id);
    try {
      const { data, error } = await supabase.functions.invoke('publicar-midia-social', {
        body: { midia_id: m.id, repostar: true },
      });
      if (error || !data?.success) {
        toast.error(data?.error || 'Erro ao repostar');
      } else {
        toast.success('Repostado!');
        carregar();
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro');
    } finally {
      setPublicandoId(null);
    }
  };

  const arquivar = async (m: Midia) => {
    const { error } = await supabase
      .from('midias_whatsapp')
      .update({ status: 'arquivado' })
      .eq('id', m.id);
    if (error) toast.error('Erro ao arquivar');
    else {
      toast.success('Arquivado');
      carregar();
    }
  };

  const filtradas = midias.filter((m) => {
    if (filtroTipo !== 'todos' && m.tipo !== filtroTipo) return false;
    if (filtroStatus !== 'todos' && m.status !== filtroStatus) return false;
    return true;
  });

  const stats = {
    total: midias.length,
    publicadas: midias.filter((m) => m.status === 'publicado').length,
    pendentes: midias.filter((m) => m.status === 'pendente' || m.status === 'aguardando_confirmacao').length,
    views: midias.reduce((a, m) => a + (m.views || 0), 0),
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ImageIcon className="h-6 w-6 text-primary" />
              Mídias
            </h1>
            <p className="text-sm text-muted-foreground">
              Fotos, vídeos e áudios enviados pelo WhatsApp — prontos pra postar e reusar
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={carregar}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Publicadas</div>
            <div className="text-2xl font-bold text-green-600">{stats.publicadas}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Pendentes</div>
            <div className="text-2xl font-bold text-yellow-600">{stats.pendentes}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Views totais</div>
            <div className="text-2xl font-bold text-primary">{stats.views}</div>
          </Card>
        </div>

        {/* Como usar */}
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold mb-1">Como funciona</p>
              <p className="text-muted-foreground">
                Mande <b>foto, vídeo ou áudio</b> no WhatsApp do Pietro contando o que rolou.
                A IA gera legenda + hashtags, salva aqui e publica nas suas redes conectadas.
                Tudo fica na biblioteca pra você <b>repostar</b> quando quiser.
              </p>
            </div>
          </div>
        </Card>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3">
          <Tabs value={filtroTipo} onValueChange={setFiltroTipo}>
            <TabsList>
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="foto"><ImageIcon className="h-4 w-4 mr-1" />Fotos</TabsTrigger>
              <TabsTrigger value="video"><Video className="h-4 w-4 mr-1" />Vídeos</TabsTrigger>
              <TabsTrigger value="audio"><Mic className="h-4 w-4 mr-1" />Áudios</TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs value={filtroStatus} onValueChange={setFiltroStatus}>
            <TabsList>
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="pendente">Pendentes</TabsTrigger>
              <TabsTrigger value="publicado">Publicados</TabsTrigger>
              <TabsTrigger value="arquivado">Arquivados</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          </div>
        ) : filtradas.length === 0 ? (
          <Card className="p-12 text-center">
            <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="font-semibold">Nenhuma mídia ainda</p>
            <p className="text-sm text-muted-foreground mt-1">
              Mande uma foto ou vídeo no WhatsApp do Pietro pra começar
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtradas.map((m) => {
              const Icon = TIPO_ICONS[m.tipo] || ImageIcon;
              const statusInfo = STATUS_LABELS[m.status] || STATUS_LABELS.pendente;
              const isPublicado = m.status === 'publicado';
              return (
                <Card key={m.id} className="overflow-hidden flex flex-col">
                  <div className="relative aspect-square bg-muted">
                    {m.tipo === 'foto' && m.midia_url && (
                      <img src={m.midia_url} alt="" className="w-full h-full object-cover" />
                    )}
                    {m.tipo === 'video' && (
                      <video src={m.midia_url} controls className="w-full h-full object-cover" poster={m.thumbnail_url || undefined} />
                    )}
                    {m.tipo === 'audio' && (
                      <div className="w-full h-full flex flex-col items-center justify-center p-4">
                        <Mic className="h-12 w-12 text-primary mb-3" />
                        <audio src={m.midia_url} controls className="w-full" />
                      </div>
                    )}
                    <Badge className={`absolute top-2 left-2 ${statusInfo.color}`}>
                      <Icon className="h-3 w-3 mr-1" />
                      {statusInfo.label}
                    </Badge>
                    {m.reusos > 0 && (
                      <Badge className="absolute top-2 right-2 bg-primary/90 text-primary-foreground">
                        {m.reusos}x reusado
                      </Badge>
                    )}
                  </div>

                  <div className="p-3 flex-1 flex flex-col gap-2">
                    {m.contexto_original && (
                      <p className="text-xs text-muted-foreground italic line-clamp-2">
                        "{m.contexto_original}"
                      </p>
                    )}
                    {m.legenda_gerada && (
                      <p className="text-sm line-clamp-3">{m.legenda_gerada}</p>
                    )}
                    {m.hashtags && m.hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {m.hashtags.slice(0, 4).map((h, i) => (
                          <span key={i} className="text-xs text-primary">#{h.replace(/^#/, '')}</span>
                        ))}
                      </div>
                    )}

                    {isPublicado && (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                        <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{m.views}</span>
                        <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{m.likes}</span>
                        <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{m.comments}</span>
                      </div>
                    )}

                    {m.plataformas && m.plataformas.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {m.plataformas.map((p) => (
                          <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2 pt-2 mt-auto">
                      {isPublicado ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => repostar(m)}
                          disabled={publicandoId === m.id}
                        >
                          {publicandoId === m.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <><RefreshCw className="h-4 w-4 mr-1" /> Repostar</>
                          )}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => publicar(m)}
                          disabled={publicandoId === m.id || m.status === 'arquivado'}
                        >
                          {publicandoId === m.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <><Send className="h-4 w-4 mr-1" /> Publicar</>
                          )}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => arquivar(m)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
