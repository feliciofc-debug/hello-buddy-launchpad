import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  CalendarIcon,
  Clock,
  Eye,
  Facebook,
  ImageIcon,
  Instagram,
  Loader2,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useEngagementPostComposer } from "@/hooks/useEngagementPostComposer";
import { supabase } from "@/integrations/supabase/client";
import { adjustImagesForInstagram, FORMAT_LABELS, type AdjustedImage } from "@/lib/adjustImageForInstagram";
import { cn } from "@/lib/utils";
import {
  clampTimeForToday,
  combineSaoPauloDateTimeToIso,
  generateTimeOptions,
  getNextFiveMinuteSlot,
  isBeforeTodayInSaoPaulo,
  isSameCalendarDay,
  toTimeString,
} from "@/lib/sao-paulo-time";
import {
  createSocialPostQueueEntry,
  markSocialPostFailed,
  markSocialPostPublished,
} from "@/lib/social-post-queue";

interface Produto {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number | null;
  imagem_url: string | null;
  link?: string | null;
  link_marketplace?: string | null;
  imagens?: unknown;
  modo_postagem_fb?: string | null;
  engajamento_estilos?: string[] | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produto: Produto;
}

type GeneratedOptions = { opcaoA: string; opcaoB: string; opcaoC: string };
type NetworkResult = { network: "Facebook" | "Instagram"; ok: boolean; scheduled: boolean; error?: string };

function normalizeStoredImages(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(normalizeStoredImages);
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        return normalizeStoredImages(JSON.parse(trimmed));
      } catch {
        return [trimmed];
      }
    }
    return [trimmed];
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["imagens", "image_urls", "photos", "urls"]) {
      if (key in record) return normalizeStoredImages(record[key]);
    }
  }
  return [];
}

function getAllImageUrls(produto: Pick<Produto, "imagem_url" | "imagens">): string[] {
  return [...new Set([
    ...(produto.imagem_url?.trim() ? [produto.imagem_url.trim()] : []),
    ...normalizeStoredImages(produto.imagens),
  ])].slice(0, 5);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || "Erro ao publicar");
}

