import { useEffect, useState } from 'react';
import { Image as ImageIcon, Loader2, RefreshCw, Video } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

export type MetaAdsMedia = {
  id: string;
  tipo: 'foto' | 'video';
  midia_url: string;
  thumbnail_url: string | null;
  contexto_original: string | null;
  legenda_gerada: string | null;
};

type Props = {
  value: MetaAdsMedia | null;
  onChange: (media: MetaAdsMedia) => void;
};

export default function MediaPicker({ value, onChange }: Props) {
  const [media, setMedia] = useState<MetaAdsMedia[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('midias_whatsapp')
      .select('id,tipo,midia_url,thumbnail_url,contexto_original,legenda_gerada')
      .eq('user_id', user.id)
      .in('tipo', ['foto', 'video'])
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) toast.error('Não foi possível carregar suas mídias.');
    setMedia((data as MetaAdsMedia[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando mídias…</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Escolha uma foto ou vídeo recebido pelo WhatsApp.</p>
        <Button type="button" variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      {media.length === 0 ? (
        <Card className="p-4 text-sm text-muted-foreground">Nenhuma foto ou vídeo disponível na biblioteca do WhatsApp.</Card>
      ) : (
        <div className="grid max-h-80 grid-cols-2 gap-3 overflow-y-auto md:grid-cols-4">
          {media.map((item) => {
            const selected = value?.id === item.id;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => onChange(item)}
                className={`overflow-hidden rounded-lg border-2 text-left transition ${selected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50'}`}
              >
                <div className="relative aspect-square bg-muted">
                  {item.tipo === 'foto' ? (
                    <img src={item.thumbnail_url || item.midia_url} alt="" className="h-full w-full object-cover" />
                  ) : item.thumbnail_url ? (
                    <img src={item.thumbnail_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center"><Video className="h-8 w-8 text-muted-foreground" /></div>
                  )}
                  <span className="absolute bottom-1 right-1 rounded bg-black/70 p-1 text-white">
                    {item.tipo === 'foto' ? <ImageIcon className="h-3 w-3" /> : <Video className="h-3 w-3" />}
                  </span>
                </div>
                <p className="truncate p-2 text-xs">{item.contexto_original || item.legenda_gerada || 'Sem descrição'}</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
