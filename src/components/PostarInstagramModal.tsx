import { useState, useEffect, useCallback } from "react";
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
import { CalendarIcon, Sparkles, Loader2, Instagram, Send, Clock, AlertTriangle, ImageIcon } from "lucide-react";
import { getAllProductImages } from "@/components/ProductImageCarousel";
import { cn } from "@/lib/utils";
import { adjustImagesForInstagram, FORMAT_LABELS, type AdjustedImage } from "@/lib/adjustImageForInstagram";
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

interface PostarInstagramModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produto: Produto;
}

export function PostarInstagramModal({ open, onOpenChange, produto }: PostarInstagramModalProps) {
  const { t } = useTranslation();
  const [gerando, setGerando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [opcoes, setOpcoes] = useState<{ opcaoA: string; opcaoB: string; opcaoC: string } | null>(null);
  const [textoPost, setTextoPost] = useState("");
  const [modoEnvio, setModoEnvio] = useState<"agora" | "agendar">("agora");
  const linkProduto = produto.link || produto.link_marketplace || null;
  const temLink = !!linkProduto;
  const [incluirLink, setIncluirLink] = useState(temLink);
  const [dataAgendamento, setDataAgendamento] = useState<Date | undefined>();
  const [horaAgendamento, setHoraAgendamento] = useState("10:00");
  const [pageId, setPageId] = useState<string>("");
  const [igConnected, setIgConnected] = useState(false);
  const [igUsername, setIgUsername] = useState<string>("");
  const [allImages, setAllImages] = useState<string[]>([]);
  const [ajusteAuto, setAjusteAuto] = useState(true);
  const [adjustedImages, setAdjustedImages] = useState<AdjustedImage[] | null>(null);
  const [ajustando, setAjustando] = useState(false);

  const loadAllImages = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('produtos')
        .select('imagem_url, imagens')
        .eq('id', produto.id)
        .single();
      if (data) {
        const imgs = getAllProductImages((data as any).imagem_url, (data as any).imagens);
        console.log('📸 Instagram modal - todas as fotos:', imgs);
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

  useEffect(() => {
    if (!open || allImages.length === 0) {
      setAdjustedImages(null);
      return;
    }
    if (!ajusteAuto) {
      setAdjustedImages(null);
      return;
    }
    let cancelled = false;
    setAjustando(true);
    adjustImagesForInstagram(allImages)
      .then((result) => {
        if (!cancelled) setAdjustedImages(result);
      })
      .catch((err) => {
        console.error('Erro ao ajustar imagens:', err);
        if (!cancelled) setAdjustedImages(null);
      })
      .finally(() => {
        if (!cancelled) setAjustando(false);
      });
    return () => { cancelled = true; };
  }, [open, allImages, ajusteAuto]);

  const isCarousel = allImages.length >= 2;
  const temImagem = allImages.length > 0;

  useEffect(() => {
    const loadIgData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('meta_connections' as any)
        .select('page_id, ig_account_id, ig_username')
        .eq('user_id', user.id)
        .maybeSingle();
      const connData = data as any;
      if (connData?.ig_account_id) {
        setPageId(connData.page_id || "");
        setIgConnected(true);
        setIgUsername(connData.ig_username || "");
      }
    };
    if (open) loadIgData();
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
      const ig = data?.posts?.instagram;
      if (!ig) throw new Error("Nenhum texto gerado para Instagram");
      setOpcoes({ opcaoA: ig.opcaoA, opcaoB: ig.opcaoB, opcaoC: ig.opcaoC });
      toast.success(t('publish.generated_ig_success'));
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

  const handlePublicar = async () => {
    if (!textoPost.trim()) {
      toast.error(t('publish.write_text_first'));
      return;
    }

    if (allImages.length === 0) {
      toast.error(t('publish.ig_requires_image'));
      return;
    }

    const captionFinal = incluirLink && linkProduto
      ? `${textoPost.trim()}\n\n🔗 Link na bio ou acesse: ${linkProduto}`
      : textoPost.trim();

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

      let finalImageUrls = allImages;
      if (ajusteAuto && adjustedImages && adjustedImages.length > 0) {
        toast.info(t('publish.adjusting_images'));
        const uploadedUrls: string[] = [];
        for (let i = 0; i < adjustedImages.length; i++) {
          const adj = adjustedImages[i];
          const fname = `${user.id}/ig-adjusted/${Date.now()}-${i}.jpg`;
          const { error: upErr } = await supabase.storage
            .from("produtos")
            .upload(fname, adj.blob, { contentType: "image/jpeg" });
          if (upErr) throw upErr;
          const { data: urlData } = supabase.storage.from("produtos").getPublicUrl(fname);
          uploadedUrls.push(urlData.publicUrl);
        }
        finalImageUrls = uploadedUrls;
      }

      let scheduledAt: string | null = null;
      if (modoEnvio === "agendar" && dataAgendamento) {
        const horaFinal = clampTimeForToday(dataAgendamento, horaAgendamento);
        scheduledAt = combineSaoPauloDateTimeToIso(dataAgendamento, horaFinal);
      }

      const { error: insertError } = await supabase.from("social_posts_queue" as any).insert({
        user_id: user.id,
        produto_id: produto.id,
        produto_source: "produtos",
        platform: "instagram",
        page_id: pageId || "",
        post_text: captionFinal,
        image_url: finalImageUrls[0] || null,
        link_url: incluirLink ? linkProduto : null,
        status: "pendente",
        scheduled_at: scheduledAt,
      } as any);

      if (insertError) throw insertError;

      if (modoEnvio === "agora") {
        if (finalImageUrls.length >= 2) {
          console.log(`📸 Publicando carrossel Instagram com ${finalImageUrls.length} fotos`);
          const { data: pubData, error: pubError } = await supabase.functions.invoke("meta-publish-carousel", {
            body: {
              caption: captionFinal,
              image_urls: finalImageUrls,
              user_id: user.id,
            },
          });
          if (pubError) throw pubError;
          if (!pubData?.success) throw new Error(pubData?.error || "Erro ao publicar carrossel");
          toast.success(t('publish.carousel_published_ig', { count: finalImageUrls.length }));
        } else {
          const { data: pubData, error: pubError } = await supabase.functions.invoke("meta-publish-instagram", {
            body: {
              caption: captionFinal,
              image_url: finalImageUrls[0],
              user_id: user.id,
            },
          });
          if (pubError) throw pubError;
          if (!pubData?.success) throw new Error(pubData?.error || "Erro ao publicar no Instagram");
          toast.success(t('publish.published_ig'));
        }
      } else {
        const horaFinal = clampTimeForToday(dataAgendamento!, horaAgendamento);
        toast.success(t('publish.scheduled_success', { date: format(dataAgendamento!, "dd/MM/yyyy"), time: horaFinal }));
      }

      setTextoPost("");
      setOpcoes(null);
      setModoEnvio("agora");
      setDataAgendamento(undefined);
      onOpenChange(false);
    } catch (err: any) {
      console.error("Erro ao publicar no Instagram:", err);
      toast.error(err.message || t('publish.error_ig'));
    } finally {
      setPublicando(false);
    }
  };

  const proximoSlot = getNextFiveMinuteSlot();
  const horas = generateTimeOptions(5);
  const horasDisponiveis = dataAgendamento && isSameCalendarDay(dataAgendamento, proximoSlot)
    ? horas.filter((hora) => hora >= toTimeString(proximoSlot))
    : horas;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-x-hidden overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Instagram className="h-5 w-5 text-pink-600" />
            {t('publish.post_to_instagram')}
          </DialogTitle>
          <DialogDescription>
            {igConnected
              ? t('publish.post_to_instagram_connected', { username: igUsername || "conectado" })
              : t('publish.post_to_instagram_desc')}
          </DialogDescription>
        </DialogHeader>

        {!igConnected && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-300">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              {t('publish.connect_instagram_warning')}
            </p>
          </div>
        )}

        {!temImagem && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
            <p className="text-sm text-destructive">
              {t('publish.no_image_warning')}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 overflow-hidden">
            {allImages[0] && (
              <img src={allImages[0]} alt={produto.nome} className="w-16 h-16 rounded-lg object-cover" />
            )}
            <div className="min-w-0 overflow-hidden">
              <p className="font-medium text-sm break-words line-clamp-2">{produto.nome}</p>
              {produto.preco && (
                <p className="text-sm text-muted-foreground">R$ {produto.preco.toFixed(2)}</p>
              )}
            </div>
          </div>
          {allImages.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {isCarousel
                  ? t('publish.carousel_info', { count: allImages.length })
                  : t('publish.single_photo_info')}
              </p>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="ajuste-auto-ig"
                  checked={ajusteAuto}
                  onCheckedChange={(c) => setAjusteAuto(!!c)}
                />
                <Label htmlFor="ajuste-auto-ig" className="text-xs cursor-pointer flex items-center gap-1">
                  <ImageIcon className="h-3 w-3" />
                  {t('publish.adjust_auto_label')}
                </Label>
              </div>

              {ajusteAuto && ajustando && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t('publish.adjusting')}
                </div>
              )}

              {ajusteAuto && adjustedImages && adjustedImages.length > 0 ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    ✅ Preview ajustado — {FORMAT_LABELS[adjustedImages[0].format]}
                  </p>
                  <div className="grid grid-cols-5 gap-2">
                    {adjustedImages.map((adj, i) => (
                      <img key={i} src={adj.dataUrl} alt={`Ajustada ${i+1}`} className="w-full aspect-square object-contain rounded border bg-black" />
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  {!ajusteAuto && (
                    <p className="text-xs text-amber-600 mb-1">{t('publish.original_warning')}</p>
                  )}
                  <div className="grid grid-cols-5 gap-2">
                    {allImages.map((url, i) => (
                      <img key={i} src={url} alt={`Foto ${i+1}`} className="w-full aspect-square object-cover rounded border" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <Button onClick={handleGerarTexto} disabled={gerando} variant="outline" className="w-full gap-2">
          {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {gerando ? t('publish.generating') : t('publish.generate_ai')}
        </Button>

        {opcoes && (
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('publish.choose_option')}</p>
            <div className="space-y-2">
              {(["opcaoA", "opcaoB", "opcaoC"] as const).map((key, i) => (
                <Card
                  key={key}
                  className="cursor-pointer hover:border-pink-400 transition-colors"
                  onClick={() => selecionarOpcao(opcoes[key])}
                >
                  <CardContent className="p-3">
                    <div className="space-y-1">
                      <Badge variant="outline" className="text-xs">
                        {[t('publish.option_direct'), t('publish.option_storytelling'), t('publish.option_educational')][i]}
                      </Badge>
                      <p className="text-sm">{opcoes[key]}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label>{t('publish.caption_label')}</Label>
          <Textarea
            value={textoPost}
            onChange={(e) => setTextoPost(e.target.value)}
            placeholder={t('publish.caption_placeholder')}
            rows={5}
          />
          <p className="text-xs text-muted-foreground">{textoPost.length} / 2.200 {t('publish.character_count')}</p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="incluir-link-ig"
                checked={incluirLink}
                onCheckedChange={(c) => setIncluirLink(!!c)}
                disabled={!temLink}
              />
              <Label htmlFor="incluir-link-ig" className={cn("text-sm cursor-pointer", !temLink && "text-muted-foreground")}>
                {temLink ? t('publish.include_link_caption') : t('publish.no_link_available')}
              </Label>
            </div>
          </div>

          <RadioGroup value={modoEnvio} onValueChange={(v) => setModoEnvio(v as "agora" | "agendar")}>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="agora" id="agora-ig" />
                <Label htmlFor="agora-ig" className="cursor-pointer flex items-center gap-1">
                  <Send className="h-3 w-3" /> {t('publish.post_now_btn')}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="agendar" id="agendar-ig" />
                <Label htmlFor="agendar-ig" className="cursor-pointer flex items-center gap-1">
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
          disabled={publicando || !textoPost.trim() || !temImagem}
          className="w-full gap-2 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 hover:from-purple-700 hover:via-pink-700 hover:to-orange-600 text-white"
        >
          {publicando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Instagram className="h-4 w-4" />
          )}
          {publicando
            ? t('publish.publishing')
            : modoEnvio === "agora"
              ? isCarousel ? t('publish.publish_carousel', { count: allImages.length }) : t('publish.publish_instagram')
              : t('publish.schedule_publication')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
