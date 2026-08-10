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
  Images,
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
  Plug,
  Briefcase,
  Gift,
} from 'lucide-react';
import NotificationCenter from '@/components/NotificationCenter';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useBillingAccess } from '@/hooks/useBillingAccess';
import BillingBlockedScreen from '@/components/BillingBlockedScreen';

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
  const {
    loading: billingLoading,
    active: billingActive,
    expiresAt: billingExpiresAt,
    customerName: billingCustomerName,
    subscriptionStatus: billingSubStatus,
    refetch: billingRefetch,
  } = useBillingAccess();
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
    { id: 'midias', icon: Images, label: 'Mídias', path: '/midias' },
    { id: 'ia-marketing', icon: Zap, label: t('nav.ia_marketing'), path: '/ia-marketing' },
    { id: 'redes-sociais', icon: Share2, label: t('nav.social_networks'), path: '/redes-sociais' },
    { id: 'whatsapp', icon: MessageCircle, label: t('nav.whatsapp'), path: '/whatsapp-painel' },
    { id: 'whatsapp-templates', icon: MessageCircle, label: 'Templates WhatsApp', path: '/pj/whatsapp-templates' },
    { id: 'ebook-presente', icon: Gift, label: 'Ebook de Presente', path: '/pj/ebook-presente' },
    { id: 'minha-marca', icon: Images, label: 'Minha Marca', path: '/pj/minha-marca' },
    { id: 'contatos-comerciais', icon: Briefcase, label: 'Contatos Comerciais', path: '/pj/contatos-comerciais' },
    { id: 'clientes-segmentos', icon: Users, label: 'Clientes e Segmentos', path: '/pj/listas-contatos' },
    // { id: 'integracoes', icon: Plug, label: t('nav.integrations', 'Integrações'), path: '/integracoes' }, // Oculto - reativar removendo o comentário
    { id: 'minha-empresa', icon: Building2, label: 'Minha Empresa', path: '/configuracao-empresa' },
    { id: 'configuracoes', icon: Settings, label: t('nav.settings'), path: '/configuracoes' },
    ...(userEmail === 'expo@atombrasildigital.com'
      ? [{ id: 'admin', icon: Shield, label: 'Admin', path: '/admin' }]
      : []),
  ];

  const menuItems = menuItemsAll.filter((item) => item.id === 'admin' || item.id === 'contatos-comerciais' || item.id === 'clientes-segmentos' || item.id === 'whatsapp-templates' || item.id === 'ebook-presente' || item.id === 'minha-empresa' || isMenuAllowed(item.id));

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

  if (billingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!billingActive) {
    return (
      <BillingBlockedScreen
        expiresAt={billingExpiresAt}
        customerName={billingCustomerName}
        subscriptionStatus={billingSubStatus}
        refetch={billingRefetch}
      />
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
        <div className="p-4 md:p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsMenuOpen(true)}>
                <Menu className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                  {saudacao}
                  {nomeExibicao ? `, ${nomeExibicao}` : ''} 👋
                </h1>
                <p className="text-sm text-muted-foreground">
                  Veja o que sua IA fez pelo seu negócio.
                  {metricasDash.atualizadoEm && (
                    <>
                      {' '}Atualizado às{' '}
                      {metricasDash.atualizadoEm.toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      .
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border bg-card p-1">
                {(
                  [
                    { id: 'hoje', label: 'Hoje' },
                    { id: '7d', label: '7 dias' },
                    { id: '30d', label: '30 dias' },
                  ] as { id: DashboardPeriod; label: string }[]
                ).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPeriodo(p.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      periodo === p.id
                        ? 'bg-brand text-brand-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <Button variant="outline" size="icon" onClick={recarregarDash} title="Atualizar">
                <RefreshCw className={`w-4 h-4 ${loadingDash ? 'animate-spin' : ''}`} />
              </Button>
              <ThemeToggle />
              <LanguageSwitcher />
              <NotificationCenter />
              <Button variant="ghost" size="icon" onClick={handleLogout} title={t('dashboard.logout')}>
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {loadingDash && !metricasDash.atualizadoEm ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <DashboardOverview metrics={metricasDash} period={periodo} />
          )}
        </div>
      </main>
    </div>
  );
}

