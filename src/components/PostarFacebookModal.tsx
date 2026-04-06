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
import { CalendarIcon, Sparkles, Loader2, Facebook, Send, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAllProductImages } from "@/components/ProductImageCarousel";
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
}

export function PostarFacebookModal({ open, onOpenChange, produto }: PostarFacebookModalProps) {
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
      toast.success("3 opções de texto geradas!");
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

    const mensagemFinal = incluirLink && linkProduto
      ? `${textoPost.trim()}\n\n🔗 Compre aqui: ${linkProduto}`
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

      const imagesToPublish = incluirImagem ? allImages : [];

      let scheduledAt: string | null = null;
      if (modoEnvio === "agendar" && dataAgendamento) {
        const horaFinal = clampTimeForToday(dataAgendamento, horaAgendamento);
        scheduledAt = combineSaoPauloDateTimeToIso(dataAgendamento, horaFinal);
      }

      // Insert into social_posts_queue
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
          // Carrossel no Facebook
          console.log(`📸 Publicando carrossel Facebook com ${imagesToPublish.length} fotos`);
          const { data: pubData, error: pubError } = await supabase.functions.invoke("meta-publish-post", {
            body: {
              message: mensagemFinal,
              user_id: user.id,
              image_urls: imagesToPublish,
            },
          });
          if (pubError) throw pubError;
          toast.success(`✅ Carrossel com ${imagesToPublish.length} fotos publicado no Facebook!`);
        } else {
          // Post simples
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
          toast.success(`✅ Publicado no Facebook! Post ID: ${postId}`);
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
      console.error("Erro ao publicar:", err);
      toast.error(err.message || "Erro ao publicar no Facebook");
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
            <Facebook className="h-5 w-5 text-blue-600" />
            Postar no Facebook
          </DialogTitle>
          <DialogDescription>Publique este produto na sua página do Facebook</DialogDescription>
        </DialogHeader>

        {/* Aviso se não conectado */}
        {!metaConnected && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-300">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Conecte sua conta do Facebook em <strong>Configurações → Redes Sociais</strong> para postar na sua página.
            </p>
          </div>
        )}

        {/* Produto Info + fotos */}
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
                  ? `📸 ${allImages.length} fotos — será publicado como CARROSSEL`
                  : '📸 1 foto — post simples'}
              </p>
              <div className="grid grid-cols-5 gap-2">
                {allImages.map((url, i) => (
                  <img key={i} src={url} alt={`Foto ${i+1}`} className="w-full aspect-square object-cover rounded border" />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Gerar texto com IA */}
        <Button onClick={handleGerarTexto} disabled={gerando} variant="outline" className="w-full gap-2">
          {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {gerando ? "Gerando textos..." : "🤖 Gerar texto com IA"}
        </Button>

        {/* Opções de texto */}
        {opcoes && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Escolha uma opção:</Label>
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
                        {["Casual", "Informativo", "Urgente"][i]}
                      </Badge>
                      <p className="text-sm line-clamp-3">{opcoes[key]}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Textarea editável */}
        <div className="space-y-2">
          <Label>Texto do post</Label>
          <Textarea
            value={textoPost}
            onChange={(e) => setTextoPost(e.target.value)}
            placeholder="Escreva o texto do post ou gere com IA..."
            rows={5}
          />
          <p className="text-xs text-muted-foreground">{textoPost.length} caracteres</p>
        </div>

        {/* Opções */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="incluir-imagem"
                checked={incluirImagem}
                onCheckedChange={(c) => setIncluirImagem(!!c)}
              />
              <Label htmlFor="incluir-imagem" className="text-sm cursor-pointer">
                Incluir imagem do produto
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
                {temLink ? "Incluir link do produto" : "Sem link disponível"}
              </Label>
            </div>
          </div>

          {/* Modo de envio */}
          <RadioGroup value={modoEnvio} onValueChange={(v) => setModoEnvio(v as "agora" | "agendar")}>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="agora" id="agora" />
                <Label htmlFor="agora" className="cursor-pointer flex items-center gap-1">
                  <Send className="h-3 w-3" /> Postar Agora
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="agendar" id="agendar" />
                <Label htmlFor="agendar" className="cursor-pointer flex items-center gap-1">
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
          disabled={publicando || !textoPost.trim()}
          className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
        >
          {publicando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Facebook className="h-4 w-4" />
          )}
          {publicando
            ? "Publicando..."
            : modoEnvio === "agora"
              ? isCarousel ? `Publicar carrossel (${allImages.length} fotos)` : "Publicar no Facebook"
              : "Agendar Publicação"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
