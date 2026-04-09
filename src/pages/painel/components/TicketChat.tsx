import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Send,
  Bot,
  User,
  Headphones,
  ArrowLeft,
  CheckCircle,
  Loader2,
} from "lucide-react";
import type { Ticket } from "./TicketList";

interface Message {
  id: string;
  sender_type: string;
  sender_name: string | null;
  content: string;
  created_at: string;
}

interface TicketChatProps {
  ticket: Ticket;
  onBack: () => void;
  onStatusChange: () => void;
}

export default function TicketChat({ ticket, onBack, onStatusChange }: TicketChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [status, setStatus] = useState(ticket.status);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    const channel = supabase
      .channel(`ticket-${ticket.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `ticket_id=eq.${ticket.id}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [ticket.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadMessages = async () => {
    const { data } = await supabase
      .from("support_messages")
      .select("*")
      .eq("ticket_id", ticket.id)
      .order("created_at");
    if (data) setMessages(data as Message[]);
  };

  const sendMessage = async (type: "operador" | "cliente", content: string) => {
    if (!content.trim()) return;
    await supabase.from("support_messages").insert({
      ticket_id: ticket.id,
      sender_type: type,
      sender_name: type === "operador" ? "Operador" : ticket.cliente_nome || ticket.cliente_email,
      content: content.trim(),
    });
    if (status === "aberto") {
      await supabase.from("support_tickets").update({ status: "em_andamento" }).eq("id", ticket.id);
      setStatus("em_andamento");
      onStatusChange();
    }
  };

  const handleSendOperador = async () => {
    if (!input.trim()) return;
    const msg = input;
    setInput("");
    await sendMessage("operador", msg);
  };

  const askAI = async () => {
    setAiLoading(true);
    try {
      // Gather context for AI
      const context = messages.map((m) => `[${m.sender_type}] ${m.content}`).join("\n");
      
      const systemPrompt = `Você é o assistente de suporte técnico da Atom Brasil para a plataforma amzofertas.com.br.
Você tem acesso ao histórico do chamado e deve diagnosticar o problema do cliente.
Responda em português, de forma clara e técnica.
Se identificar o problema, sugira a solução.
Se precisar de mais informações, peça ao operador.
Categorias comuns de problemas: login/acesso, WhatsApp desconectado, produtos não salvando, pagamento, bugs.
NUNCA execute ações destrutivas. Apenas diagnostique e sugira soluções.

Informações do chamado:
- Cliente: ${ticket.cliente_nome || "N/A"} (${ticket.cliente_email})
- Assunto: ${ticket.assunto}
- Descrição: ${ticket.descricao || "N/A"}
- Categoria: ${ticket.categoria}
- Prioridade: ${ticket.prioridade}`;

      const response = await supabase.functions.invoke("ai-support-diagnostic", {
        body: {
          system: systemPrompt,
          messages: context,
          ticket_id: ticket.id,
        },
      });

      if (response.error) throw new Error(response.error.message);
      
      const aiResponse = response.data?.response || "Não consegui gerar diagnóstico. Tente novamente.";
      
      await supabase.from("support_messages").insert({
        ticket_id: ticket.id,
        sender_type: "ia",
        sender_name: "Atom IA",
        content: aiResponse,
      });
    } catch (err: any) {
      toast.error("Erro na IA: " + err.message);
    }
    setAiLoading(false);
  };

  const handleChangeStatus = async (newStatus: string) => {
    await supabase.from("support_tickets").update({ 
      status: newStatus,
      ...(newStatus === "resolvido" ? { resolvido_por: "operador" } : {}),
    }).eq("id", ticket.id);
    setStatus(newStatus);
    onStatusChange();
    toast.success(`Status alterado para ${newStatus}`);
  };

  const senderIcon = (type: string) => {
    switch (type) {
      case "ia": return <Bot className="w-4 h-4 text-purple-400" />;
      case "operador": return <Headphones className="w-4 h-4 text-emerald-400" />;
      default: return <User className="w-4 h-4 text-blue-400" />;
    }
  };

  const senderBg = (type: string) => {
    switch (type) {
      case "ia": return "bg-purple-500/10 border-purple-500/20";
      case "operador": return "bg-emerald-500/10 border-emerald-500/20";
      default: return "bg-blue-500/10 border-blue-500/20";
    }
  };

  return (
    <Card className="bg-slate-800 border-slate-700 h-full flex flex-col">
      <CardHeader className="pb-2 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-400 lg:hidden">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <CardTitle className="text-white text-sm">{ticket.assunto}</CardTitle>
              <p className="text-xs text-slate-400">{ticket.cliente_nome || ticket.cliente_email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={status} onValueChange={handleChangeStatus}>
              <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white text-xs w-36 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aberto">Aberto</SelectItem>
                <SelectItem value="em_andamento">Em Andamento</SelectItem>
                <SelectItem value="resolvido">Resolvido</SelectItem>
                <SelectItem value="fechado">Fechado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      {/* Messages */}
      <CardContent className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {/* Ticket description as first message */}
        {ticket.descricao && (
          <div className={`p-3 rounded-lg border ${senderBg("cliente")}`}>
            <div className="flex items-center gap-2 mb-1">
              {senderIcon("cliente")}
              <span className="text-xs font-medium text-blue-400">
                {ticket.cliente_nome || ticket.cliente_email}
              </span>
              <span className="text-[10px] text-slate-500">abertura</span>
            </div>
            <p className="text-sm text-slate-200 whitespace-pre-wrap">{ticket.descricao}</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`p-3 rounded-lg border ${senderBg(msg.sender_type)}`}>
            <div className="flex items-center gap-2 mb-1">
              {senderIcon(msg.sender_type)}
              <span className={`text-xs font-medium ${
                msg.sender_type === "ia" ? "text-purple-400" : 
                msg.sender_type === "operador" ? "text-emerald-400" : "text-blue-400"
              }`}>
                {msg.sender_name || msg.sender_type}
              </span>
              <span className="text-[10px] text-slate-500">
                {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <p className="text-sm text-slate-200 whitespace-pre-wrap">{msg.content}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </CardContent>

      {/* Input area */}
      <div className="p-3 border-t border-slate-700 space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder="Digitar mensagem..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendOperador()}
            className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
          />
          <Button onClick={handleSendOperador} disabled={!input.trim() || sending} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <Button
          onClick={askAI}
          disabled={aiLoading}
          variant="outline"
          size="sm"
          className="w-full border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
        >
          {aiLoading ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> IA diagnosticando...</>
          ) : (
            <><Bot className="w-4 h-4 mr-2" /> Pedir diagnóstico à IA</>
          )}
        </Button>
      </div>
    </Card>
  );
}
