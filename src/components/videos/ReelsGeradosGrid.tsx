import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Download, Rocket, Trash2, Film, Facebook, Instagram, CheckCircle2, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PublicarReelsModal } from '@/components/PublicarReelsModal';
import { PublicarStoryModal } from '@/components/PublicarStoryModal';

interface ReelGerado {
  id: string;
  produto_id: string | null;
  video_url: string;
  thumbnail_url: string | null;
  titulo: string | null;
  criado_em: string;
  publicado_em: string | null;
  publicado_facebook: boolean;
  publicado_instagram: boolean;
  facebook_post_id: string | null;
  instagram_post_id: string | null;
  postado_story_facebook?: boolean;
  postado_story_instagram?: boolean;
  postado_story_em?: string | null;
  produtos: { id?: string; nome: string; imagem_url: string | null; preco?: number | null; link_marketplace?: string | null } | null;
}

const extrairPath = (url: string): string | null => {
  const match = url.match(/produto-videos\/(.+)$/);
  return match ? match[1] : null;
};

export const ReelsGeradosGrid = () => {
  const [reels, setReels] = useState<ReelGerado[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [publishingReel, setPublishingReel] = useState<ReelGerado | null>(null);
  const [storyReel, setStoryReel] = useState<ReelGerado | null>(null);

  const handleStoryPublished = async (
    reelId: string,
    result: {
      facebook?: { ok: boolean; story_id?: string; error?: string };
      instagram?: { ok: boolean; story_id?: string; error?: string };
    }
  ) => {
    const updates: Record<string, any> = { postado_story_em: new Date().toISOString() };
    if (result.facebook?.ok) {
      updates.postado_story_facebook = true;
      if (result.facebook.story_id) updates.story_facebook_id = result.facebook.story_id;
    }
    if (result.instagram?.ok) {
      updates.postado_story_instagram = true;
      if (result.instagram.story_id) updates.story_instagram_id = result.instagram.story_id;
    }
    if (result.facebook?.ok || result.instagram?.ok) {
      await supabase.from('produto_videos' as any).update(updates).eq('id', reelId);
      loadReels();
    }
  };

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
        .select('*, produtos(id, nome, imagem_url, preco, link_marketplace)')
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

  const handlePublicar = (reel: ReelGerado) => {
    setPublishingReel(reel);
  };

  const handlePublished = async (result: {
    facebook?: { ok: boolean; postId?: string; error?: string };
    instagram?: { ok: boolean; postId?: string; error?: string };
  }) => {
    if (!publishingReel) return;

    const updates: Record<string, any> = {
      publicado_em: new Date().toISOString(),
    };

    if (result.facebook?.ok) {
      updates.publicado_facebook = true;
      if (result.facebook.postId) updates.facebook_post_id = result.facebook.postId;
    }
    if (result.instagram?.ok) {
      updates.publicado_instagram = true;
      if (result.instagram.postId) updates.instagram_post_id = result.instagram.postId;
    }

    try {
      const { error } = await supabase
        .from('produto_videos' as any)
        .update(updates)
        .eq('id', publishingReel.id);

      if (error) {
        console.error('[REELS] Erro ao atualizar status no banco:', error);
        toast.error('Publicado, mas erro ao atualizar status. Recarregando...');
      }
    } catch (err) {
      console.error('[REELS] Exceção ao atualizar status:', err);
    } finally {
      loadReels();
    }
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
                  {reel.publicado_em && (reel.publicado_facebook || reel.publicado_instagram) && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                      Publicado{' '}
                      {formatDistanceToNow(new Date(reel.publicado_em), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  )}
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
                      className="text-xs bg-gradient-to-r from-purple-600 to-pink-600 text-white disabled:opacity-50"
                      onClick={() => handlePublicar(reel)}
                      disabled={reel.publicado_facebook && reel.publicado_instagram}
                      title={
                        reel.publicado_facebook && reel.publicado_instagram
                          ? 'Já publicado em ambas as redes'
                          : 'Publicar no Facebook e/ou Instagram'
                      }
                    >
                      <Rocket className="mr-1 h-3 w-3" />
                      {reel.publicado_facebook && reel.publicado_instagram ? 'Publicado' : 'Publicar'}
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

      {publishingReel && (
        <PublicarReelsModal
          open={!!publishingReel}
          onOpenChange={(open) => !open && setPublishingReel(null)}
          videoUrl={publishingReel.video_url}
          videoNome={publishingReel.titulo || publishingReel.produtos?.nome || null}
          produto={
            publishingReel.produtos
              ? {
                  id: publishingReel.produto_id || undefined,
                  nome: publishingReel.produtos.nome,
                  preco: publishingReel.produtos.preco ?? null,
                  link_marketplace: publishingReel.produtos.link_marketplace ?? null,
                  imagem_url: publishingReel.produtos.imagem_url,
                }
              : null
          }
          publicadoFacebook={publishingReel.publicado_facebook}
          publicadoInstagram={publishingReel.publicado_instagram}
          onPublished={handlePublished}
        />
      )}
    </div>
  );
};
