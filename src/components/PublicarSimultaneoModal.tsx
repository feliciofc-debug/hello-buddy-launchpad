import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Produto {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number | null;
  imagem_url: string | null;
  link?: string | null;
  link_marketplace?: string | null;
  imagens?: any; // string[] from DB
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produto: Produto;
}

type ProdutoImageFields = Pick<Produto, 'imagem_url' | 'imagens'>;

function isValidImageUrl(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeStoredImages(value: unknown): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeStoredImages(item));
  }

  if (isValidImageUrl(value)) {
    const trimmed = value.trim();

    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        return normalizeStoredImages(JSON.parse(trimmed));
      } catch {
        return [trimmed];
      }
    }

    return [trimmed];
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;

    for (const key of ['imagens', 'image_urls', 'photos', 'urls']) {
      if (key in record) {
        return normalizeStoredImages(record[key]);
      }
    }

    const values = Object.values(record);
    if (values.every((item) => typeof item === 'string')) {
      return values.filter(isValidImageUrl).map((item) => item.trim());
    }
  }

  return [];
}

function getAllImageUrls(produto: ProdutoImageFields): string[] {
  const urls = new Set<string>();

  if (isValidImageUrl(produto.imagem_url)) {
    urls.add(produto.imagem_url.trim());
  }

  normalizeStoredImages(produto.imagens).forEach((url) => {
    if (isValidImageUrl(url)) {
      urls.add(url.trim());
    }
  });

  return Array.from(urls).slice(0, 5);
}

