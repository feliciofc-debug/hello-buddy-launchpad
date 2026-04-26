import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AlertTriangle, Eye, Info, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type Modo = 'promocional' | 'engajamento';

interface EstiloOpcao {
  id: string;
  emoji: string;
  label: string;
  descricao?: string;
}

const ESTILOS: EstiloOpcao[] = [
  { id: 'escassez', emoji: '🔥', label: 'Escassez' },
  { id: 'curiosidade', emoji: '❓', label: 'Curiosidade' },
  { id: 'pergunta', emoji: '🤔', label: 'Pergunta' },
  { id: 'polemica', emoji: '⚡', label: 'Polêmica' },
  { id: 'dado', emoji: '📊', label: 'Dado' },
  {
    id: 'tabu',
    emoji: '🤫',
    label: 'Tabu',
    descricao:
      'Estilo mais ousado: aborda assuntos pouco falados sobre o produto. Útil para quebrar objeções ocultas, mas use com produtos onde isso faça sentido.',
  },
];

interface ProdutoMin {
  id: string;
  nome: string;
  modo_postagem_fb?: string | null;
  engajamento_estilos?: string[] | null;
  usa_textos_personalizados?: boolean | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produto: ProdutoMin | null;
  onSaved?: (
    produtoId: string,
    modo: Modo,
    estilos: string[],
  ) => void;
}

const PREVIEW_RATE_LIMIT = 5; // por hora
const PREVIEW_CACHE_MIN = 30;

interface PreviewCacheEntry {
  caption: string;
  estilo: string;
  ts: number; // ms
}

interface PreviewRateEntry {
  ts: number; // ms
}

function getPreviewCacheKey(produtoId: string) {
  return `engagement_preview_cache:${produtoId}`;
}
function getPreviewRateKey(produtoId: string) {
  return `engagement_preview_rate:${produtoId}`;
}

