import { useState } from "react";
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
import { CalendarIcon, Sparkles, Loader2, Facebook, Send, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

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

  const PAGE_ID = "855785300949909";

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

      const imagemProduto = produto.imagem_url || null;

      let scheduledAt: string | null = null;
      if (modoEnvio === "agendar" && dataAgendamento) {
        const [h, m] = horaAgendamento.split(":").map(Number);
        const dt = new Date(dataAgendamento);
        dt.setHours(h, m, 0, 0);
        scheduledAt = dt.toISOString();
      }

      // Insert into social_posts_queue
      const { error: insertError } = await supabase.from("social_posts_queue" as any).insert({
        user_id: user.id,
        produto_id: produto.id,
        produto_source: "produtos",
        platform: "facebook",
        page_id: PAGE_ID,
        post_text: mensagemFinal,
        image_url: incluirImagem ? imagemProduto : null,
        link_url: incluirLink ? linkProduto : null,
        status: "pendente",
        scheduled_at: scheduledAt,
      } as any);

      if (insertError) throw insertError;

      if (modoEnvio === "agora") {
        // Call edge function to publish immediately
        const { data: pubData, error: pubError } = await supabase.functions.invoke("meta-publish-post", {
          body: {
            message: mensagemFinal,
            page_id: PAGE_ID,
            user_id: user.id,
            image_url: incluirImagem ? imagemProduto : undefined,
          },
        });

        if (pubError) throw pubError;

        const postId = pubData?.post_id || pubData?.id || "OK";
        toast.success(`✅ Publicado no Facebook! Post ID: ${postId}`);
      } else {
        toast.success(`⏰ Post agendado para ${format(dataAgendamento!, "dd/MM/yyyy")} às ${horaAgendamento}`);
      }

      // Reset and close
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

  const horas = Array.from({ length: 24 }, (_, i) => {
    const h = i.toString().padStart(2, "0");
    return [`${h}:00`, `${h}:30`];
  }).flat();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Facebook className="h-5 w-5 text-blue-600" />
            Postar no Facebook
          </DialogTitle>
          <DialogDescription>Publique este produto na sua página do Facebook</DialogDescription>
        </DialogHeader>

        {/* Produto Info */}
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          {produto.imagem_url && (
            <img src={produto.imagem_url} alt={produto.nome} className="w-16 h-16 object-cover rounded" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{produto.nome}</p>
            {produto.preco && (
              <p className="text-primary font-bold">R$ {produto.preco.toFixed(2)}</p>
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
                    onSelect={setDataAgendamento}
                    disabled={(date) => date < new Date()}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              <Select value={horaAgendamento} onValueChange={setHoraAgendamento}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {horas.map((h) => (
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
              ? "Publicar no Facebook"
              : "Agendar Publicação"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