export function PublicarSimultaneoModal({ open, onOpenChange, produto }: Props) {
  const link = produto.link || produto.link_marketplace || '';
  const precoFormatado = produto.preco ? `R$ ${produto.preco.toFixed(2).replace('.', ',')}` : '';
  const textoInicial = [
    `🔥 ${produto.nome}`,
    produto.descricao ? `\n${produto.descricao}` : '',
    precoFormatado ? `\n💰 ${precoFormatado}` : '',
    link ? `\n\n🔗 Compre aqui: ${link}` : '',
  ].filter(Boolean).join('');

  const initialImages = useMemo(
    () => getAllImageUrls(produto),
    [produto.id, produto.imagem_url, produto.imagens]
  );

  const [texto, setTexto] = useState(textoInicial);
  const [facebook, setFacebook] = useState(true);
  const [instagram, setInstagram] = useState(true);
  const [allImages, setAllImages] = useState<string[]>(initialImages);
  const [carregandoFotos, setCarregandoFotos] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [statusPublicacao, setStatusPublicacao] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const isCarousel = allImages.length >= 2;

  const loadLatestProductImages = useCallback(async (): Promise<string[]> => {
    setCarregandoFotos(true);

    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('imagem_url, imagens')
        .eq('id', produto.id)
        .single();

      if (error) throw error;

      const latestImages = getAllImageUrls({
        imagem_url: data?.imagem_url ?? null,
        imagens: data?.imagens,
      });

      setAllImages(latestImages);
      return latestImages;
    } catch (error) {
      console.error('Erro ao carregar fotos atualizadas do produto:', error);

      const fallbackImages = getAllImageUrls(produto);
      setAllImages(fallbackImages);
      return fallbackImages;
    } finally {
      setCarregandoFotos(false);
    }
  }, [produto]);

  useEffect(() => {
    setAllImages(initialImages);
  }, [initialImages]);

  useEffect(() => {
    if (!open) return;

    console.log('[PublicarSimultaneoModal] Produto completo:', produto);
    console.log('[PublicarSimultaneoModal] imagem_url:', produto.imagem_url);
    console.log('[PublicarSimultaneoModal] imagens:', produto.imagens);
    console.log('[PublicarSimultaneoModal] Todas as fotos detectadas:', initialImages);

    setTexto(textoInicial);
    setFacebook(true);
    setInstagram(true);
    setPublicando(false);
    setStatusPublicacao(null);
    setResultado(null);

    void loadLatestProductImages();
  }, [open, textoInicial, loadLatestProductImages]);

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setStatusPublicacao(null);
      setResultado(null);
    }
    onOpenChange(v);
  };

  const handlePublicar = async () => {
    if (!facebook && !instagram) {
      toast.error('Selecione pelo menos uma rede');
      return;
    }
    if (!texto.trim()) {
      toast.error('O texto não pode estar vazio');
      return;
    }

    setPublicando(true);
    setStatusPublicacao(null);
    setResultado(null);
    const resultados: string[] = [];

    try {
      const imagesToPublish = await loadLatestProductImages();
      const shouldPublishCarousel = imagesToPublish.length >= 2;

      setStatusPublicacao(
        shouldPublishCarousel
          ? `Publicando carrossel com ${imagesToPublish.length} fotos...`
          : imagesToPublish.length === 1
            ? 'Publicando post com 1 foto...'
            : 'Publicando post sem imagem...'
      );

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Você precisa estar logado'); setPublicando(false); return; }

      const promises: Promise<void>[] = [];

      // === FACEBOOK ===
      if (facebook) {
        promises.push((async () => {
          try {
            if (shouldPublishCarousel) {
              // Carousel no Facebook: múltiplas fotos
              const { error } = await supabase.functions.invoke('meta-publish-post', {
                body: { 
                  message: texto, 
                  user_id: user.id, 
                  image_urls: imagesToPublish,
                },
              });
              if (error) throw error;
              resultados.push(`✅ Facebook (carrossel ${imagesToPublish.length} fotos) OK`);
            } else {
              // Post simples
              const { error } = await supabase.functions.invoke('meta-publish-post', {
                body: { 
                  message: texto, 
                  user_id: user.id, 
                  image_url: imagesToPublish[0] || undefined,
                },
              });
              if (error) throw error;
              resultados.push('✅ Facebook OK');
            }
          } catch {
            resultados.push('❌ Facebook falhou');
          }
        })());
      }

      // === INSTAGRAM ===
      if (instagram) {
        if (imagesToPublish.length === 0) {
          resultados.push('⚠️ Instagram pulado (sem imagem)');
        } else {
          promises.push((async () => {
            try {
              if (shouldPublishCarousel) {
                // Carousel no Instagram
                const { data: pubData, error } = await supabase.functions.invoke('meta-publish-carousel', {
                  body: { 
                    caption: texto, 
                    image_urls: imagesToPublish, 
                    user_id: user.id,
                  },
                });
                if (error) throw error;
                if (!pubData?.success) throw new Error(pubData?.error);
                resultados.push(`✅ Instagram (carrossel ${imagesToPublish.length} fotos) OK`);
              } else {
                // Post simples
                const { data: pubData, error } = await supabase.functions.invoke('meta-publish-instagram', {
                  body: { 
                    caption: texto, 
                    image_url: imagesToPublish[0], 
                    user_id: user.id,
                  },
                });
                if (error) throw error;
                if (!pubData?.success) throw new Error(pubData?.error);
                resultados.push('✅ Instagram OK');
              }
            } catch {
              resultados.push('❌ Instagram falhou');
            }
          })());
        }
      }

      await Promise.all(promises);
      const msg = resultados.join(' | ');
      setResultado(msg);
      if (resultados.every(r => r.startsWith('✅'))) {
        toast.success(msg);
      } else {
        toast.warning(msg);
      }
    } catch {
      toast.error('Erro ao publicar');
    } finally {
      setStatusPublicacao(null);
      setPublicando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>🚀 Publicar agora — {produto.nome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview de todas as fotos */}
          {allImages.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">
                {isCarousel 
                  ? `📸 ${allImages.length} fotos — será publicado como CARROSSEL` 
                  : '📸 1 foto — post simples'}
              </p>
              <div className="grid grid-cols-5 gap-2">
                {allImages.map((url, i) => (
                  <img 
                    key={i} 
                    src={url} 
                    alt={`Foto ${i + 1}`} 
                    className="w-full aspect-square object-cover rounded-lg border border-border" 
                  />
                ))}
              </div>
            </div>
          )}

          {(carregandoFotos || statusPublicacao) && (
            <div className="rounded-lg border border-border bg-muted p-3 text-sm font-medium">
              {carregandoFotos ? 'Verificando todas as fotos salvas do produto...' : statusPublicacao}
            </div>
          )}

          <div>
            <Label className="mb-1 block text-sm font-medium">Texto do post</Label>
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={6}
              disabled={publicando || carregandoFotos}
            />
          </div>

          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <Checkbox id="fb" checked={facebook} onCheckedChange={(v) => setFacebook(!!v)} disabled={publicando || carregandoFotos} />
              <Label htmlFor="fb">Facebook</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="ig" checked={instagram} onCheckedChange={(v) => setInstagram(!!v)} disabled={publicando || carregandoFotos} />
              <Label htmlFor="ig">Instagram</Label>
            </div>
          </div>

          {resultado && (
            <div className="p-3 rounded-lg bg-muted text-sm font-medium">{resultado}</div>
          )}

          <div className="flex gap-3 justify-end">
            {resultado ? (
              <Button onClick={() => handleOpenChange(false)}>Fechar</Button>
            ) : (
              <Button onClick={handlePublicar} disabled={publicando || carregandoFotos} className="bg-gradient-to-r from-blue-600 to-pink-600 hover:from-blue-700 hover:to-pink-700 text-white">
                {publicando || carregandoFotos ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publicando...</>
                ) : (
                  <>🚀 {isCarousel ? 'Publicar carrossel' : 'Publicar agora'}</>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