function loadCache(produtoId: string): PreviewCacheEntry | null {
  try {
    const raw = localStorage.getItem(getPreviewCacheKey(produtoId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PreviewCacheEntry;
    const ageMin = (Date.now() - parsed.ts) / 60000;
    if (ageMin > PREVIEW_CACHE_MIN) return null;
    return parsed;
  } catch {
    return null;
  }
}
function saveCache(produtoId: string, entry: PreviewCacheEntry) {
  try {
    localStorage.setItem(getPreviewCacheKey(produtoId), JSON.stringify(entry));
  } catch {
    // ignore
  }
}

function loadRate(produtoId: string): PreviewRateEntry[] {
  try {
    const raw = localStorage.getItem(getPreviewRateKey(produtoId));
    if (!raw) return [];
    const arr = JSON.parse(raw) as PreviewRateEntry[];
    const cutoff = Date.now() - 60 * 60 * 1000;
    return arr.filter((e) => e.ts > cutoff);
  } catch {
    return [];
  }
}
function pushRate(produtoId: string) {
  const arr = loadRate(produtoId);
  arr.push({ ts: Date.now() });
  try {
    localStorage.setItem(getPreviewRateKey(produtoId), JSON.stringify(arr));
  } catch {
    // ignore
  }
}

export function EngagementModeSelector({
  open,
  onOpenChange,
  produto,
  onSaved,
}: Props) {
  const [modo, setModo] = useState<Modo>('promocional');
  const [estilosSelecionados, setEstilosSelecionados] = useState<string[]>(
    ESTILOS.map((e) => e.id),
  );
  const [salvando, setSalvando] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewCaption, setPreviewCaption] = useState<string | null>(null);
  const [previewEstilo, setPreviewEstilo] = useState<string | null>(null);
  const [previewFromCache, setPreviewFromCache] = useState(false);

  // Sync state quando produto muda / modal abre
  useEffect(() => {
    if (!produto || !open) return;
    const modoInicial: Modo =
      produto.modo_postagem_fb === 'engajamento' ? 'engajamento' : 'promocional';
    setModo(modoInicial);
    const estilos =
      produto.engajamento_estilos && produto.engajamento_estilos.length > 0
        ? produto.engajamento_estilos
        : ESTILOS.map((e) => e.id);
    setEstilosSelecionados(estilos);
    setPreviewCaption(null);
    setPreviewEstilo(null);
    setPreviewFromCache(false);
  }, [produto, open]);

  const temTextoPersonalizado = !!produto?.usa_textos_personalizados;

  const toggleEstilo = (id: string, checked: boolean) => {
    setEstilosSelecionados((prev) =>
      checked ? Array.from(new Set([...prev, id])) : prev.filter((e) => e !== id),
    );
  };

  const podeSalvar = useMemo(() => {
    if (modo === 'promocional') return true;
    return estilosSelecionados.length >= 1;
  }, [modo, estilosSelecionados]);

  const handleSalvar = async () => {
    if (!produto) return;
    if (modo === 'engajamento' && estilosSelecionados.length === 0) {
      toast.error('Selecione pelo menos 1 estilo para o Modo Engajamento.');
      return;
    }
    setSalvando(true);
    try {
      const update: Record<string, unknown> = {
        modo_postagem_fb: modo,
      };
      if (modo === 'engajamento') {
        update.engajamento_estilos = estilosSelecionados;
      }
      const { error } = await supabase
        .from('produtos')
        .update(update)
        .eq('id', produto.id);
      if (error) throw error;
      toast.success('Modo de postagem salvo.');
      onSaved?.(produto.id, modo, estilosSelecionados);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar.';
      toast.error(msg);
    } finally {
      setSalvando(false);
    }
  };

  const handlePreview = async () => {
    if (!produto) return;
    if (modo !== 'engajamento') {
      toast.info('Pré-visualização disponível apenas no Modo Engajamento.');
      return;
    }
    if (estilosSelecionados.length === 0) {
      toast.error('Selecione pelo menos 1 estilo para gerar a prévia.');
      return;
    }

    // Cache primeiro
    const cached = loadCache(produto.id);
    if (cached) {
      setPreviewCaption(cached.caption);
      setPreviewEstilo(cached.estilo);
      setPreviewFromCache(true);
      return;
    }

    // Rate limit
    const rate = loadRate(produto.id);
    if (rate.length >= PREVIEW_RATE_LIMIT) {
      const maisAntiga = Math.min(...rate.map((r) => r.ts));
      const liberaEm = maisAntiga + 60 * 60 * 1000;
      const minRest = Math.max(1, Math.ceil((liberaEm - Date.now()) / 60000));
      toast.error(
        `Limite de prévias atingido. Aguarde ${minRest} min antes de gerar outra.`,
      );
      return;
    }

    setPreviewLoading(true);
    setPreviewFromCache(false);
    try {
      // Sortear um estilo dentre os selecionados pra prévia
      const estiloSorteado =
        estilosSelecionados[
          Math.floor(Math.random() * estilosSelecionados.length)
        ];
      const { data, error } = await supabase.functions.invoke(
        'generate-social-post-engagement',
        {
          body: {
            produto_id: produto.id,
            estilo: estiloSorteado,
          },
        },
      );
      if (error) throw error;
      const resp = data as
        | { success?: boolean; caption?: string; estilo?: string; error?: string }
        | null;
      if (!resp?.success || !resp.caption) {
        throw new Error(resp?.error || 'Falha ao gerar prévia.');
      }
      setPreviewCaption(resp.caption);
      setPreviewEstilo(resp.estilo || estiloSorteado);
      saveCache(produto.id, {
        caption: resp.caption,
        estilo: resp.estilo || estiloSorteado,
        ts: Date.now(),
      });
      pushRate(produto.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar prévia.';
      toast.error(msg);
    } finally {
      setPreviewLoading(false);
    }
  };

  if (!produto) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Modo de postagem no Facebook</DialogTitle>
          <DialogDescription className="truncate">
            Produto: <span className="font-medium">{produto.nome}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <RadioGroup
            value={modo}
            onValueChange={(v) => setModo(v as Modo)}
            className="space-y-2"
          >
            <label
              htmlFor="modo-promocional"
              className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-muted/40"
            >
              <RadioGroupItem
                value="promocional"
                id="modo-promocional"
                className="mt-0.5"
              />
              <div>
                <div className="font-medium">📢 Modo Promocional (padrão)</div>
                <div className="text-xs text-muted-foreground">
                  Posts focados em oferta, desconto e link direto.
                </div>
              </div>
            </label>
            <label
              htmlFor="modo-engajamento"
              className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-muted/40"
            >
              <RadioGroupItem
                value="engajamento"
                id="modo-engajamento"
                className="mt-0.5"
              />
              <div>
                <div className="font-medium">🎯 Modo Engajamento</div>
                <div className="text-xs text-muted-foreground">
                  Posts em estilos de copywriting variados, sorteados a cada
                  publicação.
                </div>
              </div>
            </label>
          </RadioGroup>

          {modo === 'engajamento' && temTextoPersonalizado && (
            <div className="flex items-start gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
              <div className="text-yellow-800 dark:text-yellow-200">
                Este produto tem <strong>textos personalizados</strong> ativos.
                No Modo Engajamento, os textos personalizados são ignorados — a
                IA gera a copy a partir dos estilos selecionados.
              </div>
            </div>
          )}

          {modo === 'engajamento' && (
            <div className="space-y-2">
              <Label className="text-sm">
                Estilos permitidos (sorteados a cada post)
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {ESTILOS.map((estilo) => {
                  const checked = estilosSelecionados.includes(estilo.id);
                  return (
                    <div
                      key={estilo.id}
                      className="flex items-center gap-2 rounded-md border border-border px-2 py-2"
                    >
                      <Checkbox
                        id={`estilo-${estilo.id}`}
                        checked={checked}
                        onCheckedChange={(v) =>
                          toggleEstilo(estilo.id, v === true)
                        }
                      />
                      <label
                        htmlFor={`estilo-${estilo.id}`}
                        className="text-sm flex items-center gap-1 cursor-pointer select-none"
                      >
                        <span>{estilo.emoji}</span>
                        <span>{estilo.label}</span>
                      </label>
                      {estilo.descricao && (
                        <TooltipProvider delayDuration={150}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="ml-auto text-muted-foreground hover:text-foreground"
                                aria-label={`Sobre ${estilo.label}`}
                              >
                                <Info className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              {estilo.descricao}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  );
                })}
              </div>
              {estilosSelecionados.length === 0 && (
                <p className="text-xs text-destructive">
                  Selecione pelo menos 1 estilo.
                </p>
              )}
            </div>
          )}

          {previewCaption && (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-2">
                <span>
                  Prévia — estilo:{' '}
                  <strong className="text-foreground">{previewEstilo}</strong>
                </span>
                {previewFromCache && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                    cache
                  </span>
                )}
              </div>
              <pre className="whitespace-pre-wrap font-sans text-foreground leading-relaxed">
                {previewCaption}
              </pre>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between flex-wrap">
          <Button
            type="button"
            variant="outline"
            onClick={handlePreview}
            disabled={
              modo !== 'engajamento' ||
              previewLoading ||
              estilosSelecionados.length === 0
            }
            className="gap-2"
          >
            {previewLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            Pré-visualizar
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSalvar}
              disabled={!podeSalvar || salvando}
            >
              {salvando ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EngagementModeSelector;
