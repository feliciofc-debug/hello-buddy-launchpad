import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Linkedin, Loader2, Upload, X, Send } from 'lucide-react';
import { toast } from 'sonner';
import { formatSaoPauloDateTime } from '@/lib/sao-paulo-time';

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
  status: string | null;
  created_at: string | null;
}

const MAX_IMAGE = 8 * 1024 * 1024;
const MAX_VIDEO = 100 * 1024 * 1024;

export default function LinkedInTab() {
  const [loading, setLoading] = useState(true);
  const [conn, setConn] = useState<LinkedInConn | null>(null);
  const [texto, setTexto] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);

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

  const uploadArquivo = async (
    file: File,
    bucket: 'produto-imagens' | 'videos',
    limite: number,
  ): Promise<string | null> => {
    if (file.size > limite) {
      toast.error(`Arquivo maior que o limite de ${Math.round(limite / 1024 / 1024)}MB`);
      return null;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    setUploading(true);
    try {
      const path = `${user.id}/linkedin/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return data.publicUrl;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro no upload');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const onImagem = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const url = await uploadArquivo(file, 'produto-imagens', MAX_IMAGE);
    if (url) {
      setImageUrl(url);
      setVideoUrl(null);
    }
  };

  const onVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const url = await uploadArquivo(file, 'videos', MAX_VIDEO);
    if (url) {
      setVideoUrl(url);
      setImageUrl(null);
    }
  };

  const publicar = async () => {
    if (!texto.trim() || !conectado) return;
    setPublicando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { data: fila, error: filaErr } = await supabase
        .from('social_posts_queue')
        .insert({
          user_id: user.id,
          platform: 'linkedin',
          post_text: texto,
          post_text_linkedin: texto,
          image_url: imageUrl || null,
          video_url: videoUrl || null,
          link_url: linkUrl || null,
          status: 'pendente',
        })
        .select('id')
        .single();
      if (filaErr) throw filaErr;

      const { data, error } = await supabase.functions.invoke('linkedin-publish', {
        body: {
          texto,
          image_url: imageUrl || undefined,
          video_url: videoUrl || undefined,
          link_url: linkUrl || undefined,
          queue_id: fila.id,
        },
      });
      if (error) throw error;

      if (data?.success === false) {
        await supabase
          .from('social_posts_queue')
          .update({ status: 'erro', error_message: data.error })
          .eq('id', fila.id)
          .eq('user_id', user.id);
        toast.error(data.error || 'Erro ao publicar no LinkedIn');
      } else {
        toast.success('Post publicado no LinkedIn');
        setTexto('');
        setLinkUrl('');
        setImageUrl(null);
        setVideoUrl(null);
      }

      await carregarHistorico();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao publicar');
    } finally {
      setPublicando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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

      {/* Compositor */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo post no LinkedIn</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Texto do post</Label>
            <Textarea
              rows={8}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              disabled={!conectado}
              placeholder="Escreva o post..."
            />
          </div>

          <div>
            <Label>Link (opcional)</Label>
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              disabled={!conectado}
              placeholder="https://..."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Imagem (até 8MB)</Label>
              <input
                id="linkedin-image-upload"
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={onImagem}
                disabled={!conectado || uploading}
              />
              <Button
                variant="outline"
                className="w-full"
                disabled={!conectado || uploading}
                onClick={() => document.getElementById('linkedin-image-upload')?.click()}
              >
                {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Escolher imagem
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Vídeo (até 100MB)</Label>
              <input
                id="linkedin-video-upload"
                type="file"
                accept="video/mp4,video/quicktime"
                className="hidden"
                onChange={onVideo}
                disabled={!conectado || uploading}
              />
              <Button
                variant="outline"
                className="w-full"
                disabled={!conectado || uploading}
                onClick={() => document.getElementById('linkedin-video-upload')?.click()}
              >
                {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Escolher vídeo
              </Button>
            </div>
          </div>

          {imageUrl && (
            <div className="space-y-2">
              <img src={imageUrl} alt="Prévia da imagem do post" className="max-h-64 rounded-md border" />
              <Button variant="ghost" size="sm" onClick={() => setImageUrl(null)}>
                <X className="h-4 w-4 mr-1" /> Remover
              </Button>
            </div>
          )}

          {videoUrl && (
            <div className="space-y-2">
              <video src={videoUrl} controls className="max-h-64 rounded-md border w-full" />
              <Button variant="ghost" size="sm" onClick={() => setVideoUrl(null)}>
                <X className="h-4 w-4 mr-1" /> Remover
              </Button>
            </div>
          )}

          <Button onClick={publicar} disabled={!conectado || !texto.trim() || publicando || uploading}>
            {publicando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Publicar no LinkedIn
          </Button>
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {historico.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum post publicado ainda.</p>
          ) : (
            historico.map((item) => {
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
