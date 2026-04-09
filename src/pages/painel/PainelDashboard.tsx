import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield, Activity, Users, AlertTriangle, CheckCircle, XCircle,
  Search, LogOut, RefreshCw, Wifi, WifiOff, MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import TicketList, { type Ticket } from "./components/TicketList";
import TicketChat from "./components/TicketChat";
import NewTicketForm from "./components/NewTicketForm";

interface EdgeFunctionHealth {
  function_name: string;
  status: string;
  last_check: string | null;
  last_error: string | null;
  consecutive_failures: number | null;
  is_critical: boolean | null;
}

interface ClienteInfo {
  email: string;
  nome_fantasia: string | null;
  tipo: string | null;
  whatsapp_connected: boolean;
  subscription_status: string | null;
  last_sign_in: string | null;
}

export default function PainelDashboard() {
  const navigate = useNavigate();
  const [healthData, setHealthData] = useState<EdgeFunctionHealth[]>([]);
  const [clientes, setClientes] = useState<ClienteInfo[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedCliente, setSelectedCliente] = useState<ClienteInfo | null>(null);
  const [activeTab, setActiveTab] = useState("chamados");

  // Ticket state
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showNewTicket, setShowNewTicket] = useState(false);

  useEffect(() => {
    const auth = sessionStorage.getItem("painel_auth");
    if (!auth) { navigate("/painel"); return; }
    loadData();
    loadTickets();
  }, []);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadHealth(), loadClientes()]);
    setLoading(false);
  };

  const loadHealth = async () => {
    const { data } = await supabase.from("edge_functions_health").select("*").order("function_name");
    if (data) setHealthData(data as EdgeFunctionHealth[]);
  };

  const loadClientes = async () => {
    const { data: profiles } = await supabase
      .from("profiles").select("id, nome, nome_fantasia, whatsapp, tipo")
      .order("created_at", { ascending: false }).limit(100);
    if (!profiles) return;

    const { data: subs } = await supabase.from("billing_subscriptions").select("customer_id, status").eq("status", "active");
    const { data: customers } = await supabase.from("billing_customers").select("id, email, platform_login");
    const { data: wuzapiConfigs } = await supabase.from("pj_clientes_config").select("user_id, wuzapi_jid");

    const clientesList: ClienteInfo[] = profiles.map((p: any) => {
      const customer = customers?.find((c: any) => c.platform_login === p.id || c.email === p.whatsapp);
      const sub = customer ? subs?.find((s: any) => s.customer_id === customer.id) : null;
      const wuzapi = wuzapiConfigs?.find((w: any) => w.user_id === p.id);
      return {
        email: p.whatsapp || p.nome || "—",
        nome_fantasia: p.nome_fantasia || p.nome,
        tipo: p.tipo,
        whatsapp_connected: !!wuzapi?.wuzapi_jid,
        subscription_status: sub?.status || "sem assinatura",
        last_sign_in: null,
      };
    });
    setClientes(clientesList);
  };

  const loadTickets = async () => {
    setTicketsLoading(true);
    const { data } = await supabase
      .from("support_tickets").select("*")
      .order("created_at", { ascending: false }).limit(100);
    if (data) setTickets(data as Ticket[]);
    setTicketsLoading(false);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("painel_auth");
    sessionStorage.removeItem("painel_auth_time");
    navigate("/painel");
  };

  const onlineCount = healthData.filter((h) => h.status === "online").length;
  const offlineCount = healthData.filter((h) => h.status !== "online").length;
  const openTickets = tickets.filter((t) => t.status === "aberto" || t.status === "em_andamento").length;

  const filteredClientes = clientes.filter(
    (c) =>
      c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.nome_fantasia?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-emerald-400" />
            <div>
              <h1 className="text-lg font-bold">ATOM BRASIL</h1>
              <p className="text-xs text-emerald-400 tracking-widest">PAINEL DE SUPORTE</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { loadData(); loadTickets(); }} className="text-slate-300 hover:text-white">
              <RefreshCw className="w-4 h-4 mr-1" /> Atualizar
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-red-400 hover:text-red-300">
              <LogOut className="w-4 h-4 mr-1" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{onlineCount}</p>
                <p className="text-xs text-slate-400">Online</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <XCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{offlineCount}</p>
                <p className="text-xs text-slate-400">Offline</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{clientes.length}</p>
                <p className="text-xs text-slate-400">Clientes</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {healthData.filter((h) => (h.consecutive_failures || 0) > 0).length}
                </p>
                <p className="text-xs text-slate-400">Falhas</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <MessageSquare className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{openTickets}</p>
                <p className="text-xs text-slate-400">Chamados</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="chamados" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              <MessageSquare className="w-4 h-4 mr-1" /> Chamados {openTickets > 0 && (
                <Badge className="ml-1 bg-red-500 text-white text-[10px] px-1.5">{openTickets}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="monitor" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              <Activity className="w-4 h-4 mr-1" /> Monitor
            </TabsTrigger>
            <TabsTrigger value="clientes" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              <Users className="w-4 h-4 mr-1" /> Clientes
            </TabsTrigger>
          </TabsList>

          {/* === CHAMADOS TAB === */}
          <TabsContent value="chamados" className="mt-4">
            {showNewTicket ? (
              <NewTicketForm onBack={() => setShowNewTicket(false)} onCreated={() => { setShowNewTicket(false); loadTickets(); }} />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ height: "calc(100vh - 340px)" }}>
                <div className="lg:col-span-1 h-full">
                  <TicketList
                    tickets={tickets}
                    loading={ticketsLoading}
                    onSelectTicket={(t) => setSelectedTicket(t)}
                    onNewTicket={() => setShowNewTicket(true)}
                    selectedTicketId={selectedTicket?.id}
                  />
                </div>
                <div className="lg:col-span-2 h-full">
                  {selectedTicket ? (
                    <TicketChat
                      ticket={selectedTicket}
                      onBack={() => setSelectedTicket(null)}
                      onStatusChange={loadTickets}
                    />
                  ) : (
                    <Card className="bg-slate-800 border-slate-700 h-full flex items-center justify-center">
                      <div className="text-center text-slate-500">
                        <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Selecione um chamado para abrir o chat</p>
                      </div>
                    </Card>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* === MONITOR TAB === */}
          <TabsContent value="monitor" className="mt-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white flex items-center gap-2 text-base">
                  <Activity className="w-5 h-5 text-emerald-400" />
                  Status das Edge Functions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
                {loading ? (
                  <p className="text-slate-400 text-sm">Carregando...</p>
                ) : healthData.length === 0 ? (
                  <p className="text-slate-400 text-sm">Nenhum dado de health check</p>
                ) : (
                  healthData.map((fn) => (
                    <div key={fn.function_name} className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${fn.status === "online" ? "bg-emerald-400" : "bg-red-400 animate-pulse"}`} />
                        <span className="text-sm text-slate-200 truncate">{fn.function_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {fn.is_critical && <Badge variant="outline" className="border-amber-500/50 text-amber-400 text-[10px]">Crítica</Badge>}
                        <Badge className={fn.status === "online" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}>
                          {fn.status === "online" ? "Online" : "Offline"}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === CLIENTES TAB === */}
          <TabsContent value="clientes" className="mt-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white flex items-center gap-2 text-base">
                  <Users className="w-5 h-5 text-blue-400" /> Clientes
                </CardTitle>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input placeholder="Buscar cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400" />
                </div>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
                {loading ? (
                  <p className="text-slate-400 text-sm">Carregando...</p>
                ) : filteredClientes.length === 0 ? (
                  <p className="text-slate-400 text-sm">Nenhum cliente encontrado</p>
                ) : (
                  filteredClientes.slice(0, 30).map((cliente, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors cursor-pointer" onClick={() => setSelectedCliente(cliente)}>
                      <div className="min-w-0">
                        <p className="text-sm text-white font-medium truncate">{cliente.nome_fantasia || "Sem nome"}</p>
                        <p className="text-xs text-slate-400 truncate">{cliente.email}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {cliente.whatsapp_connected ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-slate-500" />}
                        <Badge className={cliente.subscription_status === "active" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-slate-600/50 text-slate-400 border-slate-500/30"}>
                          {cliente.subscription_status === "active" ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Cliente detail */}
            {selectedCliente && (
              <Card className="bg-slate-800 border-slate-700 mt-4">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white text-base">Detalhes: {selectedCliente.nome_fantasia || selectedCliente.email}</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedCliente(null)} className="text-slate-400">Fechar</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-slate-700/50 rounded-lg">
                      <p className="text-xs text-slate-400 mb-1">Email/Contato</p>
                      <p className="text-sm text-white">{selectedCliente.email}</p>
                    </div>
                    <div className="p-3 bg-slate-700/50 rounded-lg">
                      <p className="text-xs text-slate-400 mb-1">Tipo</p>
                      <p className="text-sm text-white">{selectedCliente.tipo || "PJ"}</p>
                    </div>
                    <div className="p-3 bg-slate-700/50 rounded-lg">
                      <p className="text-xs text-slate-400 mb-1">WhatsApp</p>
                      <p className="text-sm">{selectedCliente.whatsapp_connected ? <span className="text-emerald-400">Conectado</span> : <span className="text-red-400">Desconectado</span>}</p>
                    </div>
                    <div className="p-3 bg-slate-700/50 rounded-lg">
                      <p className="text-xs text-slate-400 mb-1">Assinatura</p>
                      <p className="text-sm">{selectedCliente.subscription_status === "active" ? <span className="text-emerald-400">Ativa</span> : <span className="text-amber-400">{selectedCliente.subscription_status}</span>}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
