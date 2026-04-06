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
import { CalendarIcon, Sparkles, Loader2, Instagram, Send, Clock, AlertTriangle } from "lucide-react";
import { getAllProductImages } from "@/components/ProductImageCarousel";
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
      toast.success("3 opções de texto geradas para Instagram!");
    } catch (err: any) {
      console.error("Erro ao gerar texto:", err);
      toast.error(err.message || "Erro ao gerar texto com IA");
    } finally {
      setGerando(false);
    }
  };

  const selecionarOpcao = (texto: string) => {
    setTextoPost(texto);
  };

  const handlePublicar = async () => {
    if (!textoPost.trim()) {
      toast.error("Escreva ou gere o texto do post primeiro");
      return;
    }

      if (allImages.length === 0) {
        toast.error("Instagram requer uma imagem. Este produto não tem imagem cadastrada.");
        return;
      }

    const captionFinal = incluirLink && linkProduto
      ? `${textoPost.trim()}\n\n🔗 Link na bio ou acesse: ${linkProduto}`
      : textoPost.trim();

    if (modoEnvio === "agendar" && !dataAgendamento) {
      toast.error("Selecione a data do agendamento");
      return;
    }

    setPublicando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado");
        return;
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
        image_url: allImages[0] || null,
        link_url: incluirLink ? linkProduto : null,
        status: "pendente",
        scheduled_at: scheduledAt,
      } as any);

      if (insertError) throw insertError;

      if (modoEnvio === "agora") {
        if (allImages.length >= 2) {
          // Carrossel no Instagram
          console.log(`📸 Publicando carrossel Instagram com ${allImages.length} fotos`);
          const { data: pubData, error: pubError } = await supabase.functions.invoke("meta-publish-carousel", {
            body: {
              caption: captionFinal,
              image_urls: allImages,
              user_id: user.id,
            },
          });
          if (pubError) throw pubError;
          if (!pubData?.success) throw new Error(pubData?.error || "Erro ao publicar carrossel");
          toast.success(`✅ Carrossel com ${allImages.length} fotos publicado no Instagram!`);
        } else {
          // Post simples
          const { data: pubData, error: pubError } = await supabase.functions.invoke("meta-publish-instagram", {
            body: {
              caption: captionFinal,
              image_url: allImages[0],
              user_id: user.id,
            },
          });
          if (pubError) throw pubError;
          if (!pubData?.success) throw new Error(pubData?.error || "Erro ao publicar no Instagram");
          toast.success(`✅ Publicado no Instagram!`);
        }
      } else {
        const horaFinal = clampTimeForToday(dataAgendamento!, horaAgendamento);
        toast.success(`⏰ Post agendado para ${format(dataAgendamento!, "dd/MM/yyyy")} às ${horaFinal}`);
      }

      setTextoPost("");
      setOpcoes(null);
      setModoEnvio("agora");
      setDataAgendamento(undefined);
      onOpenChange(false);
    } catch (err: any) {
      console.error("Erro ao publicar no Instagram:", err);
      toast.error(err.message || "Erro ao publicar no Instagram");
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
            Postar no Instagram
          </DialogTitle>
          <DialogDescription>
            {igConnected
              ? `Publique este produto no seu Instagram @${igUsername || "conectado"}`
              : "Publique este produto no Instagram"}
          </DialogDescription>
        </DialogHeader>

        {/* Aviso se não conectado */}
        {!igConnected && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-300">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Conecte sua conta do Instagram em <strong>Configurações → Redes Sociais</strong> para postar no seu perfil.
            </p>
          </div>
        )}

        {/* Aviso se não tem imagem */}
        {!temImagem && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
            <p className="text-sm text-destructive">
              Este produto não tem imagem cadastrada. O Instagram exige uma imagem para publicação.
            </p>
          </div>
        )}

        {/* Produto Info */}
        <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 overflow-hidden">
          {produto.imagem_url && (
            <img src={produto.imagem_url} alt={produto.nome} className="w-16 h-16 rounded-lg object-cover" />
          )}
          <div className="min-w-0 overflow-hidden">
            <p className="font-medium text-sm break-words line-clamp-2">{produto.nome}</p>
            {produto.preco && (
              <p className="text-sm text-muted-foreground">R$ {produto.preco.toFixed(2)}</p>
            )}
          </div>
        </div>

        {/* Gerar texto com IA */}
        <Button onClick={handleGerarTexto} disabled={gerando} variant="outline" className="w-full gap-2">
          {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {gerando ? "Gerando textos..." : "🤖 Gerar texto com IA"}
        </Button>

        {/* Opções de texto */}
        {opcoes && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Escolha uma opção:</p>
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
                        {["Direto", "Storytelling", "Educativo"][i]}
                      </Badge>
                      <p className="text-sm">{opcoes[key]}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Textarea editável */}
        <div className="space-y-2">
          <Label>Caption do post</Label>
          <Textarea
            value={textoPost}
            onChange={(e) => setTextoPost(e.target.value)}
            placeholder="Escreva o caption do post ou gere com IA..."
            rows={5}
          />
          <p className="text-xs text-muted-foreground">{textoPost.length} / 2.200 caracteres</p>
        </div>

        {/* Opções */}
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
                {temLink ? "Incluir link no caption" : "Sem link disponível"}
              </Label>
            </div>
          </div>

          {/* Modo de envio */}
          <RadioGroup value={modoEnvio} onValueChange={(v) => setModoEnvio(v as "agora" | "agendar")}>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="agora" id="agora-ig" />
                <Label htmlFor="agora-ig" className="cursor-pointer flex items-center gap-1">
                  <Send className="h-3 w-3" /> Postar Agora
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="agendar" id="agendar-ig" />
                <Label htmlFor="agendar-ig" className="cursor-pointer flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Agendar
                </Label>
              </div>
            </div>
          </RadioGroup>

          {/* Date/Time picker para agendamento */}
          {modoEnvio === "agendar" && (
            <div className="flex items-center gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-[200px] justify-start text-left font-normal", !dataAgendamento && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataAgendamento ? format(dataAgendamento, "dd/MM/yyyy") : "Selecionar data"}
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

        {/* Botão publicar */}
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
            ? "Publicando..."
            : modoEnvio === "agora"
              ? "Publicar no Instagram"
              : "Agendar Publicação"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
