import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { useClientMenus } from '@/hooks/useClientMenus';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Send,
  Users,
  CheckCircle,
  Zap,
  MessageCircle,
  TrendingUp,
  Activity,
  Target,
  Clock,
  RefreshCw,
  Bot,
  Package,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  BookOpen,
  Megaphone,
  MessageSquare,
  Plus,
  Calendar,
  Eye,
  ExternalLink,
  Flame,
  DollarSign,
  MousePointer,
  Search,
  Smartphone,
  Building2,
  Sparkles,
  Share2,
  Shield,
  Plug
} from 'lucide-react';
import NotificationCenter from '@/components/NotificationCenter';
import LanguageSwitcher from '@/components/LanguageSwitcher';

import { LeadsQuentes } from '@/components/LeadsQuentes';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface Metricas {
  totalMensagens: number;
  mensagensHoje: number;
  totalConversas: number;
  conversasHoje: number;
  totalLeads: number;
  leadsQuentes: number;
  totalCampanhas: number;
  campanhasAtivas: number;
  taxaAutomacao: number;
  mensagensIA: number;
  mensagensHumano: number;
  crescimentoSemanal: number;
}

interface DadosGraficos {
  mensagensPorDia: { dia: string; enviadas: number; recebidas: number }[];
  leadsNoFunil: { nome: string; valor: number; cor: string }[];
  campanhasPorStatus: { status: string; valor: number; cor: string }[];
  atendimentoPorTipo: { tipo: string; valor: number; cor: string }[];
}

