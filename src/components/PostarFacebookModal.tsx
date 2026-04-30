import { useState, useEffect, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CalendarIcon, Sparkles, Loader2, Facebook, Send, Clock, AlertTriangle, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAllProductImages } from "@/components/ProductImageCarousel";
import { useTranslation } from "react-i18next";
import {
  clampTimeForToday,
  combineSaoPauloDateTimeToIso,
  generateTimeOptions,
  getNextFiveMinuteSlot,
  isBeforeTodayInSaoPaulo,
  isSameCalendarDay,
  toTimeString,
} from "@/lib/sao-paulo-time";

interface Produto {
  id: string;
  nome: string;
  descricao?: string | null;
  preco?: number | null;
  imagem_url?: string | null;
  link?: string | null;
  link_marketplace?: string | null;
}

interface PostarFacebookModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produto: Produto;
  /** Quando 'engajamento', habilita Cenário B (escolha Engajamento/Promocional). Default: 'promocional' (Cenário A). */
  modo_postagem_fb?: string | null;
  /** Estilos permitidos pro produto (subset de ESTILOS_ENGAJAMENTO). Filtra o dropdown. */
  engajamento_estilos?: string[] | null;
}

// Mantido em sincronia com src/components/produtos/EngagementModeSelector.tsx
const ESTILOS_ENGAJAMENTO: { id: string; emoji: string; label: string }[] = [
  { id: 'escassez', emoji: '🔥', label: 'Escassez' },
  { id: 'curiosidade', emoji: '❓', label: 'Curiosidade' },
  { id: 'pergunta', emoji: '🤔', label: 'Pergunta' },
  { id: 'polemica', emoji: '⚡', label: 'Polêmica' },
  { id: 'dado', emoji: '📊', label: 'Dado' },
  { id: 'tabu', emoji: '🤫', label: 'Tabu' },
];

// ───────── Cache + rate-limit da pré-visualização (mesma estratégia do EngagementModeSelector) ─────────
const PREVIEW_RATE_LIMIT = 5; // por hora
const PREVIEW_CACHE_MIN = 30;
const previewCacheKey = (id: string) => `engagement_preview_cache:${id}`;
const previewRateKey = (id: string) => `engagement_preview_rate:${id}`;

interface PreviewCacheEntry { caption: string; estilo: string; ts: number }
interface PreviewRateEntry { ts: number }

