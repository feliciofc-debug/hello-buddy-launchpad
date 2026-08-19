import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
import { CalendarIcon, Sparkles, Loader2, Linkedin, Send, Clock, AlertTriangle } from "lucide-react";
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

const LIMITE_TEXTO = 3000;

interface Produto {
  id: string;
  nome: string;
  descricao?: string | null;
  preco?: number | null;
  imagem_url?: string | null;
  link?: string | null;
  link_marketplace?: string | null;
}

interface PostarLinkedInModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produto: Produto;
}

export function PostarLinkedInModal({ open, onOpenChange, produto }: PostarLinkedInModalProps) {
  const [gerando, setGerando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [opcoes, setOpcoes] = useState<{ A: string; B: string; C: string } | null>(null);
  const [tema, setTema] = useState("");
  const [textoPost, setTextoPost] = useState("");
  const [modoEnvio, setModoEnvio] = useState<"agora" | "agendar">("agora");
  const [incluirImagem, setIncluirImagem] = useState(true);
  const linkProduto = produto.link || produto.link_marketplace || null;
  const temLink = !!linkProduto;
  const [incluirLink, setIncluirLink] = useState(temLink);
  const [dataAgendamento, setDataAgendamento] = useState<Date | undefined>();
  const [horaAgendamento, setHoraAgendamento] = useState("10:00");
  const [imagem, setImagem] = useState<string | null>(null);
  const [conectado, setConectado] = useState(false);
  const [perfil, setPerfil] = useState<string | null>(null);

  // LinkedIn não tem carrossel: apenas a primeira imagem do produto.
  useEffect(() => {
    if (!open) return;
    const imgs = getAllProductImages(produto as any) || [];
    setImagem(imgs[0] || produto.imagem_url || null);
  }, [open, produto]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setConectado(false); return; }
      const { data } = await supabase
        .from("linkedin_connections" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      const conn = data as any;
      setConectado(Boolean(conn && conn.is_active));
      setPerfil(conn?.nome || null);
    })();
  }, [open]);

  const handleGerarTexto = async () => {
    const temaFinal = tema.trim() || produto.nome;
    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-post-linkedin", {
        body: { tema: temaFinal, produto_id: produto.id },
      });
      if (error) throw error;
      const resp = data as { success?: boolean; opcoes?: { A: string; B: string; C: string }; error?: string } | null;
      if (!resp?.success || !resp.opcoes) throw new Error(resp?.error || "Falha ao gerar o texto.");
      setOpcoes(resp.opcoes);
    } catch (err: any) {
      console.error("[gerar-post-linkedin]", err);
      toast.error(err.message || "Não foi possível gerar o texto.");
    } finally {
      setGerando(false);
    }
  };

  const handlePublicar = async () => {
    const base = textoPost.trim();
    if (!base) {
      toast.error("Escreva ou gere o texto do post primeiro.");
      return;
    }
    if (modoEnvio === "agendar" && !dataAgendamento) {
      toast.error("Selecione a data do agendamento.");
      return;
    }

    // O link entra no FIM do texto, nunca no topo.
    const mensagemFinal = incluirLink && linkProduto && !base.includes(linkProduto)
      ? `${base}\n\n${linkProduto}`
      : base;

    setPublicando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Faça login novamente."); return; }

      let scheduledAt: string | null = null;
      if (modoEnvio === "agendar" && dataAgendamento) {
        const horaFinal = clampTimeForToday(dataAgendamento, horaAgendamento);
        scheduledAt = combineSaoPauloDateTimeToIso(dataAgendamento, horaFinal);
      }

      const imageUrl = incluirImagem ? imagem : null;

      const { data: fila, error: insertError } = await supabase
        .from("social_posts_queue" as any)
        .insert({
          user_id: user.id,
          produto_id: produto.id,
          produto_source: "produtos",
          platform: "linkedin",
          post_text: mensagemFinal,
          post_text_linkedin: mensagemFinal,
          image_url: imageUrl,
          link_url: incluirLink ? linkProduto : null,
          status: "pendente",
          scheduled_at: scheduledAt,
        } as any)
        .select("id")
        .single();

      if (insertError) throw insertError;

      if (modoEnvio === "agora") {
        const { data: pubData, error: pubError } = await supabase.functions.invoke("linkedin-publish", {
          body: {
            texto: mensagemFinal,
            image_url: imageUrl || undefined,
            link_url: incluirLink && linkProduto ? linkProduto : undefined,
            queue_id: (fila as any)?.id,
          },
        });
        if (pubError) throw pubError;
        const resp = pubData as { success?: boolean; error?: string } | null;
        if (!resp?.success) {
          await supabase.from("social_posts_queue" as any)
            .update({ status: "erro", error_message: resp?.error || "Erro ao publicar" } as any)
            .eq("id", (fila as any)?.id)
            .eq("user_id", user.id);
          throw new Error(resp?.error || "Erro ao publicar no LinkedIn");
        }
        toast.success("Post publicado no LinkedIn.");
      } else {
        const horaFinal = clampTimeForToday(dataAgendamento!, horaAgendamento);
        toast.success(`Agendado para ${format(dataAgendamento!, "dd/MM/yyyy")} às ${horaFinal}.`);
      }

      setTextoPost("");
      setTema("");
      setOpcoes(null);
      setModoEnvio("agora");
      setDataAgendamento(undefined);
      onOpenChange(false);
    } catch (err: any) {
      console.error("Erro ao publicar no LinkedIn:", err);
      toast.error(err.message || "Erro ao publicar no LinkedIn.");
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
            <Linkedin className="h-5 w-5 text-[#0A66C2]" />
            Post on LinkedIn
            {conectado && perfil && (
              <Badge variant="outline" className="ml-2 text-[10px]">{perfil}</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Copy institucional: fala do negócio e do valor gerado, com o produto apenas como exemplo.
          </DialogDescription>
        </DialogHeader>

        {!conectado && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-300">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Nenhuma conta do LinkedIn conectada. Conecte na aba LinkedIn em Meus Produtos para publicar.
            </p>
          </div>
        )}

        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg overflow-hidden">
          {imagem && <img src={imagem} alt={produto.nome} className="w-16 h-16 object-cover rounded" />}
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="font-medium break-words line-clamp-2">{produto.nome}</p>
            <p className="text-xs text-muted-foreground">Produto usado apenas como contexto (sem preço).</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Tema do post</Label>
          <Input
            value={tema}
            onChange={(e) => setTema(e.target.value)}
            placeholder="Ex: como a automação muda a rotina comercial"
          />
          <p className="text-xs text-muted-foreground">
            O produto entra como exemplo. A copy fala do negócio e do valor gerado, não da oferta.
          </p>
        </div>

        <Button onClick={handleGerarTexto} disabled={gerando} variant="outline" className="w-full gap-2">
          {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {gerando ? "Gerando..." : "Gerar texto com IA"}
        </Button>

        {opcoes && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Escolha uma opção</Label>
            <div className="grid gap-2">
              {(["A", "B", "C"] as const).map((key, i) => (
                <Card
                  key={key}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-md",
                    textoPost === opcoes[key] && "ring-2 ring-primary",
                  )}
                  onClick={() => setTextoPost(opcoes[key])}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="shrink-0 mt-0.5">
                        {["Observação de mercado", "Argumento técnico", "Bastidor profissional"][i]}
                      </Badge>
                      <p className="text-sm line-clamp-3 whitespace-pre-wrap">{opcoes[key]}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label>Post text</Label>
          <Textarea
            value={textoPost}
            onChange={(e) => setTextoPost(e.target.value.slice(0, LIMITE_TEXTO))}
            placeholder="Texto do post no LinkedIn..."
            rows={8}
          />
          <p className={cn("text-xs", textoPost.length > LIMITE_TEXTO - 100 ? "text-destructive" : "text-muted-foreground")}>
            {textoPost.length}/{LIMITE_TEXTO} caracteres
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox id="li-incluir-imagem" checked={incluirImagem} onCheckedChange={(c) => setIncluirImagem(!!c)} />
              <Label htmlFor="li-incluir-imagem" className="text-sm cursor-pointer">Incluir imagem do produto</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="li-incluir-link"
                checked={incluirLink}
                onCheckedChange={(c) => setIncluirLink(!!c)}
                disabled={!temLink}
              />
              <Label htmlFor="li-incluir-link" className={cn("text-sm cursor-pointer", !temLink && "text-muted-foreground")}>
                {temLink ? "Incluir link do produto" : "Sem link disponível"}
              </Label>
            </div>
          </div>

          <RadioGroup value={modoEnvio} onValueChange={(v) => setModoEnvio(v as "agora" | "agendar")}>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="agora" id="li-agora" />
                <Label htmlFor="li-agora" className="cursor-pointer flex items-center gap-1">
                  <Send className="h-3 w-3" /> Publicar agora
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="agendar" id="li-agendar" />
                <Label htmlFor="li-agendar" className="cursor-pointer flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Agendar
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
                    {dataAgendamento ? format(dataAgendamento, "dd/MM/yyyy") : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataAgendamento}
                    onSelect={(date) => {
                      setDataAgendamento(date);
                      if (date) setHoraAgendamento(clampTimeForToday(date, horaAgendamento));
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
          disabled={publicando || !textoPost.trim() || !conectado}
          className="w-full gap-2 bg-[#0A66C2] hover:bg-[#08528f] text-white"
        >
          {publicando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Linkedin className="h-4 w-4" />}
          {publicando ? "Publicando..." : modoEnvio === "agora" ? "Publicar no LinkedIn" : "Agendar publicação"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export default PostarLinkedInModal;
