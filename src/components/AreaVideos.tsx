import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, Video, Trash2, Play, Facebook, Instagram, BookOpen, Rocket } from 'lucide-react';
import { AutopilotModal } from '@/components/AutopilotModal';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { PublicarReelsModal } from '@/components/PublicarReelsModal';
import { PublicarStoryModal } from '@/components/PublicarStoryModal';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { TikTokIcon } from '@/components/tiktok/TikTokIcon';
import { TikTokShareModal } from '@/components/TikTokShareModal';
import { ReelsGeradosGrid } from './videos/ReelsGeradosGrid';

interface VideoItem {
  id: string;
  titulo: string | null;
  video_url: string;
  thumbnail_url: string | null;
  tamanho_mb: number | null;
  duracao_segundos: number | null;
  status: string;
  publicado_facebook: boolean;
  publicado_instagram: boolean;
  postado_story_facebook?: boolean;
  postado_story_instagram?: boolean;
  postado_story_em?: string | null;
  created_at: string;
}

export const AreaVideos = () => {
  const showTikTok = useFeatureFlag('tiktok_integration');
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showReelsModal, setShowReelsModal] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
  const [storyVideo, setStoryVideo] = useState<VideoItem | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [tiktokModalOpen, setTiktokModalOpen] = useState(false);
  const [tiktokModalContent, setTiktokModalContent] = useState<{
    type: 'video';
    url: string;
    title?: string;
    description?: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleStoryPublished = async (
    videoId: string,
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
      await supabase.from('videos_produtos' as any).update(updates).eq('id', videoId);
      loadVideos();
    }
  };

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('videos_produtos' as any)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) setVideos(data as any);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      toast.error('Apenas arquivos de vídeo (MP4, MOV)');
      return;
    }

    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > 100) {
      toast.error('Tamanho máximo: 100MB');
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const fileName = `${user.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('videos').getPublicUrl(fileName);

      const { error: insertError } = await supabase
        .from('videos_produtos' as any)
        .insert({
          user_id: user.id,
          titulo: file.name.replace(/\.[^/.]+$/, ''),
          video_url: urlData.publicUrl,
          tamanho_mb: Math.round(sizeMB * 100) / 100,
          tipo: 'reels',
          status: 'disponivel',
        } as any);

      if (insertError) throw insertError;

      toast.success('Vídeo enviado com sucesso!');
      loadVideos();
    } catch (err: any) {
      toast.error('Erro ao enviar: ' + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este vídeo?')) return;
    await supabase.from('videos_produtos' as any).delete().eq('id', id);
    toast.success('Vídeo excluído');
    loadVideos();
  };

  const handleOpenTikTokModal = (video: VideoItem) => {
    if (!video.video_url) {
      toast.error('Vídeo não encontrado');
      return;
    }
    setTiktokModalContent({
      type: 'video',
      url: video.video_url,
      title: video.titulo || 'Vídeo',
    });
    setTiktokModalOpen(true);
  };

  const openReels = (video: VideoItem) => {
    setSelectedVideo(video);
    setShowReelsModal(true);
  };

  return (
    <div className="space-y-6">
      <ReelsGeradosGrid />

      <h2 className="text-xl font-semibold pt-2">📹 Vídeos Enviados</h2>

      {/* Upload area */}
      <Card className="border-dashed border-2 border-muted-foreground/30">
        <CardContent className="p-8 text-center">
          <Video className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Upload de Vídeo</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Arraste ou clique para enviar vídeos MP4/MOV (máx 100MB)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/mov"
            onChange={handleUpload}
            className="hidden"
            id="video-upload"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
            size="lg"
          >
            <Upload className="mr-2 h-5 w-5" />
            {uploading ? 'Enviando...' : 'Escolher Vídeo'}
          </Button>
        </CardContent>
      </Card>

      {/* Dica */}
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            ℹ️ <strong>Reels</strong> = alcance e marca (link na legenda)<br />
            ℹ️ <strong>Feed com imagem</strong> = conversão (link direto no post)<br />
            💡 Use Reels para atrair seguidores e posts de imagem com link para vender.
          </p>
        </CardContent>
      </Card>

      {/* Grid de vídeos */}
      {videos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Video className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <p>Nenhum vídeo enviado ainda</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map((video) => (
            <Card key={video.id} className="overflow-hidden">
              <div className="relative aspect-[9/16] max-h-[300px] bg-black">
                {playingId === video.id ? (
                  <video
                    src={video.video_url}
                    controls
                    autoPlay
                    className="w-full h-full object-contain"
                    onEnded={() => setPlayingId(null)}
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center cursor-pointer group"
                    onClick={() => setPlayingId(video.id)}
                  >
                    <video
                      src={video.video_url}
                      className="w-full h-full object-contain"
                      muted
                      preload="metadata"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition">
                      <Play className="h-12 w-12 text-white" />
                    </div>
                  </div>
                )}
              </div>
              <CardContent className="p-4 space-y-3">
                <p className="font-medium text-sm truncate">{video.titulo || 'Sem título'}</p>
                <div className="flex gap-1 flex-wrap">
                  {video.tamanho_mb && (
                    <Badge variant="outline" className="text-xs">{video.tamanho_mb} MB</Badge>
                  )}
                  {video.publicado_facebook && (
                    <Badge className="bg-blue-500 text-white text-xs gap-1">
                      <Facebook className="h-3 w-3" /> FB
                    </Badge>
                  )}
                  {video.publicado_instagram && (
                    <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs gap-1">
                      <Instagram className="h-3 w-3" /> IG
                    </Badge>
                  )}
                  {!video.publicado_facebook && !video.publicado_instagram && (
                    <Badge variant="secondary" className="text-xs">Disponível</Badge>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs"
                    onClick={() => openReels(video)}
                  >
                    <Video className="mr-1 h-3 w-3" />
                    Publicar Reels
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-gradient-to-r from-orange-500 to-pink-500 text-white text-xs disabled:opacity-50"
                    onClick={() => setStoryVideo(video)}
                    disabled={!!video.postado_story_facebook && !!video.postado_story_instagram}
                  >
                    <BookOpen className="mr-1 h-3 w-3" />
                    Story
                  </Button>
                  {showTikTok && (
                    <Button
                      size="sm"
                      className="flex-1 bg-black text-white text-xs hover:bg-gray-800"
                      onClick={() => handleOpenTikTokModal(video)}
                    >
                      <TikTokIcon className="mr-1 h-3 w-3" />
                      TikTok
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(video.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PublicarReelsModal
        open={showReelsModal}
        onOpenChange={setShowReelsModal}
        videoUrl={selectedVideo?.video_url || null}
        videoNome={selectedVideo?.titulo || null}
        produto={null}
      />

      {storyVideo && (
        <PublicarStoryModal
          open={!!storyVideo}
          onOpenChange={(open) => !open && setStoryVideo(null)}
          videoUrl={storyVideo.video_url}
          videoNome={storyVideo.titulo}
          jaPostadoFacebook={!!storyVideo.postado_story_facebook}
          jaPostadoInstagram={!!storyVideo.postado_story_instagram}
          postadoStoryEm={storyVideo.postado_story_em || null}
          onPublished={(result) => handleStoryPublished(storyVideo.id, result)}
        />
      )}

      {tiktokModalContent && (
        <TikTokShareModal
          open={tiktokModalOpen}
          onOpenChange={setTiktokModalOpen}
          content={tiktokModalContent}
        />
      )}
    </div>
  );
};
