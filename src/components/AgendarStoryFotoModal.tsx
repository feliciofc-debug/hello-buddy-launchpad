import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Calendar as CalendarIcon, Instagram } from 'lucide-react';

interface Produto {
  id: string;
  nome: string;
  imagem_url?: string | null;
  link?: string | null;
  link_marketplace?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  produto: Produto;
}

// Ajusta imagem para 1080x1920 com padding preto
async function adjustToStory(url: string): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Falha ao carregar imagem'));
    i.src = url;
  });
  const W = 1080, H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  const scale = Math.min(W / img.naturalWidth, H / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('Erro ao gerar blob')), 'image/jpeg', 0.95);
  });
}

function nowPlusFiveMinLocal(): string {
  const d = new Date(Date.now() + 5 * 60 * 1000);
  // datetime-local format yyyy-MM-ddTHH:mm
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AgendarStoryFotoModal({ open, onOpenChange, produto }: Props) {
  const [scheduledAt, setScheduledAt] = useState<string>(nowPlusFiveMinLocal());
  const [usarLink, setUsarLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string>('');
  const [salvando, setSalvando] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [gerandoPreview, setGerandoPreview] = useState(false);

  const minDateTime = useMemo(() => nowPlusFiveMinLocal(), [open]);
  const linkPadrao = produto.link_marketplace || produto.link || '';

  useEffect(() => {
    if (!open) return;
    setScheduledAt(nowPlusFiveMinLocal());
    setUsarLink(false);
    setLinkUrl(linkPadrao);
    setPreviewUrl(null);
    setPreviewBlob(null);
    if (produto.imagem_url) {
      setGerandoPreview(true);
      adjustToStory(produto.imagem_url)
        .then(blob => {
          setPreviewBlob(blob);
          setPreviewUrl(URL.createObjectURL(blob));
        })
        .catch(e => toast.error('Erro ao preparar preview: ' + e.message))
        .finally(() => setGerandoPreview(false));
    }
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, produto.id]);

  const handleAgendar = async () => {
    if (!produto.imagem_url) { toast.error('Produto sem imagem'); return; }
    if (!previewBlob) { toast.error('Preview ainda não pronto'); return; }
    const sched = new Date(scheduledAt);
    if (isNaN(sched.getTime())) { toast.error('Data inválida'); return; }
    if (sched.getTime() < Date.now() + 5 * 60 * 1000 - 1000) {
      toast.error('Agendamento mínimo: agora + 5 minutos');
      return;
    }
    if (usarLink) {
      if (!linkUrl || !/^https?:\/\//i.test(linkUrl)) {
        toast.error('Link sticker precisa ser URL http(s) válida');
        return;
      }
    }

    setSalvando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      // Upload imagem ajustada (1080x1920) para bucket público
      const filename = `story-${produto.id}-${Date.now()}.jpg`;
      const path = `${user.id}/stories/${filename}`;
      const { error: upErr } = await supabase.storage
        .from('produto-imagens')
        .upload(path, previewBlob, { contentType: 'image/jpeg', upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('produto-imagens').getPublicUrl(path);
      const publicUrl = pub.publicUrl;

      const { error: insErr } = await supabase.from('videos_agendados').insert({
        user_id: user.id,
        tipo: 'story_imagem',
        video_url: publicUrl,
        video_nome: produto.nome,
        canais: ['instagram'],
        produto_id: produto.id,
        scheduled_for: sched.toISOString(),
        status: 'pendente',
        link_sticker: usarLink ? linkUrl : null,
        metadata: { origem: 'manual', produto_nome: produto.nome },
      } as any);
      if (insErr) throw insErr;

      toast.success('Story agendado!');
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Erro ao agendar: ' + (e?.message || e));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Instagram className="w-5 h-5 text-pink-600" />
            📸 Agendar Story (Foto)
          </DialogTitle>
          <DialogDescription>{produto.nome}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Preview 9:16 (1080×1920)</Label>
            <div className="mt-1 mx-auto bg-black rounded-lg overflow-hidden" style={{ width: 180, height: 320 }}>
              {gerandoPreview ? (
                <div className="w-full h-full flex items-center justify-center text-white">
                  <Loader2 className="animate-spin" />
                </div>
              ) : previewUrl ? (
                <img src={previewUrl} alt="preview" className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white text-xs">Sem imagem</div>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="sched" className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" /> Data e hora
            </Label>
            <Input
              id="sched"
              type="datetime-local"
              value={scheduledAt}
              min={minDateTime}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="mt-1"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Mínimo: agora + 5 min</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox id="lk" checked={usarLink} onCheckedChange={(v) => setUsarLink(!!v)} />
              <Label htmlFor="lk" className="cursor-pointer text-sm">
                Adicionar link sticker
              </Label>
            </div>
            {usarLink && (
              <>
                <Input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                />
                <p className="text-[11px] text-amber-600">
                  ⚠️ Link sticker funciona apenas em contas IG verificadas ou com 10k+ seguidores. Se sua conta não for elegível, o sticker é automaticamente omitido (story publica normalmente).
                </p>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={handleAgendar} disabled={salvando || gerandoPreview || !previewBlob}>
            {salvando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Agendar Story
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
