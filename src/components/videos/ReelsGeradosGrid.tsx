import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Download, Rocket, Trash2, Film, Facebook, Instagram } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ReelGerado {
  id: string;
  produto_id: string | null;
  video_url: string;
  thumbnail_url: string | null;
  titulo: string | null;
  criado_em: string;
  publicado_facebook: boolean;
  publicado_instagram: boolean;
  produtos: { nome: string; imagem_url: string | null } | null;
}

const extrairPath = (url: string): string | null => {
  const match = url.match(/produto-videos\/(.+)$/);
  return match ? match[1] : null;
};

export const ReelsGeradosGrid = () => {
  const [reels, setReels] = useState<ReelGerado[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  useEffect(() => {
    loadReels();
  }, []);

  const loadReels = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('produto_videos' as any)
        .select('*, produtos(nome, imagem_url)')
        .eq('user_id', user.id)
        .order('criado_em', { ascending: false });

      if (error) {
        console.error('[REELS] Erro ao carregar:', error);
        toast.error('Erro ao carregar seus Reels');
      }

      setReels((data as any) || []);
    } finally {
      setLoading(false);
    }
  };

  const handleVer = (url: string) => setPlayingUrl(url);

  const handleBaixar = (url: string, nome: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${nome || 'reel'}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePublicar = () => {
    toast.info('Publicação em construção — Etapa 3C');
  };

  const handleExcluir = async (reel: ReelGerado) => {
    if (!confirm('Excluir este Reel?')) return;

    try {
      const videoPath = extrairPath(reel.video_url);
      const thumbPath = reel.thumbnail_url ? extrairPath(reel.thumbnail_url) : null;
      const paths = [videoPath, thumbPath].filter(Boolean) as string[];

      if (paths.length) {
        const { error: storageErr } = await supabase.storage
          .from('produto-videos')
          .remove(paths);
        if (storageErr) {
          console.error('[REELS] Erro ao remover storage (segue assim mesmo):', storageErr);
        }
      }

      const { error: dbErr } = await supabase
        .from('produto_videos' as any)
        .delete()
        .eq('id', reel.id);

      if (dbErr) throw dbErr;

      toast.success('Reel excluído');
      loadReels();
    } catch (err: any) {
      console.error('Erro ao excluir reel:', err);
      toast.error('Erro ao excluir. Tente novamente.');
    }
  };

  if (loading) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <Film className="h-5 w-5" /> Meus Reels Gerados
      </h2>

      {reels.length === 0 ? (
        <Card className="border-dashed border-2 border-muted-foreground/30">
          <CardContent className="p-8 text-center text-muted-foreground">
            <Film className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Você ainda não gerou nenhum Reel.</p>
            <p className="text-sm mt-1">
              Volte na aba Produtos, escolha as fotos e clique em 🎬 Gerar Reel
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reels.map((reel) => {
            const nomeExibido = reel.titulo || reel.produtos?.nome || 'Reel sem título';
            const thumb = reel.thumbnail_url || reel.produtos?.imagem_url || null;
            const recente =
              new Date(reel.criado_em).getTime() > Date.now() - 24 * 60 * 60 * 1000;
            const naoPublicado =
              !reel.publicado_facebook && !reel.publicado_instagram;

            return (
              <Card key={reel.id} className="overflow-hidden">
                <div
                  className="relative aspect-[9/16] max-h-[300px] bg-black cursor-pointer group"
                  onClick={() => handleVer(reel.video_url)}
                >
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={nomeExibido}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Film className="h-12 w-12 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition">
                    <Play className="h-12 w-12 text-white" />
                  </div>
                </div>
                <CardContent className="p-4 space-y-3">
                  <p className="font-medium text-sm truncate" title={nomeExibido}>
                    {nomeExibido}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(reel.criado_em), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                  <div className="flex gap-1 flex-wrap">
                    {recente && naoPublicado && (
                      <Badge className="bg-amber-500 text-white text-xs">🆕 Recém-gerado</Badge>
                    )}
                    {reel.publicado_instagram && (
                      <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs gap-1">
                        <Instagram className="h-3 w-3" /> Publicado
                      </Badge>
                    )}
                    {reel.publicado_facebook && (
                      <Badge className="bg-blue-500 text-white text-xs gap-1">
                        <Facebook className="h-3 w-3" /> Publicado
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => handleVer(reel.video_url)}
                    >
                      <Play className="mr-1 h-3 w-3" /> Ver
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => handleBaixar(reel.video_url, nomeExibido)}
                    >
                      <Download className="mr-1 h-3 w-3" /> Baixar
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                      onClick={handlePublicar}
                    >
                      <Rocket className="mr-1 h-3 w-3" /> Publicar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="text-xs"
                      onClick={() => handleExcluir(reel)}
                    >
                      <Trash2 className="mr-1 h-3 w-3" /> Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {playingUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPlayingUrl(null)}
        >
          <div
            className="relative max-w-md w-full aspect-[9/16] bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              src={playingUrl}
              controls
              autoPlay
              className="w-full h-full object-contain"
            />
            <Button
              size="sm"
              variant="secondary"
              className="absolute top-2 right-2"
              onClick={() => setPlayingUrl(null)}
            >
              Fechar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
