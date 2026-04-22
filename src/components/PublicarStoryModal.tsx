import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Facebook, Instagram, Loader2, BookOpen, AlertTriangle, Clock, CalendarClock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PublicarStoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl: string | null;
  videoNome?: string | null;
  jaPostadoFacebook?: boolean;
  jaPostadoInstagram?: boolean;
  postadoStoryEm?: string | null;
  onPublished?: (result: {
    facebook?: { ok: boolean; story_id?: string; error?: string };
    instagram?: { ok: boolean; story_id?: string; error?: string };
  }) => void;
}

async function getVideoMeta(url: string): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.crossOrigin = 'anonymous';
    v.onloadedmetadata = () => {
      resolve({ duration: v.duration, width: v.videoWidth, height: v.videoHeight });
      v.remove();
    };
    v.onerror = () => reject(new Error('Não foi possível ler o vídeo'));
    v.src = url;
  });
}

export const PublicarStoryModal = ({
  open,
  onOpenChange,
  videoUrl,
  videoNome,
  jaPostadoFacebook = false,
  jaPostadoInstagram = false,
  postadoStoryEm = null,
  onPublished,
}: PublicarStoryModalProps) => {
  const [postFacebook, setPostFacebook] = useState(false);
  const [postInstagram, setPostInstagram] = useState(false);
  const [loading, setLoading] = useState(false);
  const [agendar, setAgendar] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [scheduledTime, setScheduledTime] = useState<string>('');

  useEffect(() => {
    if (open) {
      setPostFacebook(!jaPostadoFacebook);
      setPostInstagram(!jaPostadoInstagram);
      setAgendar(false);
      setScheduledDate('');
      setScheduledTime('');
    }
  }, [open, jaPostadoFacebook, jaPostadoInstagram]);

  const tempoPostagem = postadoStoryEm
    ? formatDistanceToNow(new Date(postadoStoryEm), { addSuffix: true, locale: ptBR })
    : null;

  const handlePublicar = async () => {
    if (!videoUrl) return;
    const canais: string[] = [];
    if (postFacebook && !jaPostadoFacebook) canais.push('facebook');
    if (postInstagram && !jaPostadoInstagram) canais.push('instagram');
    if (canais.length === 0) {
      toast.error('Selecione pelo menos uma rede');
      return;
    }

    // Validar agendamento
    let scheduledFor: Date | null = null;
    if (agendar) {
      if (!scheduledDate || !scheduledTime) {
        toast.error('Escolha data e horário do agendamento');
        return;
      }
      scheduledFor = new Date(`${scheduledDate}T${scheduledTime}:00`);
      if (isNaN(scheduledFor.getTime())) {
        toast.error('Data ou horário inválido');
        return;
      }
      if (scheduledFor.getTime() < Date.now() + 60_000) {
        toast.error('O agendamento precisa ser pelo menos 1 minuto no futuro');
        return;
      }
    }

    setLoading(true);
    try {
      // 1) Validação client-side
      let meta: { duration: number; width: number; height: number } | null = null;
      try {
        meta = await getVideoMeta(videoUrl);
      } catch {
        // Sem CORS no vídeo: seguimos sem validação local; servidor valida.
      }

      if (meta && meta.duration > 60) {
        toast.error('Story aceita vídeos de até 60 segundos. Corte seu vídeo no celular ou use um reel mais curto.');
        setLoading(false);
        return;
      }

      if (meta && meta.width > meta.height) {
        const ok = window.confirm(
          '⚠️ Seu vídeo é horizontal. Stories funcionam melhor na vertical 9:16. Quer postar assim mesmo?'
        );
        if (!ok) {
          setLoading(false);
          return;
        }
      }

      // 2) Auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Você precisa estar logado');

      // 3) Se for agendamento, salva no banco e sai
      if (agendar && scheduledFor) {
        const { error: agErr } = await supabase.from('videos_agendados').insert({
          user_id: user.id,
          tipo: 'story',
          video_url: videoUrl,
          video_nome: videoNome || null,
          canais,
          scheduled_for: scheduledFor.toISOString(),
          status: 'pendente',
        });
        if (agErr) throw agErr;
        toast.success(`📅 Story agendado para ${scheduledFor.toLocaleString('pt-BR')}`);
        onOpenChange(false);
        return;
      }

      toast.loading('Publicando Story...', { id: 'story-publish' });

      const { data, error } = await supabase.functions.invoke('meta-publish-story', {
        body: {
          video_url: videoUrl,
          user_id: user.id,
          canais,
        },
      });

      toast.dismiss('story-publish');
      if (error) throw error;

      const fb = data?.facebook;
      const ig = data?.instagram;

      let okCount = 0;
      if (fb?.ok) okCount++;
      if (ig?.ok) okCount++;

      if (okCount === 0) {
        const msg = fb?.error || ig?.error || 'Erro ao publicar';
        toast.error(`Falha: ${msg}`);
      } else {
        const partes: string[] = [];
        if (fb?.ok) partes.push('Facebook');
        if (ig?.ok) partes.push('Instagram');
        toast.success(`Story publicado em: ${partes.join(' e ')}`);

        if (fb && !fb.ok) toast.error(`Facebook falhou: ${fb.error}`);
        if (ig && !ig.ok) toast.error(`Instagram falhou: ${ig.error}`);
      }

      onPublished?.({ facebook: fb, instagram: ig });
      if (okCount > 0) onOpenChange(false);
    } catch (err: any) {
      toast.dismiss('story-publish');
      toast.error(err?.message || 'Erro ao publicar Story');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" /> Postar como Story
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {videoNome && (
            <p className="text-sm text-muted-foreground truncate">📹 {videoNome}</p>
          )}

          <div className="flex gap-2 p-3 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p>
              <strong>IMPORTANTE:</strong> vídeos devem ser verticais (9:16) e ter até <strong>60 segundos</strong>.
              Meta rejeita vídeos horizontais ou muito longos.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Canais:</p>

            <label className="flex items-center gap-3 p-3 rounded-md border cursor-pointer hover:bg-muted/50 transition">
              <Checkbox
                checked={postFacebook}
                onCheckedChange={(c) => setPostFacebook(!!c)}
                disabled={jaPostadoFacebook || loading}
              />
              <Facebook className="h-4 w-4 text-blue-600" />
              <span className="text-sm flex-1">Facebook Story</span>
              {jaPostadoFacebook && (
                <span className="text-xs text-green-600">✅ Já postado{tempoPostagem ? ` ${tempoPostagem}` : ''}</span>
              )}
            </label>

            <label className="flex items-center gap-3 p-3 rounded-md border cursor-pointer hover:bg-muted/50 transition">
              <Checkbox
                checked={postInstagram}
                onCheckedChange={(c) => setPostInstagram(!!c)}
                disabled={jaPostadoInstagram || loading}
              />
              <Instagram className="h-4 w-4 text-pink-600" />
              <span className="text-sm flex-1">Instagram Story</span>
              {jaPostadoInstagram && (
                <span className="text-xs text-green-600">✅ Já postado{tempoPostagem ? ` ${tempoPostagem}` : ''}</span>
              )}
            </label>
          </div>

          <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
            💡 <strong>Música:</strong> adicione direto no Instagram/Facebook após publicar pra maximizar alcance.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handlePublicar}
            disabled={loading || (!postFacebook && !postInstagram)}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white"
          >
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publicando...</>
            ) : (
              <><BookOpen className="mr-2 h-4 w-4" /> Postar Agora</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
