import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Bot, User, Send, ArrowLeft, MessageCircle, Hand, RotateCcw, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Conversation = {
  id: string;
  user_id: string;
  contact_number: string;
  contact_name: string | null;
  status: string; // active | handoff | closed
  last_message_at: string | null;
  created_at: string;
};

type Message = {
  id: string;
  conversation_id: string;
  direction: string; // inbound | outbound
  sender: string | null; // ai | human | contact
  content: string;
  message_type: string | null;
  created_at: string;
};

const FILTERS = [
  { value: "todas", label: "Todas" },
  { value: "ia", label: "IA atendendo" },
  { value: "humano", label: "Você atendendo" },
] as const;

export default function AtendimentoCloud() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("todas");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const threadRef = useRef<HTMLDivElement>(null);

  // Auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        navigate("/login");
        return;
      }
      setUserId(data.user.id);
    });
  }, [navigate]);

  // Load conversations + realtime
  useEffect(() => {
    if (!userId) return;
    let mounted = true;

    const load = async () => {
      const { data, error } = await supabase
        .from("whatsapp_cloud_conversations" as any)
        .select("*")
        .eq("user_id", userId)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(200);
      if (error) {
        console.error(error);
        return;
      }
      if (mounted) {
        setConversations((data as any) || []);
        setLoading(false);
      }
    };
    load();

    const channel = supabase
      .channel(`atendimento-cloud-conv-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_cloud_conversations", filter: `user_id=eq.${userId}` },
        () => load()
      )
      .subscribe();

    const poll = setInterval(load, 15000);
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [userId]);

  // Load messages for selected + realtime
  useEffect(() => {
    if (!selectedId || !userId) {
      setMessages([]);
      return;
    }
    let mounted = true;

    const load = async () => {
      const { data, error } = await supabase
        .from("whatsapp_cloud_messages" as any)
        .select("*")
        .eq("conversation_id", selectedId)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) {
        console.error(error);
        return;
      }
      if (mounted) setMessages((data as any) || []);
      setTimeout(() => {
        threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
      }, 50);
    };
    load();

    const channel = supabase
      .channel(`atendimento-cloud-msg-${selectedId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_cloud_messages", filter: `conversation_id=eq.${selectedId}` },
        () => load()
      )
      .subscribe();

    const poll = setInterval(load, 5000);
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [selectedId, userId]);

  const selected = useMemo(() => conversations.find((c) => c.id === selectedId) || null, [conversations, selectedId]);

  const filtered = useMemo(() => {
    if (filter === "ia") return conversations.filter((c) => c.status === "active");
    if (filter === "humano") return conversations.filter((c) => c.status === "handoff");
    return conversations;
  }, [conversations, filter]);

  // 24h window from last inbound message
  const lastInboundAt = useMemo(() => {
    const inbound = messages.filter((m) => m.direction === "inbound");
    if (inbound.length === 0) return null;
    return new Date(inbound[inbound.length - 1].created_at);
  }, [messages]);

  const insideWindow24h = useMemo(() => {
    if (!lastInboundAt) return false;
    return Date.now() - lastInboundAt.getTime() < 24 * 60 * 60 * 1000;
  }, [lastInboundAt]);

  const counts = useMemo(
    () => ({
      todas: conversations.length,
      ia: conversations.filter((c) => c.status === "active").length,
      humano: conversations.filter((c) => c.status === "handoff").length,
    }),
    [conversations]
  );

  const updateStatus = async (status: "active" | "handoff" | "closed") => {
    if (!selected || !userId) return;
    const { error } = await supabase
      .from("whatsapp_cloud_conversations" as any)
      .update({ status })
      .eq("id", selected.id)
      .eq("user_id", userId);
    if (error) {
      toast.error("Não consegui atualizar o status: " + error.message);
      return;
    }
    setConversations((prev) => prev.map((c) => (c.id === selected.id ? { ...c, status } : c)));
    toast.success(status === "handoff" ? "Você assumiu a conversa. IA pausada." : status === "active" ? "Devolvido para a IA." : "Conversa encerrada.");
  };

  const sendManual = async () => {
    if (!selected || !userId || !draft.trim()) return;
    if (selected.status !== "handoff") {
      toast.error("Assuma a conversa antes de enviar manualmente.");
      return;
    }
    if (!insideWindow24h) {
      toast.error("Fora da janela de 24h da Meta. Texto livre bloqueado — precisa usar template.");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-send-message", {
        body: { user_id: userId, to: selected.contact_number, message: draft.trim() },
      });
      if (error) throw error;
      if (data && data.success === false) throw new Error(data.error || "Falha ao enviar");

      // grava em messages como sender=human
      await supabase.from("whatsapp_cloud_messages" as any).insert({
        conversation_id: selected.id,
        user_id: userId,
        direction: "outbound",
        sender: "human",
        content: draft.trim(),
        message_type: "text",
        wamid: data?.message_id ?? null,
      });
      // toca last_message_at
      await supabase
        .from("whatsapp_cloud_conversations" as any)
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", selected.id)
        .eq("user_id", userId);

      setDraft("");
      toast.success("Mensagem enviada.");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar");
    } finally {
      setSending(false);
    }
  };

  const fmtTime = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  const statusBadge = (s: string) => {
    if (s === "handoff") return <Badge className="bg-amber-500 text-white">Você</Badge>;
    if (s === "closed") return <Badge variant="secondary">Encerrada</Badge>;
    return <Badge className="bg-green-600 text-white">IA</Badge>;
  };

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/whatsapp-painel")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Painel WhatsApp
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-green-600" />
            Atendimento Cloud
          </h1>
          <p className="text-sm text-muted-foreground">Inbox 1-a-1 do agente oficial (WhatsApp Cloud API)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ height: "calc(100vh - 180px)" }}>
        {/* LISTA */}
        <Card className="md:col-span-1 flex flex-col overflow-hidden">
          <div className="p-3 border-b">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
              <TabsList className="w-full grid grid-cols-3">
                {FILTERS.map((f) => (
                  <TabsTrigger key={f.value} value={f.value} className="text-xs">
                    {f.label}
                    <span className="ml-1 text-[10px] opacity-70">({counts[f.value]})</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="p-4 text-sm text-muted-foreground">Carregando…</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">Nenhuma conversa.</div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left px-3 py-3 border-b hover:bg-muted/50 transition-colors ${
                    selectedId === c.id ? "bg-muted" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium truncate text-sm">
                      {c.contact_name || c.contact_number}
                    </div>
                    {statusBadge(c.status)}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="text-xs text-muted-foreground truncate">{c.contact_number}</div>
                    <div className="text-[11px] text-muted-foreground whitespace-nowrap ml-2">
                      {fmtTime(c.last_message_at)}
                    </div>
                  </div>
                </button>
              ))
            )}
          </ScrollArea>
        </Card>

        {/* THREAD */}
        <Card className="md:col-span-2 flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Selecione uma conversa para abrir.
            </div>
          ) : (
            <>
              <div className="p-3 border-b flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <div className="font-semibold">{selected.contact_name || selected.contact_number}</div>
                  <div className="text-xs text-muted-foreground">{selected.contact_number}</div>
                </div>
                <div className="flex items-center gap-2">
                  {statusBadge(selected.status)}
                  {selected.status === "handoff" ? (
                    <Button size="sm" variant="outline" onClick={() => updateStatus("active")}>
                      <RotateCcw className="h-4 w-4 mr-1" /> Devolver pra IA
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => updateStatus("handoff")} className="bg-amber-500 hover:bg-amber-600">
                      <Hand className="h-4 w-4 mr-1" /> Assumir conversa
                    </Button>
                  )}
                </div>
              </div>

              <div ref={threadRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
                {messages.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center">Sem mensagens ainda.</div>
                )}
                {messages.map((m) => {
                  const isInbound = m.direction === "inbound";
                  const isHuman = m.sender === "human";
                  return (
                    <div key={m.id} className={`flex ${isInbound ? "justify-start" : "justify-end"}`}>
                      <div
                        className={`max-w-[75%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                          isInbound
                            ? "bg-white border"
                            : isHuman
                            ? "bg-amber-500 text-white"
                            : "bg-green-600 text-white"
                        }`}
                      >
                        <div className="flex items-center gap-1 text-[10px] opacity-80 mb-1">
                          {isInbound ? (
                            <>
                              <User className="h-3 w-3" /> Contato
                            </>
                          ) : isHuman ? (
                            <>
                              <Hand className="h-3 w-3" /> Você
                            </>
                          ) : (
                            <>
                              <Bot className="h-3 w-3" /> IA
                            </>
                          )}
                          <span>· {fmtTime(m.created_at)}</span>
                        </div>
                        <div className="whitespace-pre-wrap break-words">{m.content}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t p-3 space-y-2">
                {selected.status !== "handoff" && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Bot className="h-3 w-3" /> IA está respondendo. Clique em "Assumir conversa" para enviar manualmente.
                  </div>
                )}
                {selected.status === "handoff" && !insideWindow24h && (
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 flex items-start gap-1">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>
                      Fora da janela de 24h da Meta. Texto livre está bloqueado — só dá pra enviar template aprovado.
                    </span>
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    placeholder={
                      selected.status === "handoff"
                        ? insideWindow24h
                          ? "Digite sua resposta…"
                          : "Janela de 24h expirada"
                        : "Assuma a conversa pra enviar manual"
                    }
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendManual();
                      }
                    }}
                    disabled={selected.status !== "handoff" || !insideWindow24h || sending}
                  />
                  <Button
                    onClick={sendManual}
                    disabled={selected.status !== "handoff" || !insideWindow24h || !draft.trim() || sending}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Enviar
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
