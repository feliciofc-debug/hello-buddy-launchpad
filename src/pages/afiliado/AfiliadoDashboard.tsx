import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Package,
  Send,
  DollarSign,
  MessageSquare,
  Smartphone,
  Sparkles,
  BookOpen,
  TrendingUp,
  Users,
  Calendar,
  Megaphone,
  UserPlus,
  Upload,
  Contact,
  Trash2,
  Store,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import ImportContactsWhatsAppCSVModal from "@/components/ImportContactsWhatsAppCSVModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface LeadCapturado {
  id: string;
  phone: string;
  nome: string | null;
  categorias: string[] | null;
  created_at: string;
}

interface GrupoWhatsApp {
  id: string;
  group_jid: string;
  group_name: string;
  member_count: number;
  categoria: string | null;
  is_announce: boolean;
}

interface Participant {
  jid: string;
  phone: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

interface HistoricoEnvio {
  id: string;
  whatsapp: string;
  tipo: string;
  mensagem: string;
  sucesso: boolean;
  erro: string | null;
  timestamp: string;
}

export default function AfiliadoDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [totalContatos, setTotalContatos] = useState(0);
  const [stats, setStats] = useState({
    totalProdutos: 0,
    totalVendas: 0,
    valorVendas: 0,
    disparosAgendados: 0,
    campanhasDisparadas: 0,
    conversasAtivas: 0,
    whatsappConectado: false
  });
  const [leadsCapturados, setLeadsCapturados] = useState<LeadCapturado[]>([]);
  const [deletingLead, setDeletingLead] = useState<string | null>(null);
  const [grupos, setGrupos] = useState<GrupoWhatsApp[]>([]);

  // Detalhes do grupo (Dashboard)
  const [grupoModalOpen, setGrupoModalOpen] = useState(false);
  const [grupoSelecionado, setGrupoSelecionado] = useState<GrupoWhatsApp | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [historicoEnvios, setHistoricoEnvios] = useState<HistoricoEnvio[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  // Modal criar grupo
  const [showGrupoModal, setShowGrupoModal] = useState(false);
  const [novoGrupoNome, setNovoGrupoNome] = useState("");
  const [novoGrupoCategoria, setNovoGrupoCategoria] = useState("geral");
  const [criandoGrupo, setCriandoGrupo] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const CATEGORIAS_GRUPO = [
    { value: "casa", label: "🏠 Casa & Decoração" },
    { value: "beleza", label: "💄 Beleza & Cuidados" },
    { value: "eletronicos", label: "📱 Eletrônicos" },
    { value: "moda", label: "👗 Moda & Acessórios" },
    { value: "esportes", label: "⚽ Esportes & Lazer" },
    { value: "geral", label: "🎁 Ofertas Gerais" },
  ];

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }
      setUserId(user.id);