export function PublicarSimultaneoModal({ open, onOpenChange, produto }: Props) {
  const linkProduto = produto.link || produto.link_marketplace || null;
  const [textoPost, setTextoPost] = useState("");
  const [opcoes, setOpcoes] = useState<GeneratedOptions | null>(null);
  const [gerando, setGerando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [facebook, setFacebook] = useState(true);
  const [instagram, setInstagram] = useState(true);
  const [incluirImagem, setIncluirImagem] = useState(true);
  const [incluirLink, setIncluirLink] = useState(!!linkProduto);
  const [modoEnvio, setModoEnvio] = useState<"agora" | "agendar">("agora");
  const [dataAgendamento, setDataAgendamento] = useState<Date>();
  const [horaAgendamento, setHoraAgendamento] = useState("10:00");
  const [allImages, setAllImages] = useState(() => getAllImageUrls(produto));
  const [carregandoFotos, setCarregandoFotos] = useState(false);
  const [ajusteAuto, setAjusteAuto] = useState(true);
  const [adjustedImages, setAdjustedImages] = useState<AdjustedImage[] | null>(null);
  const [ajustando, setAjustando] = useState(false);
  const [pageId, setPageId] = useState("");
  const [facebookConnected, setFacebookConnected] = useState(false);
  const [instagramConnected, setInstagramConnected] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  const {
    mode,
    setMode,
    style,
    setStyle,
    styles,
    previewLoading,
    previewCaption,
    previewStyle,
    previewFromCache,
    generatePreview,
  } = useEngagementPostComposer({
    open,
    productId: produto.id,
    initialMode: produto.modo_postagem_fb === "engajamento" ? "engajamento" : "promocional",
    allowedStyles: produto.engajamento_estilos,
  });

  const loadLatestProductImages = useCallback(async () => {
    setCarregandoFotos(true);
    try {
      const { data, error } = await supabase
        .from("produtos")
        .select("imagem_url, imagens")
        .eq("id", produto.id)
        .single();
      if (error) throw error;
      const images = getAllImageUrls({ imagem_url: data?.imagem_url ?? null, imagens: data?.imagens });
      setAllImages(images);
      return images;
    } catch (error) {
      console.error("[simultaneous-post] erro ao carregar fotos", error);
      const fallback = getAllImageUrls(produto);
      setAllImages(fallback);
      return fallback;
    } finally {
      setCarregandoFotos(false);
    }
  }, [produto]);

  useEffect(() => {
    if (!open) return;
    const nextSlot = getNextFiveMinuteSlot();
    setTextoPost("");
    setOpcoes(null);
    setFacebook(true);
    setInstagram(true);
    setIncluirImagem(true);
    setIncluirLink(!!linkProduto);
    setModoEnvio("agora");
    setDataAgendamento(nextSlot);
    setHoraAgendamento(toTimeString(nextSlot));
    setAjusteAuto(true);
    setResultado(null);
    void loadLatestProductImages();
  }, [open, linkProduto, loadLatestProductImages]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("meta_connections")
        .select("page_id, ig_account_id")
        .eq("user_id", user.id)
        .maybeSingle();
      const connection = data as { page_id?: string; ig_account_id?: string } | null;
      setPageId(connection?.page_id || "");
      setFacebookConnected(!!connection?.page_id);
      setInstagramConnected(!!connection?.ig_account_id);
    })();
  }, [open]);

  useEffect(() => {
    if (!open || !instagram || !incluirImagem || !ajusteAuto || !allImages.length) {
      setAdjustedImages(null);
      return;
    }
    let cancelled = false;
    setAjustando(true);
    adjustImagesForInstagram(allImages)
      .then((images) => {
        if (!cancelled) setAdjustedImages(images);
      })
      .catch((error) => {
        console.error("[simultaneous-post] erro no preview ajustado", error);
        if (!cancelled) setAdjustedImages(null);
      })
      .finally(() => {
        if (!cancelled) setAjustando(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, instagram, incluirImagem, ajusteAuto, allImages]);

  useEffect(() => {
    if (!open || modoEnvio !== "agendar" || !dataAgendamento) return;
    const adjusted = clampTimeForToday(dataAgendamento, horaAgendamento);
    if (adjusted !== horaAgendamento) setHoraAgendamento(adjusted);
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
      const generated = instagram
        ? data?.posts?.instagram
        : data?.posts?.facebook;
      if (!generated) throw new Error("Nenhum texto foi gerado para as redes selecionadas.");
      setOpcoes({
        opcaoA: generated.opcaoA,
        opcaoB: generated.opcaoB,
        opcaoC: generated.opcaoC,
      });
      toast.success("Textos gerados com sucesso.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setGerando(false);
    }
  };

  const uploadAdjustedInstagramImages = async (userId: string, images: string[]) => {
    if (!ajusteAuto) return images;
    const adjusted = await adjustImagesForInstagram(images);
    const urls: string[] = [];
    for (let index = 0; index < adjusted.length; index++) {
      const path = `${userId}/ig-adjusted/${Date.now()}-${crypto.randomUUID()}-${index}.jpg`;
      const { error } = await supabase.storage
        .from("produtos")
        .upload(path, adjusted[index].blob, { contentType: "image/jpeg" });
      if (error) throw error;
      urls.push(supabase.storage.from("produtos").getPublicUrl(path).data.publicUrl);
    }
    return urls;
  };

  const handlePublicar = async () => {
    if (!facebook && !instagram) {
      toast.error("Selecione pelo menos uma rede.");
      return;
    }
    const baseText = (textoPost.trim() || (mode === "engajamento" ? previewCaption?.trim() : "")) || "";
    if (!baseText) {
      toast.error(mode === "engajamento"
        ? "Gere e use uma caption de engajamento ou escreva o texto manualmente."
        : "Escreva o texto ou escolha uma opção gerada com IA.");
      return;
    }
    if (modoEnvio === "agendar" && !dataAgendamento) {
      toast.error("Selecione a data do agendamento.");
      return;
    }

    setPublicando(true);
    setResultado(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Você precisa estar logado.");
      const latestImages = incluirImagem ? await loadLatestProductImages() : [];
      if (instagram && latestImages.length === 0) {
        throw new Error("O Instagram exige pelo menos uma imagem. Marque “Incluir imagem do produto”.");
      }

      const instagramImages = instagram
        ? await uploadAdjustedInstagramImages(user.id, latestImages)
        : [];
      const scheduledAt = modoEnvio === "agendar" && dataAgendamento
        ? combineSaoPauloDateTimeToIso(
          dataAgendamento,
          clampTimeForToday(dataAgendamento, horaAgendamento),
        )
        : null;
      const facebookText = incluirLink && linkProduto
        ? `${baseText}\n\n🔗 Compre aqui: ${linkProduto}`
        : baseText;
      const instagramText = incluirLink && linkProduto
        ? `${baseText}\n\n🔗 Link na bio ou acesse: ${linkProduto}`
        : baseText;

      const publishFacebook = async (): Promise<NetworkResult> => {
        let queueId: string | null = null;
        try {
          queueId = await createSocialPostQueueEntry({
            user_id: user.id,
            produto_id: produto.id,
            produto_source: "produtos",
            platform: "facebook",
            page_id: pageId,
            post_text: facebookText,
            image_url: latestImages[0] || null,
            link_url: incluirLink ? linkProduto : null,
            scheduled_at: scheduledAt,
          }, modoEnvio === "agora");
          if (modoEnvio === "agendar") return { network: "Facebook", ok: true, scheduled: true };

          const { data, error } = await supabase.functions.invoke("meta-publish-post", {
            body: {
              message: facebookText,
              user_id: user.id,
              page_id: pageId,
              ...(latestImages.length >= 2
                ? { image_urls: latestImages }
                : { image_url: latestImages[0] || undefined }),
            },
          });
          if (error) throw error;
          if (data?.success === false) throw new Error(data.error || "Erro ao publicar no Facebook");
          await markSocialPostPublished(queueId, data?.post_id || data?.id || null);
          return { network: "Facebook", ok: true, scheduled: false };
        } catch (error) {
          if (queueId) await markSocialPostFailed(queueId, error);
          return { network: "Facebook", ok: false, scheduled: false, error: errorMessage(error) };
        }
      };

      const publishInstagram = async (): Promise<NetworkResult> => {
        let queueId: string | null = null;
        try {
          queueId = await createSocialPostQueueEntry({
            user_id: user.id,
            produto_id: produto.id,
            produto_source: "produtos",
            platform: "instagram",
            page_id: pageId,
            post_text: instagramText,
            // Igual ao modal individual: o agendamento de carrossel registra
            // somente a primeira foto porque a fila não possui image_urls.
            image_url: instagramImages[0],
            link_url: incluirLink ? linkProduto : null,
            scheduled_at: scheduledAt,
          }, modoEnvio === "agora");
          if (modoEnvio === "agendar") return { network: "Instagram", ok: true, scheduled: true };

          const functionName = instagramImages.length >= 2
            ? "meta-publish-carousel"
            : "meta-publish-instagram";
          const body = instagramImages.length >= 2
            ? { caption: instagramText, image_urls: instagramImages, user_id: user.id, produto_id: produto.id }
            : { caption: instagramText, image_url: instagramImages[0], user_id: user.id, produto_id: produto.id };
          const { data, error } = await supabase.functions.invoke(functionName, { body });
          if (error) throw error;
          if (!data?.success) throw new Error(data?.error || "Erro ao publicar no Instagram");
          await markSocialPostPublished(queueId);
          return { network: "Instagram", ok: true, scheduled: false };
        } catch (error) {
          if (queueId) await markSocialPostFailed(queueId, error);
          return { network: "Instagram", ok: false, scheduled: false, error: errorMessage(error) };
        }
      };

      const tasks: Promise<NetworkResult>[] = [];
      if (facebook) tasks.push(publishFacebook());
      if (instagram) tasks.push(publishInstagram());
      const results = await Promise.all(tasks);
      const summary = results.map((item) =>
        item.ok
          ? `✅ ${item.network} ${item.scheduled ? "agendado" : "publicado"}`
          : `❌ ${item.network}: ${item.error}`
      ).join(" | ");
      setResultado(summary);
      if (results.every((item) => item.ok)) toast.success(summary);
      else toast.warning(summary);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPublicando(false);
    }
  };

  const nextSlot = getNextFiveMinuteSlot();
  const timeOptions = generateTimeOptions(5);
  const availableTimes = dataAgendamento && isSameCalendarDay(dataAgendamento, nextSlot)
    ? timeOptions.filter((time) => time >= toTimeString(nextSlot))
    : timeOptions;
  const isCarousel = allImages.length >= 2;
  const selectedNetworks = useMemo(
    () => [facebook && "Facebook", instagram && "Instagram"].filter(Boolean).join(" + "),
    [facebook, instagram],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-x-hidden overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Facebook className="h-5 w-5 text-blue-600" />
            <Instagram className="h-5 w-5 text-pink-600" />
            Publicar no Facebook + Instagram
          </DialogTitle>
          <DialogDescription>
            Publique agora ou agende nas redes selecionadas usando o mesmo conteúdo.
          </DialogDescription>
        </DialogHeader>

        {((facebook && !facebookConnected) || (instagram && !instagramConnected)) && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:bg-amber-900/10">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Conecte {[
                facebook && !facebookConnected && "Facebook",
                instagram && !instagramConnected && "Instagram",
              ].filter(Boolean).join(" e ")} antes de publicar.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label>Redes de destino</Label>
          <div className="flex gap-6 rounded-lg border p-3">
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox checked={facebook} onCheckedChange={(value) => setFacebook(!!value)} />
              <Facebook className="h-4 w-4 text-blue-600" /> Facebook
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox checked={instagram} onCheckedChange={(value) => setInstagram(!!value)} />
              <Instagram className="h-4 w-4 text-pink-600" /> Instagram
            </label>
          </div>
        </div>

        <div className="space-y-2 rounded-lg border p-3">
          <Label>Como você quer publicar este post?</Label>
          <RadioGroup value={mode} onValueChange={(value) => setMode(value as typeof mode)} className="space-y-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-md border p-2">
              <RadioGroupItem value="engajamento" className="mt-0.5" />
              <span className="text-sm"><b>🎯 Modo Engajamento</b><br /><span className="text-xs text-muted-foreground">Caption sem preço, focada no estilo escolhido.</span></span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border p-2">
              <RadioGroupItem value="promocional" className="mt-0.5" />
              <span className="text-sm"><b>💰 Modo Promocional</b><br /><span className="text-xs text-muted-foreground">Texto tradicional com oferta, imagem e link.</span></span>
            </label>
          </RadioGroup>
        </div>

        {mode === "engajamento" ? (
          <div className="space-y-3 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
            <Label>Estilo da caption</Label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aleatorio">🎲 Aleatório</SelectItem>
                {styles.map((item) => (
                  <SelectItem key={item.id} value={item.id}>{item.emoji} {item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" className="w-full gap-2" onClick={generatePreview} disabled={previewLoading || !styles.length}>
              {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              {previewLoading ? "Gerando prévia..." : "Pré-visualizar caption"}
            </Button>
            {previewCaption && (
              <Card>
                <CardContent className="space-y-2 p-3">
                  <div className="flex gap-2"><Badge variant="outline">Estilo: {previewStyle}</Badge>{previewFromCache && <Badge variant="secondary">cache</Badge>}</div>
                  <p className="whitespace-pre-wrap text-sm">{previewCaption}</p>
                  <Button size="sm" variant="secondary" className="w-full" onClick={() => setTextoPost(previewCaption)}>Usar esta caption</Button>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <>
            <Button variant="outline" className="w-full gap-2" onClick={handleGerarTexto} disabled={gerando}>
              {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {gerando ? "Gerando..." : "Gerar texto com IA"}
            </Button>
            {opcoes && (
              <div className="grid gap-2">
                {(["opcaoA", "opcaoB", "opcaoC"] as const).map((key, index) => (
                  <Card key={key} className={cn("cursor-pointer", textoPost === opcoes[key] && "ring-2 ring-primary")} onClick={() => setTextoPost(opcoes[key])}>
                    <CardContent className="flex items-start gap-2 p-3">
                      <Badge variant="outline">{["Direta", "Storytelling", "Educativa"][index]}</Badge>
                      <p className="line-clamp-3 text-sm">{opcoes[key]}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        <div className="space-y-2">
          <Label>Texto do post</Label>
          <Textarea value={textoPost} onChange={(event) => setTextoPost(event.target.value)} rows={5} />
          <p className="text-xs text-muted-foreground">{textoPost.length} caracteres</p>
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox checked={incluirImagem} onCheckedChange={(value) => setIncluirImagem(!!value)} />
            Incluir imagem do produto
          </label>
          <label className={cn("flex items-center gap-2", linkProduto ? "cursor-pointer" : "text-muted-foreground")}>
            <Checkbox checked={incluirLink} onCheckedChange={(value) => setIncluirLink(!!value)} disabled={!linkProduto} />
            {linkProduto ? "Incluir link" : "Produto sem link"}
          </label>
        </div>

        {incluirImagem && allImages.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {isCarousel ? `${allImages.length} fotos — carrossel na publicação imediata` : "1 foto — post simples"}
            </p>
            {instagram && (
              <label className="flex cursor-pointer items-center gap-2 text-xs">
                <Checkbox checked={ajusteAuto} onCheckedChange={(value) => setAjusteAuto(!!value)} />
                <ImageIcon className="h-3 w-3" /> Ajustar proporção automaticamente para Instagram
              </label>
            )}
            {ajustando && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Ajustando imagens...</p>}
            {instagram && ajusteAuto && adjustedImages?.length ? (
              <>
                <p className="text-xs text-muted-foreground">Preview Instagram — {FORMAT_LABELS[adjustedImages[0].format]}</p>
                <div className="grid grid-cols-5 gap-2">{adjustedImages.map((image, index) => <img key={index} src={image.dataUrl} alt={`Ajustada ${index + 1}`} className="aspect-square w-full rounded border bg-black object-contain" />)}</div>
              </>
            ) : (
              <div className="grid grid-cols-5 gap-2">{allImages.map((url, index) => <img key={url} src={url} alt={`Foto ${index + 1}`} className="aspect-square w-full rounded border object-cover" />)}</div>
            )}
          </div>
        )}
        {instagram && incluirImagem && allImages.length === 0 && !carregandoFotos && (
          <p className="text-sm text-destructive">O Instagram exige pelo menos uma imagem.</p>
        )}

        <RadioGroup value={modoEnvio} onValueChange={(value) => setModoEnvio(value as "agora" | "agendar")}>
          <div className="flex gap-4">
            <label className="flex cursor-pointer items-center gap-2"><RadioGroupItem value="agora" /><Send className="h-3 w-3" /> Postar Agora</label>
            <label className="flex cursor-pointer items-center gap-2"><RadioGroupItem value="agendar" /><Clock className="h-3 w-3" /> Agendar</label>
          </div>
        </RadioGroup>

        {modoEnvio === "agendar" && (
          <div className="flex items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[200px] justify-start", !dataAgendamento && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataAgendamento ? format(dataAgendamento, "dd/MM/yyyy") : "Selecionar data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dataAgendamento}
                  onSelect={(date) => {
                    setDataAgendamento(date);
                    if (date) setHoraAgendamento(clampTimeForToday(date, horaAgendamento));
                  }}
                  disabled={isBeforeTodayInSaoPaulo}
                />
              </PopoverContent>
            </Popover>
            <Select value={horaAgendamento} onValueChange={setHoraAgendamento}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>{availableTimes.map((time) => <SelectItem key={time} value={time}>{time}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}

        {resultado && <div className="rounded-lg bg-muted p-3 text-sm font-medium">{resultado}</div>}

        <Button
          onClick={handlePublicar}
          disabled={publicando || carregandoFotos || (!textoPost.trim() && !(mode === "engajamento" && previewCaption))}
          className="w-full gap-2 bg-gradient-to-r from-blue-600 to-pink-600 text-white"
        >
          {publicando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {publicando
            ? modoEnvio === "agendar" ? "Agendando..." : "Publicando..."
            : modoEnvio === "agendar"
              ? `Agendar em ${selectedNetworks || "redes selecionadas"}`
              : `Publicar em ${selectedNetworks || "redes selecionadas"}`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