function loadPreviewCache(id: string): PreviewCacheEntry | null {
  try {
    const raw = localStorage.getItem(previewCacheKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PreviewCacheEntry;
    const ageMin = (Date.now() - parsed.ts) / 60000;
    if (ageMin > PREVIEW_CACHE_MIN) return null;
    return parsed;
  } catch { return null; }
}
function savePreviewCache(id: string, entry: PreviewCacheEntry) {
  try { localStorage.setItem(previewCacheKey(id), JSON.stringify(entry)); } catch { /* ignore */ }
}
function loadPreviewRate(id: string): PreviewRateEntry[] {
  try {
    const raw = localStorage.getItem(previewRateKey(id));
    if (!raw) return [];
    const arr = JSON.parse(raw) as PreviewRateEntry[];
    const cutoff = Date.now() - 60 * 60 * 1000;
    return arr.filter((e) => e.ts > cutoff);
  } catch { return []; }
}
function pushPreviewRate(id: string) {
  const arr = loadPreviewRate(id);
  arr.push({ ts: Date.now() });
  try { localStorage.setItem(previewRateKey(id), JSON.stringify(arr)); } catch { /* ignore */ }
}

export function PostarFacebookModal({
  open,
  onOpenChange,
  produto,
  modo_postagem_fb,
  engajamento_estilos,
}: PostarFacebookModalProps) {
  const { t } = useTranslation();
  const [gerando, setGerando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [opcoes, setOpcoes] = useState<{ opcaoA: string; opcaoB: string; opcaoC: string } | null>(null);
  const [textoPost, setTextoPost] = useState("");
  const [modoEnvio, setModoEnvio] = useState<"agora" | "agendar">("agora");
  const [incluirImagem, setIncluirImagem] = useState(true);
  const linkProduto = produto.link || produto.link_marketplace || null;
  const temLink = !!linkProduto;
  const [incluirLink, setIncluirLink] = useState(temLink);
  const [dataAgendamento, setDataAgendamento] = useState<Date | undefined>();
  const [horaAgendamento, setHoraAgendamento] = useState("10:00");
  const [pageId, setPageId] = useState<string>("");
  const [metaConnected, setMetaConnected] = useState(false);
  const [allImages, setAllImages] = useState<string[]>([]);

  // ── Cenário B: produto está em Modo Engajamento? ──
  const isEngagementProduct = modo_postagem_fb === 'engajamento';

  // Estilos disponíveis no dropdown (filtrados por engajamento_estilos do produto)
  const estilosDisponiveis = useMemo(() => {
    if (!engajamento_estilos || engajamento_estilos.length === 0) {
      return ESTILOS_ENGAJAMENTO; // fallback: todos
    }
    const set = new Set(engajamento_estilos);
    return ESTILOS_ENGAJAMENTO.filter((e) => set.has(e.id));
  }, [engajamento_estilos]);

  // No Cenário B: 'engajamento' é default; user pode trocar pra 'promocional' nesta postagem
  const [modoEscolhido, setModoEscolhido] = useState<'engajamento' | 'promocional'>('promocional');

  // Estilo pra Cenário B: 'aleatorio' | id de estilo
  const [estiloEscolhido, setEstiloEscolhido] = useState<string>('aleatorio');

  // Pré-visualização Engajamento
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewCaption, setPreviewCaption] = useState<string | null>(null);
  const [previewEstilo, setPreviewEstilo] = useState<string | null>(null);
  const [previewFromCache, setPreviewFromCache] = useState(false);

  const loadAllImages = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('produtos')
        .select('imagem_url, imagens')
        .eq('id', produto.id)
        .single();
      if (data) {
        const imgs = getAllProductImages((data as any).imagem_url, (data as any).imagens);
        console.log('📸 Facebook modal - todas as fotos:', imgs);
        setAllImages(imgs);
      }
    } catch (e) {
      const fallback = getAllProductImages(produto.imagem_url || null, (produto as any).imagens);
      setAllImages(fallback);
    }
  }, [produto.id, produto.imagem_url]);

  useEffect(() => {
    if (open) loadAllImages();
  }, [open, loadAllImages]);

  const isCarousel = allImages.length >= 2;

  useEffect(() => {
    const loadPageId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('meta_connections' as any)
        .select('page_id, page_name')
        .eq('user_id', user.id)
        .maybeSingle();
      const connData = data as any;
      if (connData?.page_id) {
        setPageId(connData.page_id);
        setMetaConnected(true);
      }
    };
    if (open) loadPageId();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const nextSlot = getNextFiveMinuteSlot();
    setDataAgendamento(nextSlot);
    setHoraAgendamento(toTimeString(nextSlot));
  }, [open]);

  useEffect(() => {
    if (!open || modoEnvio !== "agendar" || !dataAgendamento) return;
    const adjustedTime = clampTimeForToday(dataAgendamento, horaAgendamento);
    if (adjustedTime !== horaAgendamento) {
      setHoraAgendamento(adjustedTime);
    }
  }, [open, modoEnvio, dataAgendamento, horaAgendamento]);

  // Reset Cenário B sempre que abrir o modal
  useEffect(() => {
    if (!open) return;
    setModoEscolhido(isEngagementProduct ? 'engajamento' : 'promocional');
    setEstiloEscolhido('aleatorio');
    setPreviewCaption(null);
    setPreviewEstilo(null);
    setPreviewFromCache(false);
  }, [open, isEngagementProduct]);

  const handleGerarTexto = async () => {
    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-posts", {
        body: {
          produto: {
            nome: produto.nome,
            preco: produto.preco,
            descricao: produto.descricao || "",
          },
        },
      });
      if (error) throw error;
      const fb = data?.posts?.facebook;
      if (!fb) throw new Error("Nenhum texto gerado para Facebook");
      setOpcoes({ opcaoA: fb.opcaoA, opcaoB: fb.opcaoB, opcaoC: fb.opcaoC });
      toast.success(t('publish.generated_success'));
    } catch (err: any) {
      console.error("Erro ao gerar texto:", err);
      toast.error(err.message || t('publish.error_generate'));
    } finally {
      setGerando(false);
    }
  };

  const selecionarOpcao = (texto: string) => {
    setTextoPost(texto);
  };

  // ── Cenário B: pré-visualização Engajamento (cache + rate-limit) ──
  const handlePreviewEngajamento = async () => {
    if (estilosDisponiveis.length === 0) {
      toast.error('Este produto não tem estilos de engajamento configurados.');
      return;
    }
    // Resolve estilo: se 'aleatorio', sortear entre disponíveis
    const estiloFinal =
      estiloEscolhido === 'aleatorio'
        ? estilosDisponiveis[Math.floor(Math.random() * estilosDisponiveis.length)].id
        : estiloEscolhido;

    // Cache (chave inclui estilo pra não confundir prévias)
    const cacheId = `${produto.id}:${estiloFinal}`;
    const cached = loadPreviewCache(cacheId);
    if (cached) {
      setPreviewCaption(cached.caption);
      setPreviewEstilo(cached.estilo);
      setPreviewFromCache(true);
      return;
    }

    // Rate limit por produto
    const rate = loadPreviewRate(produto.id);
    if (rate.length >= PREVIEW_RATE_LIMIT) {
      const maisAntiga = Math.min(...rate.map((r) => r.ts));
      const liberaEm = maisAntiga + 60 * 60 * 1000;
      const minRest = Math.max(1, Math.ceil((liberaEm - Date.now()) / 60000));
      toast.error(`Limite de prévias atingido. Aguarde ${minRest} min antes de gerar outra.`);
      return;
    }

    setPreviewLoading(true);
    setPreviewFromCache(false);
    try {
      const { data, error } = await supabase.functions.invoke('generate-social-post-engagement', {
        body: { produto_id: produto.id, estilo: estiloFinal },
      });
      if (error) throw error;
      const resp = data as { success?: boolean; caption?: string; estilo?: string; error?: string } | null;
      if (!resp?.success || !resp.caption) {
        throw new Error(resp?.error || 'Falha ao gerar prévia.');
      }
      setPreviewCaption(resp.caption);
      setPreviewEstilo(resp.estilo || estiloFinal);
      savePreviewCache(cacheId, { caption: resp.caption, estilo: resp.estilo || estiloFinal, ts: Date.now() });
      pushPreviewRate(produto.id);
    } catch (err) {
      console.error('[engagement-preview]', err);
      toast.error('Não foi possível gerar a caption. Verifique se o produto tem informações suficientes e tente novamente.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const usarPreviewComoTexto = () => {
    if (previewCaption) {
      setTextoPost(previewCaption);
      toast.success('Caption copiada para o texto da postagem.');
    }
  };

  const handlePublicar = async () => {
    // No Cenário B + modo engajamento: se ainda não tem texto, gerar agora antes de publicar
    let textoFinalBase = textoPost.trim();
    if (isEngagementProduct && modoEscolhido === 'engajamento' && !textoFinalBase) {
      if (!previewCaption) {
        toast.error('Clique em "Pré-visualizar" e use a caption, ou edite o texto manualmente.');
        return;
      }
      textoFinalBase = previewCaption.trim();
    }

    if (!textoFinalBase) {
      toast.error(t('publish.write_text_first'));
      return;
    }

    const mensagemFinal = incluirLink && linkProduto
      ? `${textoFinalBase}\n\n🔗 Compre aqui: ${linkProduto}`
      : textoFinalBase;

    if (modoEnvio === "agendar" && !dataAgendamento) {
      toast.error(t('publish.select_schedule_date'));
      return;
    }

    setPublicando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(t('publish.need_login'));
        return;
      }

      const imagesToPublish = incluirImagem ? allImages : [];

      let scheduledAt: string | null = null;
      if (modoEnvio === "agendar" && dataAgendamento) {
        const horaFinal = clampTimeForToday(dataAgendamento, horaAgendamento);
        scheduledAt = combineSaoPauloDateTimeToIso(dataAgendamento, horaFinal);
      }

      const { error: insertError } = await supabase.from("social_posts_queue" as any).insert({
        user_id: user.id,
        produto_id: produto.id,
        produto_source: "produtos",
        platform: "facebook",
        page_id: pageId || "",
        post_text: mensagemFinal,
        image_url: imagesToPublish[0] || null,
        link_url: incluirLink ? linkProduto : null,
        status: "pendente",
        scheduled_at: scheduledAt,
      } as any);

      if (insertError) throw insertError;

      if (modoEnvio === "agora") {
        if (imagesToPublish.length >= 2) {
          console.log(`📸 Publicando carrossel Facebook com ${imagesToPublish.length} fotos`);
          const { error: pubError } = await supabase.functions.invoke("meta-publish-post", {
            body: {
              message: mensagemFinal,
              user_id: user.id,
              image_urls: imagesToPublish,
            },
          });
          if (pubError) throw pubError;
          toast.success(t('publish.carousel_published_fb', { count: imagesToPublish.length }));
        } else {
          const { data: pubData, error: pubError } = await supabase.functions.invoke("meta-publish-post", {
            body: {
              message: mensagemFinal,
              page_id: pageId || "",
              user_id: user.id,
              image_url: imagesToPublish[0] || undefined,
            },
          });
          if (pubError) throw pubError;
          const postId = pubData?.post_id || pubData?.id || "OK";
          toast.success(t('publish.published_fb', { id: postId }));
        }
      } else {
        const horaFinal = clampTimeForToday(dataAgendamento!, horaAgendamento);
        toast.success(t('publish.scheduled_success', { date: format(dataAgendamento!, "dd/MM/yyyy"), time: horaFinal }));
      }

      setTextoPost("");
      setOpcoes(null);
      setModoEnvio("agora");
      setDataAgendamento(undefined);
      setPreviewCaption(null);
      setPreviewEstilo(null);
      onOpenChange(false);
    } catch (err: any) {
      console.error("Erro ao publicar:", err);
      toast.error(err.message || t('publish.error_fb'));
    } finally {
      setPublicando(false);
    }
  };

  const proximoSlot = getNextFiveMinuteSlot();
  const horas = generateTimeOptions(5);
  const horasDisponiveis = dataAgendamento && isSameCalendarDay(dataAgendamento, proximoSlot)
    ? horas.filter((hora) => hora >= toTimeString(proximoSlot))
    : horas;

  // ── Bloco reusado: gerador Casual/Informativo/IA (Cenário A inteiro + Cenário B quando Promocional) ──
  const blocoPromocional = (
    <>
      <Button onClick={handleGerarTexto} disabled={gerando} variant="outline" className="w-full gap-2">
        {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {gerando ? t('publish.generating') : t('publish.generate_ai')}
      </Button>

      {opcoes && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t('publish.choose_option')}</Label>
          <div className="grid gap-2">
            {(["opcaoA", "opcaoB", "opcaoC"] as const).map((key, i) => (
              <Card
                key={key}
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md",
                  textoPost === opcoes[key] && "ring-2 ring-primary"
                )}
                onClick={() => selecionarOpcao(opcoes[key])}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="shrink-0 mt-0.5">
                      {[t('publish.option_casual'), t('publish.option_informative'), t('publish.option_urgent')][i]}
                    </Badge>
                    <p className="text-sm line-clamp-3">{opcoes[key]}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </>
  );

  // ── Bloco Engajamento (apenas Cenário B + quando modoEscolhido === 'engajamento') ──
  const blocoEngajamento = (
    <div className="space-y-3 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Estilo da caption</Label>
        <Select value={estiloEscolhido} onValueChange={setEstiloEscolhido}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="aleatorio">🎲 Aleatório (sortear na hora)</SelectItem>
            {estilosDisponiveis.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.emoji} {e.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {estilosDisponiveis.length === 0 && (
          <p className="text-xs text-destructive">
            Nenhum estilo configurado pra este produto. Abra "⚙️ Modo de postagem FB" e selecione ao menos 1.
          </p>
        )}
      </div>

      <Button
        onClick={handlePreviewEngajamento}
        disabled={previewLoading || estilosDisponiveis.length === 0}
        variant="outline"
        className="w-full gap-2"
      >
        {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
        {previewLoading ? 'Gerando prévia...' : 'Pré-visualizar caption'}
      </Button>

      {previewCaption && (
        <Card className="border-blue-500/40">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-[10px]">
                Estilo: {previewEstilo}
              </Badge>
              {previewFromCache && (
                <Badge variant="secondary" className="text-[10px]">cache</Badge>
              )}
            </div>
            <p className="text-sm whitespace-pre-wrap">{previewCaption}</p>
            <Button size="sm" variant="secondary" onClick={usarPreviewComoTexto} className="w-full">
              Usar esta caption
            </Button>
          </CardContent>
        </Card>
      )}

      <p className="text-[11px] text-muted-foreground">
        Modo Engajamento gera captions sem cifras de preço. Limite: 5 prévias por hora por produto.
      </p>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-x-hidden overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Facebook className="h-5 w-5 text-blue-600" />
            {t('publish.post_to_facebook')}
            {isEngagementProduct && (
              <Badge variant="outline" className="ml-2 text-[10px] border-blue-500/40 text-blue-700 dark:text-blue-300">
                ENGAJAMENTO
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>{t('publish.post_to_facebook_desc')}</DialogDescription>
        </DialogHeader>

        {!metaConnected && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-300">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              {t('publish.connect_facebook_warning')}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg overflow-hidden">
            {allImages[0] && (
              <img src={allImages[0]} alt={produto.nome} className="w-16 h-16 object-cover rounded" />
            )}
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="font-medium break-words line-clamp-2">{produto.nome}</p>
              {produto.preco && (
                <p className="text-primary font-bold">R$ {produto.preco.toFixed(2)}</p>
              )}
            </div>
          </div>
          {allImages.length > 0 && incluirImagem && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                {isCarousel
                  ? t('publish.carousel_info', { count: allImages.length })
                  : t('publish.single_photo_info')}
              </p>
              <div className="grid grid-cols-5 gap-2">
                {allImages.map((url, i) => (
                  <img key={i} src={url} alt={`Foto ${i+1}`} className="w-full aspect-square object-cover rounded border" />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ───────── Cenário B: escolha do modo de postagem ───────── */}
        {isEngagementProduct && (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <Label className="text-sm font-medium">Como você quer publicar este post?</Label>
            <RadioGroup
              value={modoEscolhido}
              onValueChange={(v) => setModoEscolhido(v as 'engajamento' | 'promocional')}
              className="space-y-2"
            >
              <label
                htmlFor="modo-eng"
                className="flex items-start gap-3 rounded-md border border-border p-2 cursor-pointer hover:bg-muted/40"
              >
                <RadioGroupItem value="engajamento" id="modo-eng" className="mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium">🎯 Modo Engajamento</div>
                  <div className="text-muted-foreground text-xs">
                    Caption sem preço, focada no estilo escolhido.
                  </div>
                </div>
              </label>
              <label
                htmlFor="modo-promo"
                className="flex items-start gap-3 rounded-md border border-border p-2 cursor-pointer hover:bg-muted/40"
              >
                <RadioGroupItem value="promocional" id="modo-promo" className="mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium">💰 Modo Promocional</div>
                  <div className="text-muted-foreground text-xs">
                    Caption tradicional Casual / Informativa / IA.
                  </div>
                </div>
              </label>
            </RadioGroup>
          </div>
        )}

        {/* ───────── Bloco condicional: Engajamento ou Promocional ───────── */}
        {isEngagementProduct && modoEscolhido === 'engajamento' ? blocoEngajamento : blocoPromocional}

        <div className="space-y-2">
          <Label>{t('publish.post_text')}</Label>
          <Textarea
            value={textoPost}
            onChange={(e) => setTextoPost(e.target.value)}
            placeholder={t('publish.post_text_placeholder')}
            rows={5}
          />
          <p className="text-xs text-muted-foreground">{textoPost.length} {t('publish.character_count')}</p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="incluir-imagem"
                checked={incluirImagem}
                onCheckedChange={(c) => setIncluirImagem(!!c)}
              />
              <Label htmlFor="incluir-imagem" className="text-sm cursor-pointer">
                {t('publish.include_product_image')}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="incluir-link"
                checked={incluirLink}
                onCheckedChange={(c) => setIncluirLink(!!c)}
                disabled={!temLink}
              />
              <Label htmlFor="incluir-link" className={cn("text-sm cursor-pointer", !temLink && "text-muted-foreground")}>
                {temLink ? t('publish.include_product_link') : t('publish.no_link_available')}
              </Label>
            </div>
          </div>

          <RadioGroup value={modoEnvio} onValueChange={(v) => setModoEnvio(v as "agora" | "agendar")}>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="agora" id="agora" />
                <Label htmlFor="agora" className="cursor-pointer flex items-center gap-1">
                  <Send className="h-3 w-3" /> {t('publish.post_now_btn')}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="agendar" id="agendar" />
                <Label htmlFor="agendar" className="cursor-pointer flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {t('publish.schedule_btn')}
                </Label>
              </div>
            </div>
          </RadioGroup>

          {modoEnvio === "agendar" && (
            <div className="flex items-center gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-[200px] justify-start text-left font-normal", !dataAgendamento && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataAgendamento ? format(dataAgendamento, "dd/MM/yyyy") : t('publish.select_date')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataAgendamento}
                    onSelect={(date) => {
                      setDataAgendamento(date);
                      if (date) {
                        setHoraAgendamento(clampTimeForToday(date, horaAgendamento));
                      }
                    }}
                    disabled={(date) => isBeforeTodayInSaoPaulo(date)}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              <Select value={horaAgendamento} onValueChange={setHoraAgendamento}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {horasDisponiveis.map((h) => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <Button
          onClick={handlePublicar}
          disabled={
            publicando ||
            (
              !textoPost.trim() &&
              !(isEngagementProduct && modoEscolhido === 'engajamento' && !!previewCaption)
            )
          }
          className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
        >
          {publicando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Facebook className="h-4 w-4" />
          )}
          {publicando
            ? t('publish.publishing')
            : modoEnvio === "agora"
              ? isCarousel ? t('publish.publish_carousel', { count: allImages.length }) : t('publish.publish_facebook')
              : t('publish.schedule_publication')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