      // Carregar estatísticas
      const [produtosRes, vendasRes, disparosRes, campanhasRes, clientesRes, contatosRes, gruposRes] = await Promise.all([
        supabase.from('afiliado_produtos').select('id', { count: 'exact' }).eq('user_id', user.id),
        supabase.from('afiliado_vendas').select('valor').eq('user_id', user.id),
        supabase.from('afiliado_disparos').select('id', { count: 'exact' }).eq('user_id', user.id).eq('status', 'agendado'),
        // Campanhas já executadas (total_enviados > 0)
        supabase.from('afiliado_campanhas').select('id, total_enviados').eq('user_id', user.id),
        // Leads captados (últimos 30 dias) - usa leads_ebooks que é a tabela correta
        supabase.from('leads_ebooks')
          .select('id, phone, nome, categorias, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10),
        // Total de contatos cadastrados
        supabase.from('cadastros').select('id', { count: 'exact' }).eq('user_id', user.id),
        // Grupos WhatsApp
        supabase.from('whatsapp_grupos_afiliado')
          .select('id, group_jid, group_name, member_count, categoria, is_announce')
          .eq('user_id', user.id)
          .eq('ativo', true)
          .order('created_at', { ascending: false })
      ]);

      const totalVendas = vendasRes.data?.length || 0;
      const valorVendas = vendasRes.data?.reduce((acc, v) => acc + Number(v.valor || 0), 0) || 0;
      const campanhasDisparadas = campanhasRes.data?.filter(c => (c.total_enviados || 0) > 0).length || 0;

      setTotalContatos(contatosRes.count || 0);

      // Verificar conexão WhatsApp
      const { data: cliente } = await supabase
        .from('clientes_afiliados')
        .select('wuzapi_jid, status')
        .eq('user_id', user.id)
        .single();

      setStats({
        totalProdutos: produtosRes.count || 0,
        totalVendas,
        valorVendas,
        disparosAgendados: disparosRes.count || 0,
        campanhasDisparadas,
        conversasAtivas: 0,
        whatsappConectado: !!cliente?.wuzapi_jid
      });

      // Mapear leads capturados
      const leads: LeadCapturado[] = (clientesRes.data || []).map((c: any) => ({
        id: c.id,
        phone: c.phone,
        nome: c.nome,
        categorias: Array.isArray(c.categorias) ? c.categorias : null,
        created_at: c.created_at
      }));
      setLeadsCapturados(leads);

      // Mapear grupos
      setGrupos((gruposRes.data || []) as GrupoWhatsApp[]);

    } catch (error) {
      console.error('Erro ao carregar stats:', error);
    }
  };

  const abrirDetalhesGrupo = async (grupo: GrupoWhatsApp) => {
    if (!userId) return;

    setGrupoSelecionado(grupo);
    setGrupoModalOpen(true);
    setParticipants([]);
    setHistoricoEnvios([]);

    // Participantes
    setLoadingParticipants(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-group-participants", {
        body: { groupJid: grupo.group_jid, userId },
      });
      if (error) throw error;
      if (data?.success) {
        setParticipants(data.participants || []);
        // Atualizar contagem local também
        setGrupos((prev) =>
          prev.map((g) => (g.id === grupo.id ? { ...g, member_count: data.totalMembers } : g))
        );
      }
    } catch (err) {
      console.error("Erro ao carregar membros do grupo:", err);
      toast.error("Erro ao carregar membros");
    } finally {
      setLoadingParticipants(false);
    }

    // Histórico (mensagens enviadas / produtos)
    setLoadingHistorico(true);
    try {
      const { data, error } = await supabase
        .from("historico_envios")
        .select("*")
        .eq("whatsapp", grupo.group_jid)
        .order("timestamp", { ascending: false })
        .limit(20);

      if (error) throw error;
      setHistoricoEnvios((data || []) as any);
    } catch (err) {
      console.error("Erro ao carregar histórico do grupo:", err);
    } finally {
      setLoadingHistorico(false);
    }
  };

  const handleDeleteLead = async (leadId: string, phone: string) => {
    setDeletingLead(leadId);
    try {
      // Deletar de todas as tabelas relacionadas
      await Promise.all([
        supabase.from('leads_ebooks').delete().eq('id', leadId),
        supabase.from('afiliado_clientes_ebooks').delete().eq('phone', phone),
        supabase.from('afiliado_user_states').delete().eq('phone', phone),
        supabase.from('afiliado_conversas').delete().eq('phone', phone),
        supabase.from('afiliado_cliente_preferencias').delete().eq('phone', phone),
        supabase.from('afiliado_cashback').delete().eq('phone', phone),
      ]);

      // Atualizar lista local
      setLeadsCapturados(prev => prev.filter(l => l.id !== leadId));
      toast.success('Lead removido com sucesso');
    } catch (error) {
      console.error('Erro ao deletar lead:', error);
      toast.error('Erro ao deletar lead');
    } finally {
      setDeletingLead(null);
    }
  };

  const criarGrupo = async () => {
    if (!userId || !novoGrupoNome.trim()) {
      toast.error("Digite o nome do grupo");
      return;
    }

    setCriandoGrupo(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-whatsapp-group", {
        body: {
          groupName: novoGrupoNome.trim(),
          categoria: novoGrupoCategoria,
          userId
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success("Grupo criado com sucesso!");
        if (data.inviteLink) {
          navigator.clipboard.writeText(data.inviteLink);
          toast.success("Link de convite copiado!");
        }
        setShowGrupoModal(false);
        setNovoGrupoNome("");
      } else {
        throw new Error(data.error || "Erro ao criar grupo");
      }
    } catch (error: any) {
      console.error("Erro ao criar grupo:", error);
      toast.error(error.message || "Erro ao criar grupo");
    } finally {
      setCriandoGrupo(false);
    }
  };

  const menuItems = [
    { 
      title: "Conectar Celular", 
      icon: Smartphone, 
      path: "/afiliado/conectar-celular",
      description: "Conecte seu WhatsApp",
      color: "bg-green-500"
    },
    { 
      title: "Grupos WhatsApp", 
      icon: UsersRound, 
      path: "/afiliado/grupos",
      description: "Grupos para envios",
      color: "bg-teal-500"
    },
    { 
      title: "WhatsApp", 
      icon: MessageSquare, 
      path: "/afiliado/whatsapp",
      description: "Enviar mensagens",
      color: "bg-emerald-500"
    },
    { 
      title: "IA Marketing", 
      icon: Sparkles, 
      path: "/afiliado/ia-marketing",
      description: "Gerar posts com IA",
      color: "bg-purple-500"
    },
    { 
      title: "Produtos Amazon", 
      icon: Package, 
      path: "/afiliado/produtos/amazon",
      description: "Produtos Amazon",
      color: "bg-orange-500"
    },
    { 
      title: "Produtos Magalu", 
      icon: Package, 
      path: "/afiliado/produtos/magalu",
      description: "Magazine Luiza",
      color: "bg-blue-500"
    },
    { 
      title: "Produtos M. Livre", 
      icon: Package, 
      path: "/afiliado/produtos/mercado-livre",
      description: "Mercado Livre",
      color: "bg-yellow-500"
    },
    {
      title: "Produtos Shopee",
      icon: Store,
      path: "/afiliado/produtos/shopee",
      description: "Shopee",
      color: "bg-orange-600",
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">AMZ Ofertas Afiliados</h1>
            <p className="text-muted-foreground mt-1">Painel de controle</p>
          </div>
          <Button onClick={() => setShowGrupoModal(true)} className="gap-2">
            <UsersRound className="h-4 w-4" />
            Criar Grupo
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <Package className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalProdutos}</p>
                  <p className="text-xs text-muted-foreground">Produtos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalVendas}</p>
                  <p className="text-xs text-muted-foreground">Vendas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">R$ {stats.valorVendas.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">Faturamento</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Calendar className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.disparosAgendados}</p>
                  <p className="text-xs text-muted-foreground">Agendados</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <Megaphone className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.campanhasDisparadas}</p>
                  <p className="text-xs text-muted-foreground">Campanhas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Card Seus Contatos */}
        <Card className="mb-8 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Contact className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">{totalContatos}</h3>
                  <p className="text-muted-foreground">Seus Contatos</p>
                </div>
              </div>
              <Button 
                onClick={() => setShowImportModal(true)}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Importar CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Leads Capturados */}
        {leadsCapturados.length > 0 && (
          <Card className="mb-8">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserPlus className="h-5 w-5 text-green-500" />
                Leads Capturados ({leadsCapturados.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-3">
                  {leadsCapturados.map((lead) => (
                    <div key={lead.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {lead.nome || 'Lead'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {lead.phone}
                        </p>
                        {lead.categorias && lead.categorias.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {lead.categorias.map((cat, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs capitalize">
                                {cat}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                        </Badge>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={deletingLead === lead.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Deletar Lead</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja deletar o lead <strong>{lead.nome || lead.phone}</strong>? 
                                Esta ação irá remover todas as conversas, estados e dados associados.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDeleteLead(lead.id, lead.phone)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Deletar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Grupos WhatsApp */}
        {grupos.length > 0 && (
          <Card className="mb-8 border-teal-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <UsersRound className="h-5 w-5 text-teal-500" />
                  Grupos WhatsApp ({grupos.length})
                </CardTitle>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate('/afiliado/grupos')}
                >
                  Ver Todos
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {grupos.slice(0, 4).map((grupo) => (
                  <div 
                    key={grupo.id} 
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => abrirDetalhesGrupo(grupo)}
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{grupo.group_name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <Users className="h-3 w-3" />
                        <span>{grupo.member_count} membros</span>
                        {grupo.is_announce && (
                          <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                            Só Admins
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs capitalize">
                      {grupo.categoria || 'geral'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status WhatsApp */}
        <Card className={`mb-8 ${stats.whatsappConectado ? 'border-green-500' : 'border-yellow-500'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stats.whatsappConectado ? 'bg-green-100 dark:bg-green-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30'}`}>
                  <Smartphone className={`h-5 w-5 ${stats.whatsappConectado ? 'text-green-500' : 'text-yellow-500'}`} />
                </div>
                <div>
                  <p className="font-medium">WhatsApp</p>
                  <p className={`text-sm ${stats.whatsappConectado ? 'text-green-500' : 'text-yellow-500'}`}>
                    {stats.whatsappConectado ? 'Conectado' : 'Não conectado'}
                  </p>
                </div>
              </div>
              {!stats.whatsappConectado && (
                <Button onClick={() => navigate('/afiliado/conectar-celular')} size="sm">
                  Conectar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Menu Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {menuItems.map((item) => (
            <Card 
              key={item.path}
              className="cursor-pointer hover:shadow-lg transition-all hover:scale-105"
              onClick={() => navigate(item.path)}
            >
              <CardContent className="p-6 text-center">
                <div className={`w-12 h-12 mx-auto mb-3 rounded-xl ${item.color} flex items-center justify-center`}>
                  <item.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold text-foreground">{item.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Logout */}
        <div className="mt-8 text-center">
          <Button 
            variant="outline" 
            onClick={async () => {
              await supabase.auth.signOut();
              navigate('/login');
            }}
          >
            Sair
          </Button>
        </div>
      </div>

      {/* Modal Detalhes do Grupo (membros + envios) */}
      <Dialog open={grupoModalOpen} onOpenChange={setGrupoModalOpen}>
        <DialogContent className="bg-background max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{grupoSelecionado?.group_name || "Grupo"}</span>
              {grupoSelecionado?.is_announce && (
                <Badge variant="outline" className="text-xs">
                  Só Admins
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Membros ({grupoSelecionado?.member_count ?? 0})</p>
              <ScrollArea className="h-[260px] rounded-md border">
                <div className="p-3 space-y-2">
                  {loadingParticipants ? (
                    <p className="text-sm text-muted-foreground">Carregando membros...</p>
                  ) : participants.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem membros para mostrar.</p>
                  ) : (
                    participants.map((p) => (
                      <div key={p.jid} className="flex items-center justify-between text-sm">
                        <span className="font-mono">{p.phone}</span>
                        {(p.isSuperAdmin || p.isAdmin) && (
                          <Badge variant="secondary" className="text-xs">
                            {p.isSuperAdmin ? "Super Admin" : "Admin"}
                          </Badge>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Últimos envios</p>
              <ScrollArea className="h-[260px] rounded-md border">
                <div className="p-3 space-y-3">
                  {loadingHistorico ? (
                    <p className="text-sm text-muted-foreground">Carregando envios...</p>
                  ) : historicoEnvios.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum envio ainda.</p>
                  ) : (
                    historicoEnvios.map((h) => (
                      <div key={h.id} className="text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant={h.sucesso ? "secondary" : "outline"} className="text-xs">
                            {h.sucesso ? "Enviado" : "Falhou"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(h.timestamp).toLocaleString("pt-BR")}
                          </span>
                        </div>
                        {h.mensagem && (
                          <p className="mt-1 text-sm text-foreground line-clamp-3">{h.mensagem}</p>
                        )}
                        {h.erro && !h.sucesso && (
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{h.erro}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => navigate('/afiliado/grupos')}>Ver tela completa</Button>
            <Button onClick={() => setGrupoModalOpen(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Importação */}
      <ImportContactsWhatsAppCSVModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          loadStats();
        }}
      />

      {/* Modal Criar Grupo WhatsApp */}
      <Dialog open={showGrupoModal} onOpenChange={setShowGrupoModal}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UsersRound className="h-5 w-5" />
              Criar Grupo WhatsApp
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Nome do Grupo</Label>
              <Input
                placeholder="Ex: 🔥 Ofertas Casa & Decoração"
                value={novoGrupoNome}
                onChange={(e) => setNovoGrupoNome(e.target.value)}
              />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={novoGrupoCategoria} onValueChange={setNovoGrupoCategoria}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {CATEGORIAS_GRUPO.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              className="w-full" 
              onClick={criarGrupo}
              disabled={criandoGrupo}
            >
              {criandoGrupo ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <UsersRound className="h-4 w-4 mr-2" />
              )}
              Criar Grupo
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              O link de convite será copiado automaticamente após a criação
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
