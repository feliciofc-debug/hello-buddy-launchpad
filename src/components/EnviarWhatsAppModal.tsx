import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, CalendarIcon, X, ChevronDown, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface EnviarWhatsAppModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mensagem: string;
  imagemUrl?: string | null;
}

type TipoDestino = "lista" | "grupo" | "individual";

interface ListaItem {
  id: string;
  nome: string;
  total_membros: number;
}

interface GrupoItem {
  id: string;
  nome: string;
  participantes_count: number | null;
  grupo_jid: string;
}

interface ContatoItem {
  id: string;
  nome: string;
  telefone: string;
}

export function EnviarWhatsAppModal({ open, onOpenChange, mensagem, imagemUrl }: EnviarWhatsAppModalProps) {
  const [tipoDestino, setTipoDestino] = useState<TipoDestino | null>(null);
  const [listas, setListas] = useState<ListaItem[]>([]);
  const [grupos, setGrupos] = useState<GrupoItem[]>([]);
  const [contatos, setContatos] = useState<ContatoItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [selectedContato, setSelectedContato] = useState<ContatoItem | null>(null);
  const [buscaContato, setBuscaContato] = useState("");
  const [loadingDestinos, setLoadingDestinos] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [agendamentoAberto, setAgendamentoAberto] = useState(false);
  const [dataAgendamento, setDataAgendamento] = useState<Date>();
  const [horaAgendamento, setHoraAgendamento] = useState("09:00");
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    if (open) {
      setTipoDestino(null);
      setSelectedId("");
      setSelectedContato(null);
      setBuscaContato("");
      setErro("");
      setAgendamentoAberto(false);
      setDataAgendamento(undefined);
      loadUserId();
    }
  }, [open]);

  const loadUserId = async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) setUserId(data.user.id);
  };

  useEffect(() => {
    if (!userId || !tipoDestino) return;
    setSelectedId("");
    setSelectedContato(null);
    setBuscaContato("");

    if (tipoDestino === "lista") loadListas();
    else if (tipoDestino === "grupo") loadGrupos();
  }, [tipoDestino, userId]);

  const loadListas = async () => {
    setLoadingDestinos(true);
    const { data } = await supabase
      .from("pj_listas_categoria")
      .select("id, nome, total_membros")
      .eq("user_id", userId)
      .eq("ativa", true);
    setListas((data as ListaItem[]) || []);
    setLoadingDestinos(false);
  };

  const loadGrupos = async () => {
    setLoadingDestinos(true);
    const { data } = await supabase
      .from("pj_grupos_whatsapp")
      .select("id, nome, participantes_count, grupo_jid")
      .eq("user_id", userId)
      .eq("ativo", true);
    setGrupos((data as unknown as GrupoItem[]) || []);
    setLoadingDestinos(false);
  };

  // Debounced contact search
  useEffect(() => {
    if (tipoDestino !== "individual" || !userId || buscaContato.length < 2) {
      setContatos([]);
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("pj_lista_membros")
        .select("id, nome, telefone")
        .or(`nome.ilike.%${buscaContato}%,telefone.ilike.%${buscaContato}%`)
        .limit(10);
      setContatos((data as unknown as ContatoItem[]) || []);
    }, 300);
    return () => clearTimeout(timer);
  }, [buscaContato, tipoDestino, userId]);

  const podeEnviar = () => {
    if (!tipoDestino) return false;
    if (tipoDestino === "individual") return !!selectedContato;
    return !!selectedId;
  };

  const getNomeDestino = () => {
    if (tipoDestino === "lista") return listas.find(l => l.id === selectedId)?.nome || "";
    if (tipoDestino === "grupo") return grupos.find(g => g.id === selectedId)?.nome || "";
    if (tipoDestino === "individual") return selectedContato?.nome || "";
    return "";
  };

  const handleEnviar = async () => {
    if (!podeEnviar()) return;
    setEnviando(true);
    setErro("");

    try {
      if (tipoDestino === "grupo") {
        const grupo = grupos.find(g => g.id === selectedId);
        if (!grupo) throw new Error("Grupo não encontrado");

        const { error } = await supabase.functions.invoke("send-wuzapi-group-message-pj", {
          body: {
            groupJid: grupo.grupo_jid,
            message: mensagem,
            imageUrl: imagemUrl || undefined,
            userId,
          },
        });
        if (error) throw error;
      } else if (tipoDestino === "lista") {
        // Send to each member of the list
        const { data: membros } = await supabase
          .from("pj_lista_membros")
          .select("telefone")
          .eq("lista_id", selectedId);

        if (!membros?.length) throw new Error("Lista sem membros");

        for (const membro of membros) {
          await supabase.functions.invoke("send-wuzapi-message-pj", {
            body: {
              telefone: membro.telefone,
              mensagem,
              imagem_url: imagemUrl || undefined,
              userId,
            },
          });
        }
      } else if (tipoDestino === "individual" && selectedContato) {
        const { error } = await supabase.functions.invoke("send-wuzapi-message-pj", {
          body: {
            telefone: selectedContato.telefone,
            mensagem,
            imagem_url: imagemUrl || undefined,
            userId,
          },
        });
        if (error) throw error;
      }

      toast.success(`✅ Enviado para ${getNomeDestino()}!`);
      onOpenChange(false);
    } catch (err: any) {
      setErro(err.message || "Erro ao enviar");
    } finally {
      setEnviando(false);
    }
  };

  const isAgendado = agendamentoAberto && dataAgendamento;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📲 Enviar via WhatsApp
          </DialogTitle>
        </DialogHeader>

        {/* 1. PRÉVIA */}
        <div className="bg-muted/50 rounded-lg p-3 flex gap-3 items-start">
          {imagemUrl && (
            <img src={imagemUrl} alt="Preview" className="w-[60px] h-[60px] rounded object-cover flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm line-clamp-3 text-muted-foreground">{mensagem}</p>
            <p className="text-xs text-green-600 mt-1 font-medium">✅ Pronto para envio</p>
          </div>
        </div>

        {/* 2. SELEÇÃO DE TIPO */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { tipo: "lista" as TipoDestino, icon: "📋", label: "Lista de Transmissão", sub: "Até 256 pessoas", badge: "⚠️ Máx 256", badgeColor: "bg-orange-100 text-orange-700 border-orange-200" },
            { tipo: "grupo" as TipoDestino, icon: "👥", label: "Grupo WhatsApp", sub: "Sem limite", badge: "✅ Ilimitado", badgeColor: "bg-green-100 text-green-700 border-green-200" },
            { tipo: "individual" as TipoDestino, icon: "👤", label: "Contato Individual", sub: "Envio direto", badge: "📱 1 pessoa", badgeColor: "bg-blue-100 text-blue-700 border-blue-200" },
          ].map((item) => (
            <button
              key={item.tipo}
              onClick={() => setTipoDestino(item.tipo)}
              className={cn(
                "rounded-lg border-2 p-3 text-left transition-all hover:shadow-md",
                tipoDestino === item.tipo
                  ? "border-primary bg-primary/5 shadow-md"
                  : "border-border hover:border-muted-foreground/30"
              )}
            >
              <div className="text-xl mb-1">{item.icon}</div>
              <p className="text-xs font-semibold leading-tight">{item.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{item.sub}</p>
              <Badge variant="outline" className={cn("mt-1.5 text-[10px] px-1.5 py-0", item.badgeColor)}>
                {item.badge}
              </Badge>
            </button>
          ))}
        </div>

        {/* 3. SELECT DINÂMICO */}
        {tipoDestino && (
          <div className="space-y-2">
            {tipoDestino === "lista" && (
              loadingDestinos ? (
                <div className="flex items-center justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : listas.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">Nenhuma lista criada ainda.</p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {listas.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => setSelectedId(l.id)}
                      className={cn(
                        "w-full text-left rounded-md border p-2.5 text-sm transition-colors",
                        selectedId === l.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                      )}
                    >
                      {l.nome} <span className="text-muted-foreground">({l.total_membros} contatos)</span>
                    </button>
                  ))}
                </div>
              )
            )}

            {tipoDestino === "grupo" && (
              loadingDestinos ? (
                <div className="flex items-center justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : grupos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">Nenhum grupo criado ainda.</p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {grupos.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setSelectedId(g.id)}
                      className={cn(
                        "w-full text-left rounded-md border p-2.5 text-sm transition-colors",
                        selectedId === g.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                      )}
                    >
                      {g.nome} <span className="text-muted-foreground">({g.participantes_count || 0} membros)</span>
                    </button>
                  ))}
                </div>
              )
            )}

            {tipoDestino === "individual" && (
              <div className="space-y-2">
                {selectedContato ? (
                  <div className="flex items-center gap-2 bg-primary/10 rounded-md px-3 py-2">
                    <span className="text-sm font-medium">{selectedContato.nome} ({selectedContato.telefone})</span>
                    <button onClick={() => setSelectedContato(null)} className="ml-auto"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por nome ou telefone..."
                        value={buscaContato}
                        onChange={(e) => setBuscaContato(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    {contatos.length > 0 && (
                      <div className="space-y-1 max-h-40 overflow-y-auto border rounded-md p-1">
                        {contatos.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => { setSelectedContato(c); setBuscaContato(""); setContatos([]); }}
                            className="w-full text-left rounded px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                          >
                            {c.nome} <span className="text-muted-foreground">• {c.telefone}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* 4. AGENDAMENTO */}
        <Collapsible open={agendamentoAberto} onOpenChange={setAgendamentoAberto}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
              📅 Agendar envio
              <ChevronDown className={cn("h-4 w-4 transition-transform", agendamentoAberto && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2">
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("flex-1 justify-start text-left", !dataAgendamento && "text-muted-foreground")}>
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
              <Input
                type="time"
                value={horaAgendamento}
                onChange={(e) => setHoraAgendamento(e.target.value)}
                className="w-28"
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* ERRO */}
        {erro && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 text-sm text-destructive">
            ❌ {erro}
            <p className="text-xs mt-1">Verifique se o WhatsApp está conectado</p>
          </div>
        )}

        {/* 5. BOTÃO ENVIO */}
        <div className="flex gap-2">
          {erro && (
            <Button variant="outline" onClick={() => setErro("")} className="flex-1">
              Tentar novamente
            </Button>
          )}
          <Button
            onClick={handleEnviar}
            disabled={!podeEnviar() || enviando}
            className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
          >
            {enviando ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</>
            ) : isAgendado ? (
              "📅 Agendar"
            ) : (
              "⚡ Enviar agora"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
