import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, CircleDashed, ExternalLink, Loader2, Rocket, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type Network = 'facebook' | 'instagram' | 'tiktok' | 'linkedin';
type ResultStatus = 'published' | 'draft' | 'not_connected' | 'unsupported' | 'failed';

interface NetworkResult {
  network: Network;
  status: ResultStatus;
  format: string;
  message: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  imageUrls?: string[];
  title: string;
  initialCaption?: string;
  linkUrl?: string | null;
  onFinished?: (results: NetworkResult[]) => void;
}

const NETWORKS: Network[] = ['instagram', 'facebook', 'tiktok', 'linkedin'];
const LABELS: Record<Network, string> = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', linkedin: 'LinkedIn' };
const DEFAULT_LIMITS: Record<Network, number> = { instagram: 2200, facebook: 63206, tiktok: 2200, linkedin: 3000 };

export function PublicarTodasRedesModal({
  open,
  onOpenChange,
  mediaType,
  mediaUrl,
  imageUrls = [],
  title,
  initialCaption = '',
  linkUrl,
  onFinished,
}: Props) {
  const navigate = useNavigate();
  const [caption, setCaption] = useState(initialCaption);
  const [connections, setConnections] = useState<Record<Network, boolean>>({ instagram: false, facebook: false, tiktok: false, linkedin: false });
  const [limits, setLimits] = useState<Record<Network, number>>(DEFAULT_LIMITS);
  const [selected, setSelected] = useState<Network[]>([]);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [results, setResults] = useState<NetworkResult[]>([]);
  const images = useMemo(() => Array.from(new Set([mediaUrl, ...imageUrls].filter(Boolean))).slice(0, 10), [mediaUrl, imageUrls]);

  const formatFor = (network: Network) => {
    if (mediaType === 'video') return network === 'tiktok' ? 'Rascunho' : network === 'linkedin' ? 'Vídeo' : 'Reels';
    if (network === 'tiktok') return 'Requer vídeo';
    return images.length > 1 && (network === 'instagram' || network === 'facebook') ? 'Carrossel' : 'Feed';
  };

  useEffect(() => {
    if (!open) return;
    setCaption(initialCaption);
    setResults([]);
    setLoading(true);
    void supabase.functions.invoke('publicar-todas-redes', { body: { action: 'connections' } }).then(({ data, error }) => {
      if (!error && data?.connections) {
        setConnections(data.connections);
        setLimits(data.limits || DEFAULT_LIMITS);
        setSelected(NETWORKS.filter((network) => data.connections[network] && !(network === 'tiktok' && mediaType === 'image')));
      }
    }).finally(() => setLoading(false));
  }, [open, initialCaption, mediaType]);

  const hasExceededLimit = selected.some((network) => caption.length > limits[network]);
  const canPublish = selected.length > 0 && caption.trim().length > 0 && !hasExceededLimit && !publishing && !loading;

  const publish = async () => {
    if (!canPublish) return;
    setPublishing(true);
    setResults(selected.map((network) => ({ network, status: 'failed', format: formatFor(network), message: 'Publicando...' })));
    try {
      const { data, error } = await supabase.functions.invoke('publicar-todas-redes', {
        body: {
          action: 'publish',
          media_type: mediaType,
          media_url: mediaUrl,
          image_urls: images,
          caption: caption.trim(),
          link_url: linkUrl || undefined,
          networks: selected,
        },
      });
      const next = (data?.results || []) as NetworkResult[];
      if (error && next.length === 0) throw error;
      setResults(next);
      onFinished?.(next);
    } catch (error) {
      setResults(selected.map((network) => ({
        network,
        status: 'failed',
        format: formatFor(network),
        message: error instanceof Error ? error.message : 'Não foi possível concluir a publicação.',
      })));
    } finally {
      setPublishing(false);
    }
  };

  const statusIcon = (status: ResultStatus) => {
    if (status === 'published' || status === 'draft') return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (status === 'failed') return <XCircle className="h-4 w-4 text-destructive" />;
    return <AlertCircle className="h-4 w-4 text-amber-600" />;
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !publishing && onOpenChange(value)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Rocket className="h-5 w-5 text-brand" /> Publicar em todas as redes</DialogTitle>
          <DialogDescription>{title} · revise a legenda e confirme as redes.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-2 sm:grid-cols-2">
            {NETWORKS.map((network) => {
              const connected = connections[network];
              const unsupported = network === 'tiktok' && mediaType === 'image';
              const checked = selected.includes(network);
              return (
                <div key={network} className={cn('flex min-h-16 items-center gap-3 rounded-md border p-3', !connected && 'bg-muted/40')}>
                  <Checkbox
                    id={`all-${network}`}
                    checked={checked}
                    disabled={!connected || unsupported || publishing || loading}
                    onCheckedChange={(value) => setSelected((current) => value ? [...current, network] : current.filter((item) => item !== network))}
                  />
                  <Label htmlFor={`all-${network}`} className="min-w-0 flex-1 cursor-pointer">
                    <span className="flex items-center justify-between gap-2 font-medium"><span>{LABELS[network]}</span><span className="text-xs text-muted-foreground">{formatFor(network)}</span></span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {loading ? 'Verificando conexão...' : unsupported ? 'Disponível somente para vídeo' : connected ? 'Conectada' : 'Não conectada'}
                    </span>
                  </Label>
                  {!connected && !loading && (
                    <Button variant="ghost" size="icon" title={`Conectar ${LABELS[network]}`} onClick={() => { onOpenChange(false); navigate('/configuracoes'); }}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {mediaType === 'image' && (
            <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>TikTok não recebe esta foto neste envio. Gere um vídeo do produto para enviá-lo aos rascunhos.</AlertDescription></Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="all-caption">Legenda</Label>
            <Textarea id="all-caption" value={caption} onChange={(event) => setCaption(event.target.value)} rows={7} disabled={publishing} />
            <div className="grid gap-1 sm:grid-cols-2">
              {NETWORKS.map((network) => {
                const remaining = limits[network] - caption.length;
                return (
                  <p key={network} className={cn('text-xs', remaining < 0 ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                    {LABELS[network]}: {remaining >= 0 ? `${remaining.toLocaleString('pt-BR')} caracteres disponíveis` : `excede em ${Math.abs(remaining).toLocaleString('pt-BR')} caracteres`}
                  </p>
                );
              })}
            </div>
          </div>

          {results.length > 0 && (
            <div className="space-y-2" aria-live="polite">
              {results.map((result) => (
                <div key={result.network} className="flex items-start gap-3 rounded-md border p-3 text-sm">
                  {result.message === 'Publicando...' ? <CircleDashed className="h-4 w-4 animate-spin text-brand" /> : statusIcon(result.status)}
                  <div><p className="font-medium">{LABELS[result.network]} · {result.format}</p><p className="text-muted-foreground">{result.message}</p></div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={publishing}>{results.length ? 'Fechar' : 'Cancelar'}</Button>
            {results.length === 0 && (
              <Button onClick={publish} disabled={!canPublish} className="bg-brand text-brand-foreground hover:bg-brand/90">
                {publishing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publicando</> : <><Rocket className="mr-2 h-4 w-4" /> Confirmar publicação</>}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}