export default function DashboardMetricas() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [metricas, setMetricas] = useState<Metricas>({
    totalMensagens: 0,
    mensagensHoje: 0,
    totalConversas: 0,
    conversasHoje: 0,
    totalLeads: 0,
    leadsQuentes: 0,
    totalCampanhas: 0,
    campanhasAtivas: 0,
    taxaAutomacao: 0,
    mensagensIA: 0,
    mensagensHumano: 0,
    crescimentoSemanal: 0
  });

  const [dadosGraficos, setDadosGraficos] = useState<DadosGraficos>({
    mensagensPorDia: [],
    leadsNoFunil: [],
    campanhasPorStatus: [],
    atendimentoPorTipo: []
  });
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const { isMenuAllowed, empresaNome } = useClientMenus(userProfile?.tipo, userProfile?.nome_fantasia);

  const carregarPerfil = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setUserEmail(user.email ?? null);

    const { data: profile } = await supabase
      .from('profiles')
      .select('tipo, nome_fantasia')
      .eq('id', user.id)
      .maybeSingle();

    setUserProfile(profile ?? null);
  };

  useEffect(() => {
    carregarPerfil();
    carregarMetricas();
    const interval = setInterval(carregarMetricas, 60000); // Atualiza a cada minuto
    return () => clearInterval(interval);
  }, []);

  const carregarMetricas = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const semanaAtras = new Date(hoje);
      semanaAtras.setDate(semanaAtras.getDate() - 7);

      // Buscar métricas em paralelo
      const [
        mensagensResult,
        mensagensHojeResult,
        conversasResult,
        conversasHojeResult,
        conversasIAResult,
        conversasHumanoResult,
        campanhasResult,
        campanhasAtivasResult,
        leadsB2BResult,
        leadsB2CResult,
        leadsQuentesResult
      ] = await Promise.all([
        // Total mensagens
        supabase.from('whatsapp_messages').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        // Mensagens hoje
        supabase.from('whatsapp_messages').select('*', { count: 'exact', head: true }).eq('user_id', user.id).gte('timestamp', hoje.toISOString()),
        // Total conversas
        supabase.from('whatsapp_conversations').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        // Conversas hoje
        supabase.from('whatsapp_conversations').select('*', { count: 'exact', head: true }).eq('user_id', user.id).gte('last_message_at', hoje.toISOString()),
        // Conversas atendidas por IA
        supabase.from('whatsapp_conversations').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('modo_atendimento', 'ia'),
        // Conversas atendidas por humano
        supabase.from('whatsapp_conversations').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('modo_atendimento', 'humano'),
        // Total campanhas
        supabase.from('campanhas_recorrentes').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        // Campanhas ativas
        supabase.from('campanhas_recorrentes').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('ativa', true),
        // Leads B2B
        supabase.from('leads_b2b').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        // Leads B2C
        supabase.from('leads_b2c').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        // Leads quentes (score > 70)
        supabase.from('leads_b2c').select('*', { count: 'exact', head: true }).eq('user_id', user.id).gte('score', 70)
      ]);

      const totalMensagens = mensagensResult.count || 0;
      const mensagensHoje = mensagensHojeResult.count || 0;
      const totalConversas = conversasResult.count || 0;
      const conversasHoje = conversasHojeResult.count || 0;
      const conversasIA = conversasIAResult.count || 0;
      const conversasHumano = conversasHumanoResult.count || 0;
      const totalCampanhas = campanhasResult.count || 0;
      const campanhasAtivas = campanhasAtivasResult.count || 0;
      const leadsB2B = leadsB2BResult.count || 0;
      const leadsB2C = leadsB2CResult.count || 0;
      const leadsQuentes = leadsQuentesResult.count || 0;

      const totalLeads = leadsB2B + leadsB2C;
      const taxaAutomacao = totalConversas > 0 ? (conversasIA / totalConversas) * 100 : 0;

      // Buscar mensagens dos últimos 7 dias para gráfico
      const { data: mensagensSemana } = await supabase
        .from('whatsapp_messages')
        .select('timestamp, direction')
        .eq('user_id', user.id)
        .gte('timestamp', semanaAtras.toISOString())
        .order('timestamp', { ascending: true });

      // Agrupar por dia
      const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const mensagensPorDia: { dia: string; enviadas: number; recebidas: number }[] = [];
      
      for (let i = 6; i >= 0; i--) {
        const data = new Date();
        data.setDate(data.getDate() - i);
        const diaInicio = new Date(data);
        diaInicio.setHours(0, 0, 0, 0);
        const diaFim = new Date(data);
        diaFim.setHours(23, 59, 59, 999);

        const msgDoDia = mensagensSemana?.filter(m => {
          const msgDate = new Date(m.timestamp);
          return msgDate >= diaInicio && msgDate <= diaFim;
        }) || [];

        mensagensPorDia.push({
          dia: diasSemana[data.getDay()],
          enviadas: msgDoDia.filter(m => m.direction === 'sent').length,
          recebidas: msgDoDia.filter(m => m.direction === 'received').length
        });
      }

      setMetricas({
        totalMensagens,
        mensagensHoje,
        totalConversas,
        conversasHoje,
        totalLeads,
        leadsQuentes,
        totalCampanhas,
        campanhasAtivas,
        taxaAutomacao: Math.round(taxaAutomacao),
        mensagensIA: conversasIA,
        mensagensHumano: conversasHumano,
        crescimentoSemanal: 15 // Calcular baseado em dados históricos depois
      });

      setDadosGraficos({
        mensagensPorDia,
        leadsNoFunil: [
          { nome: 'Novos', valor: totalLeads, cor: '#3b82f6' },
          { nome: 'Engajados', valor: Math.floor(totalLeads * 0.6), cor: '#8b5cf6' },
          { nome: 'Quentes', valor: leadsQuentes, cor: '#f59e0b' },
          { nome: 'Convertidos', valor: Math.floor(leadsQuentes * 0.3), cor: '#10b981' }
        ],
        campanhasPorStatus: [
          { status: 'Ativas', valor: campanhasAtivas, cor: '#10b981' },
          { status: 'Pausadas', valor: totalCampanhas - campanhasAtivas, cor: '#6b7280' }
        ],
        atendimentoPorTipo: [
          { tipo: 'IA', valor: conversasIA, cor: '#8b5cf6' },
          { tipo: 'Humano', valor: conversasHumano, cor: '#3b82f6' }
        ]
      });

    } catch (error) {
      console.error('Erro ao carregar métricas:', error);
    } finally {
      setLoading(false);
    }
  };

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const menuItemsAll = [
    { id: 'dashboard', icon: BarChart3, label: t('nav.dashboard'), path: '/dashboard' },
    { id: 'produtos', icon: Package, label: t('nav.products'), path: '/meus-produtos' },
    { id: 'ia-marketing', icon: Zap, label: t('nav.ia_marketing'), path: '/ia-marketing' },
    { id: 'redes-sociais', icon: Share2, label: t('nav.social_networks'), path: '/redes-sociais' },
    { id: 'whatsapp', icon: MessageCircle, label: t('nav.whatsapp'), path: '/whatsapp-painel' },
    // { id: 'integracoes', icon: Plug, label: t('nav.integrations', 'Integrações'), path: '/integracoes' }, // Oculto - reativar removendo o comentário
    { id: 'configuracoes', icon: Settings, label: t('nav.settings'), path: '/configuracoes' },
    ...(userEmail === 'expo@atombrasildigital.com'
      ? [{ id: 'admin', icon: Shield, label: 'Admin', path: '/admin' }]
      : []),
  ];

  const menuItems = menuItemsAll.filter((item) => item.id === 'admin' || isMenuAllowed(item.id));

  // Componente de campanhas em andamento
  const CampanhasEmAndamentoSection = ({ navigate }: { navigate: (path: string) => void }) => {
    const [campanhas, setCampanhas] = useState<any[]>([]);
    
    useEffect(() => {
      const loadCampanhas = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const { data } = await supabase
          .from('campanhas_recorrentes')
          .select('*, produtos(nome, imagem_url)')
          .eq('user_id', user.id)
          .eq('ativa', true)
          .limit(3);
        
        setCampanhas(data || []);
      };
      loadCampanhas();
    }, []);

    if (campanhas.length === 0) {
      return (
        <div className="text-center py-4 text-muted-foreground">
          <p className="text-sm">Nenhuma campanha ativa</p>
          <Button size="sm" variant="link" onClick={() => navigate('/campanhas')}>
            Criar primeira campanha
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {campanhas.map((campanha) => (
          <div key={campanha.id} className="bg-muted/50 rounded-lg p-3 flex justify-between items-center">
            <div>
              <p className="font-medium text-sm">{campanha.nome}</p>
              <p className="text-xs text-muted-foreground">
                {campanha.total_enviados || 0} enviados • {campanha.frequencia}
              </p>
            </div>
            <Badge variant="secondary" className="text-xs">
              🚀 Ativa
            </Badge>
          </div>
        ))}
      </div>
    );
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">{t('dashboard.loading_metrics')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform duration-300 lg:translate-x-0 lg:static ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
           <div className="p-4 border-b flex items-center justify-between">
             <h2 className="text-xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
               {empresaNome}
             </h2>
             <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsMenuOpen(false)}>
               <X className="w-5 h-5" />
             </Button>
           </div>

          {/* Menu Items */}
          <nav className="flex-1 p-4 space-y-1">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  (item as any).highlight 
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold shadow-md hover:shadow-lg' 
                    : item.path === '/dashboard' 
                      ? 'bg-primary/10 text-primary' 
                      : 'text-muted-foreground hover:bg-muted'
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t">
            <Button variant="ghost" className="w-full justify-start text-muted-foreground" onClick={handleLogout}>
              <LogOut className="w-5 h-5 mr-3" />
              {t('dashboard.logout')}
            </Button>
          </div>
        </div>
      </aside>

      {/* Overlay mobile */}
      {isMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsMenuOpen(false)} />
      )}

      {/* Main Content */}
      <main className="flex-1 min-h-screen overflow-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsMenuOpen(true)}>
                <Menu className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                  {t('dashboard.title')}
                </h1>
                <p className="text-muted-foreground">{t('dashboard.subtitle')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                <Activity className="w-3 h-3 mr-1" />
                {t('dashboard.online')}
              </Badge>
              <LanguageSwitcher />
              <Button variant="outline" size="sm" onClick={carregarMetricas}>
                <RefreshCw className="w-4 h-4 mr-2" />
                {t('dashboard.refresh')}
              </Button>
              <NotificationCenter />
              <Button variant="ghost" size="icon" onClick={handleLogout} title={t('dashboard.logout')}>
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>

      {/* Cards Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Mensagens Enviadas */}
        <Card className="border-l-4 border-l-blue-500 hover:shadow-lg transition-all">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Send className="w-5 h-5 text-blue-500" />
              </div>
              <Badge variant="secondary" className="text-xs">
                +{metricas.mensagensHoje} {t('dashboard.today')}
              </Badge>
            </div>
            <p className="text-3xl font-bold">{metricas.totalMensagens.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">{t('dashboard.messages_sent')}</p>
          </CardContent>
        </Card>

        {/* Total Leads */}
        <Card className="border-l-4 border-l-purple-500 hover:shadow-lg transition-all">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Users className="w-5 h-5 text-purple-500" />
              </div>
              <Badge variant="secondary" className="text-xs">
                {metricas.leadsQuentes} {t('dashboard.hot')}
              </Badge>
            </div>
            <p className="text-3xl font-bold">{metricas.totalLeads.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">{t('dashboard.total_leads')}</p>
          </CardContent>
        </Card>

        {/* Campanhas */}
        <Card className="border-l-4 border-l-green-500 hover:shadow-lg transition-all">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Target className="w-5 h-5 text-green-500" />
              </div>
              <Badge variant="secondary" className="text-xs">
                {metricas.campanhasAtivas} {t('dashboard.active')}
              </Badge>
            </div>
            <p className="text-3xl font-bold">{metricas.totalCampanhas}</p>
            <p className="text-sm text-muted-foreground">{t('dashboard.campaigns')}</p>
          </CardContent>
        </Card>

        {/* Automação IA */}
        <Card className="border-l-4 border-l-orange-500 hover:shadow-lg transition-all">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Bot className="w-5 h-5 text-orange-500" />
              </div>
              <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20">
                {t('dashboard.ia_active')}
              </Badge>
            </div>
            <p className="text-3xl font-bold">{metricas.taxaAutomacao}%</p>
            <p className="text-sm text-muted-foreground">{t('dashboard.automation')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Cards Secundários - Métricas do Dia */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/5 to-blue-500/10">
          <CardContent className="p-4 flex items-center gap-3">
            <MessageCircle className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{metricas.mensagensHoje}</p>
              <p className="text-xs text-muted-foreground">{t('dashboard.messages_today')}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/5 to-purple-500/10">
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="w-8 h-8 text-purple-500" />
            <div>
              <p className="text-2xl font-bold">{metricas.conversasHoje}</p>
              <p className="text-xs text-muted-foreground">{t('dashboard.conversations_today')}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/5 to-green-500/10">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{metricas.mensagensIA}</p>
              <p className="text-xs text-muted-foreground">{t('dashboard.ia_attendances')}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/5 to-orange-500/10">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="w-8 h-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold">{metricas.totalConversas}</p>
              <p className="text-xs text-muted-foreground">{t('dashboard.total_conversations')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos Principais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Mensagens por Dia */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              {t('dashboard.messages_last_7_days')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={dadosGraficos.mensagensPorDia}>
                <defs>
                  <linearGradient id="colorEnviadas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorRecebidas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="dia" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }} 
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="enviadas"
                  stroke="hsl(var(--primary))"
                  fillOpacity={1}
                  fill="url(#colorEnviadas)"
                  name={t('dashboard.sent')}
                />
                <Area
                  type="monotone"
                  dataKey="recebidas"
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url(#colorRecebidas)"
                  name={t('dashboard.received')}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Funil de Leads */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              {t('dashboard.sales_funnel')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dadosGraficos.leadsNoFunil} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" className="text-xs" />
                <YAxis dataKey="nome" type="category" className="text-xs" width={80} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                  {dadosGraficos.leadsNoFunil.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.cor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos Secundários */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Status das Campanhas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard.campaign_status')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={dadosGraficos.campanhasPorStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="valor"
                >
                  {dadosGraficos.campanhasPorStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.cor} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tipo de Atendimento */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard.ia_vs_human')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={dadosGraficos.atendimentoPorTipo}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="valor"
                >
                  {dadosGraficos.atendimentoPorTipo.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.cor} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Card de Resumo */}
        <Card className="bg-gradient-to-br from-primary/5 to-purple-500/10">
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard.general_summary')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('dashboard.total_messages')}</span>
              <span className="font-bold">{metricas.totalMensagens}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('dashboard.total_conversations')}</span>
              <span className="font-bold">{metricas.totalConversas}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('dashboard.total_leads')}</span>
              <span className="font-bold">{metricas.totalLeads}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('dashboard.automation_rate')}</span>
              <Badge className="bg-primary/10 text-primary">{metricas.taxaAutomacao}%</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ações Rápidas */}
      <Card className="bg-gradient-to-r from-primary/5 to-purple-500/10">
        <CardContent className="p-6">
          <h3 className="font-semibold mb-4 text-center">{t('dashboard.quick_actions')}</h3>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button onClick={() => navigate('/meus-produtos')} className="gap-2">
              <Plus className="w-4 h-4" />
              {t('dashboard.new_product')}
            </Button>
            <Button variant="secondary" onClick={() => navigate('/campanhas')} className="gap-2">
              <Megaphone className="w-4 h-4" />
              {t('dashboard.create_campaign')}
            </Button>
            <Button variant="outline" onClick={() => navigate('/whatsapp')} className="gap-2">
              <Calendar className="w-4 h-4" />
              {t('dashboard.schedule_send')}
            </Button>
            <Button variant="outline" onClick={() => navigate('/google-ads')} className="gap-2">
              <Target className="w-4 h-4" />
              Google Ads
            </Button>
            <Button variant="outline" onClick={() => navigate('/configurar-icp')} className="gap-2">
              <Users className="w-4 h-4" />
              {t('dashboard.configure_icp')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Campanhas em Andamento + Leads Quentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Campanhas em Andamento */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-red-500" />
              {t('dashboard.campaigns_running')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <CampanhasEmAndamentoSection navigate={navigate} />
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={() => navigate('/campanhas')} className="gap-1">
                <Plus className="w-4 h-4" />
                {t('dashboard.new_campaign')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate('/biblioteca')}>
                {t('dashboard.view_history')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Leads Quentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              {t('dashboard.hot_leads')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LeadsQuentes />
          </CardContent>
        </Card>
      </div>

      {/* Google Ads + Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Google Ads */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-red-500" />
              {t('dashboard.google_ads')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">{t('dashboard.active_campaigns')}</p>
                <p className="text-xl font-bold">3</p>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">{t('dashboard.avg_cpc')}</p>
                <p className="text-xl font-bold">R$ 0.42</p>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">CTR</p>
                <p className="text-xl font-bold text-green-500">4.8%</p>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">ROI</p>
                <p className="text-xl font-bold text-purple-500">4.5x</p>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={() => navigate('/google-ads')} className="flex-1 gap-1">
                <Eye className="w-4 h-4" />
                {t('dashboard.view_campaigns')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate('/google-ads')} className="flex-1 gap-1">
                <Plus className="w-4 h-4" />
                {t('dashboard.create_new')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Google Analytics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              {t('dashboard.analytics')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">{t('dashboard.visits_month')}</p>
                <p className="text-xl font-bold">12.5K</p>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">{t('dashboard.conversion_rate')}</p>
                <p className="text-xl font-bold text-green-500">4.2%</p>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MousePointer className="w-3 h-3" />
                  {t('dashboard.checkout_clicks')}
                </p>
                <p className="text-xl font-bold text-orange-500">847</p>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  {t('dashboard.sales')}
                </p>
                <p className="text-xl font-bold text-green-500">R$ 15.8K</p>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={() => navigate('/analytics')} className="flex-1 gap-1">
                <BarChart3 className="w-4 h-4" />
                {t('dashboard.view_report')}
              </Button>
              <Button size="sm" variant="outline" className="flex-1 gap-1">
                <ExternalLink className="w-4 h-4" />
                {t('dashboard.export')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
        </div>
      </main>
    </div>
  );
}
