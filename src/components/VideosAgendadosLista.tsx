import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Calendar, Clock, Trash2, Video, BookOpen, Loader2, CheckCircle2, XCircle, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface VideoAgendado {
  id: string;
  tipo: string;
  video_nome: string | null;
  video_url: string | null;
  caption: string | null;
  canais: string[];
  scheduled_for: string;
  status: string;
  erro: string | null;
  published_at: string | null;
  created_at: string;
}

export function VideosAgendadosLista() {
  const [items, setItems] = useState<VideoAgendado[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data, error } = await supabase
      .from('videos_agendados')
      .select('*')
      .eq('user_id', user.id)
      .order('scheduled_for', { ascending: false })
      .limit(50);
    if (error) {
      toast.error('Erro ao carregar agendamentos');
    } else {
      setItems((data as any) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, []);

  const cancelar = async (id: string) => {
    if (!confirm('Cancelar este agendamento?')) return;
    const { error } = await supabase
      .from('videos_agendados')
      .delete()
      .eq('id', id);
    if (error) {
      toast.error('Erro ao cancelar');
    } else {
      toast.success('Agendamento cancelado');
      setItems((prev) => prev.filter((i) => i.id !== id));
    }
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case 'pendente':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Pendente</Badge>;
      case 'processando':
        return <Badge className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Processando</Badge>;
      case 'publicado':
        return <Badge className="bg-green-600 text-white gap-1"><CheckCircle2 className="h-3 w-3" /> Publicado</Badge>;
      case 'erro':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Erro</Badge>;
      case 'cancelado':
        return <Badge variant="outline">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{s}</Badge>;
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (items.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Calendar className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Nenhum Reels ou Story agendado.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Card key={item.id} className="p-4">
          <div className="flex items-start gap-3">
            {/* Preview do conteúdo */}
            {item.video_url ? (
              item.tipo === 'story_imagem' ? (
                <img
                  src={item.video_url}
                  alt={item.video_nome || 'Preview'}
                  className="w-20 h-20 rounded-md object-cover bg-muted flex-shrink-0 border"
                  loading="lazy"
                />
              ) : (
                <video
                  src={item.video_url}
                  className="w-20 h-20 rounded-md object-cover bg-black flex-shrink-0 border"
                  muted
                  preload="metadata"
                  playsInline
                />
              )
            ) : (
              <div className="w-20 h-20 rounded-md bg-muted flex items-center justify-center flex-shrink-0 border">
                {item.tipo === 'story_imagem' ? <ImageIcon className="h-6 w-6 text-muted-foreground" /> : <Video className="h-6 w-6 text-muted-foreground" />}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {item.tipo === 'reels' ? <Video className="h-4 w-4" /> : item.tipo === 'story_imagem' ? <ImageIcon className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                <span className="font-medium text-sm capitalize">{item.tipo === 'story_imagem' ? 'Story Foto' : item.tipo}</span>
                {statusBadge(item.status)}
              </div>
              {item.video_nome && (
                <p className="text-xs text-muted-foreground truncate" title={item.video_nome}>{item.video_nome}</p>
              )}
              {item.caption && (
                <p className="text-xs text-foreground/80 mt-1 line-clamp-2" title={item.caption}>{item.caption}</p>
              )}
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {format(new Date(item.scheduled_for), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
              </div>
              <div className="flex gap-1 mt-2 flex-wrap">
                {item.canais.map((c) => (
                  <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
                ))}
              </div>
              {item.erro && (
                <p className="text-xs text-destructive mt-2">⚠️ {item.erro}</p>
              )}
            </div>
            {(item.status === 'pendente' || item.status === 'erro') && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => cancelar(item.id)}
                title="Cancelar agendamento"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </Card>

      ))}
    </div>
  );
}
