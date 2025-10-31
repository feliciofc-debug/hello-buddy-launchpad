"use client";

import { useState, useMemo, useEffect } from 'react';
import { Bell, User, Menu, X, Package, UserCircle, DollarSign, TrendingUp, Target, BarChart3, ShoppingBag, LogOut, Moon, Sun, Settings, MessageCircle, Bot, Instagram, BookOpen, Megaphone, CreditCard } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import NotificationCenter from '@/components/NotificationCenter';
import ShopeeSearchComponent from '@/components/ShopeeSearchComponent';
import UserTypeSelector from '@/components/UserTypeSelector';
import { mockProducts, type Marketplace } from '@/data/mockData';

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Calcular métricas reais baseadas nos produtos (SEMPRE executado - antes do early return)
  const metrics = useMemo(() => {
    const totalProducts = mockProducts.length;
    const soldProducts = mockProducts.slice(0, 8);
    const totalRevenue = soldProducts.reduce((acc, p) => acc + p.price, 0);
    const totalCommissions = soldProducts.reduce((acc, p) => acc + p.commission, 0);
    const realProfit = totalCommissions;
    const averageTicket = totalRevenue / soldProducts.length;
    const previousRevenue = totalRevenue / 1.125;
    const revenueGrowth = ((totalRevenue - previousRevenue) / previousRevenue) * 100;
    
    const marketplaceEarnings = soldProducts.reduce((acc, product) => {
      const mp = product.marketplace;
      if (!acc[mp]) {
        acc[mp] = {
          marketplace: mp,
          revenue: 0,
          commission: 0,
          sales: 0,
          products: 0
        };
      }
      acc[mp].revenue += product.price;
      acc[mp].commission += product.commission;
      acc[mp].sales += 1;
      return acc;
    }, {} as Record<Marketplace, {
      marketplace: Marketplace;
      revenue: number;
      commission: number;
      sales: number;
      products: number;
    }>);

    mockProducts.forEach(product => {
      const mp = product.marketplace;
      if (marketplaceEarnings[mp]) {
        marketplaceEarnings[mp].products += 1;
      }
    });

    const marketplaceArray = Object.values(marketplaceEarnings).sort((a, b) => b.commission - a.commission);
    
    return {
      totalRevenue,
      totalCommissions,
      realProfit,
      averageTicket,
      revenueGrowth,
      soldProducts: soldProducts.length,
      totalProducts,
      marketplaceEarnings: marketplaceArray
    };
  }, []);

  // Função para obter ícone e cor por marketplace
  const getMarketplaceInfo = (marketplace: Marketplace) => {
    const info: Record<Marketplace, { icon: string; color: string; name: string }> = {
      amazon: { icon: '📦', color: 'bg-orange-500', name: 'Amazon' },
      shopee: { icon: '🛍️', color: 'bg-orange-600', name: 'Shopee' },
      aliexpress: { icon: '🌐', color: 'bg-red-500', name: 'AliExpress' },
      lomadee: { icon: '🔗', color: 'bg-blue-500', name: 'Lomadee' },
      hotmart: { icon: '🎓', color: 'bg-green-500', name: 'Hotmart' },
      eduzz: { icon: '💼', color: 'bg-purple-500', name: 'Eduzz' },
      monetizze: { icon: '💰', color: 'bg-pink-500', name: 'Monetizze' }
    };
    return info[marketplace];
  };

  // Verificar autenticação e assinatura
  useEffect(() => {
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        navigate('/login');
        return;
      }
      setUser(session?.user ?? null);
      // Recarregar perfil quando o usuário mudar
      if (session?.user) {
        checkAuth();
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Verificar se voltou do pagamento e ativar assinatura
  useEffect(() => {
    const checkPaymentReturn = async () => {
      const paymentSuccess = searchParams.get('payment') === 'success';
      const userId = searchParams.get('user_id');
      const planType = searchParams.get('plan_type');
      
      if (paymentSuccess && userId && planType) {
        console.log('🔄 Ativando assinatura após pagamento...');
        try {
          const { data, error } = await supabase.functions.invoke('activate-subscription', {
            body: {
              user_id: userId,
              payment_id: `mp_redirect_${Date.now()}`,
              plan_name: planType === 'teste' ? 'Teste' : 'Pro',
              plan_type: 'monthly',
              amount: planType === 'teste' ? 12 : 1764
            }
          });
          
          if (error) {
            console.error('Erro ao ativar assinatura:', error);
          } else {
            console.log('✅ Assinatura ativada:', data);
            toast.success('🎉 Pagamento aprovado! Bem-vindo ao AMZ Ofertas!');
          }
        } catch (err) {
          console.error('Erro:', err);
        }
        window.history.replaceState({}, '', '/dashboard');
      } else if (paymentSuccess) {
        toast.success('Bem-vindo ao AMZ Ofertas! 🎉');
        window.history.replaceState({}, '', '/dashboard');
      }
    };
    
    checkPaymentReturn();
  }, [searchParams]);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Você precisa fazer login para acessar o dashboard');
        navigate('/login');
        return;
      }
      
      // Buscar perfil do usuário - forçar busca sem cache
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Erro ao buscar perfil:', profileError);
      } else if (profile) {
        console.log('✅ Perfil carregado:', profile);
        console.log('📋 Tipo do usuário:', profile.tipo);
        setUserProfile(profile);
      } else {
        console.warn('⚠️ Nenhum perfil encontrado para o usuário');
      }
      
      // Exceção para admin - não precisa de assinatura
      if (session.user.email !== 'admin@amzofertas.com') {
        // Verificar se o usuário tem assinatura ativa
        const { data: subscriptionCheck } = await supabase.functions.invoke('check-subscription');
        
        console.log('Verificação de assinatura:', subscriptionCheck);
        
        // Se não tiver assinatura ativa, redireciona para planos
        if (!subscriptionCheck?.hasActiveSubscription) {
          toast.error('Você precisa de uma assinatura ativa para acessar o dashboard');
          navigate('/planos');
          return;
        }
      }
      
      setUser(session.user);
    } catch (error) {
      console.error('Erro ao verificar autenticação:', error);
      toast.error('Erro ao verificar autenticação');
      navigate('/login');
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const toggleDarkMode = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logout realizado com sucesso!');
    navigate('/');
  };

  if (isCheckingAuth || !user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className={`bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 w-64 space-y-6 py-7 px-2 absolute inset-y-0 left-0 transform ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition duration-200 ease-in-out z-20`}>
        <a href="#" className="flex items-center gap-3 px-4">
          <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center shadow-md">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <span className="text-gray-900 dark:text-white text-2xl font-bold">AMZ Ofertas</span>
        </a>
        <nav className="space-y-2">
          <a
            href="/dashboard"
            className={`w-full text-left flex items-center gap-3 py-2.5 px-4 rounded transition duration-200 ${
              window.location.pathname === '/dashboard' 
                ? 'bg-blue-500 text-white' 
                : 'hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <BarChart3 size={20} />
            Dashboard
          </a>
          <a
            href="/planos"
            className={`w-full text-left flex items-center gap-3 py-2.5 px-4 rounded transition duration-200 ${
              window.location.pathname === '/planos' 
                ? 'bg-blue-500 text-white' 
                : 'hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <CreditCard size={20} />
            Planos
          </a>
          {userProfile?.tipo === 'fabrica' && (
            <>
              <a
                href="/catalogos"
                className={`w-full text-left flex items-center gap-3 py-2.5 px-4 rounded transition duration-200 ${
                  window.location.pathname === '/catalogos' 
                    ? 'bg-blue-500 text-white' 
                    : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <BookOpen size={20} />
                Catálogos
              </a>
              <a
                href="/vendedores"
                className={`w-full text-left flex items-center gap-3 py-2.5 px-4 rounded transition duration-200 ${
                  window.location.pathname === '/vendedores' 
                    ? 'bg-blue-500 text-white' 
                    : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <UserCircle size={20} />
                Vendedores
              </a>
            </>
          )}
          {userProfile?.tipo === 'empresa' && (
            <a
              href="/produtos"
              className={`w-full text-left flex items-center gap-3 py-2.5 px-4 rounded transition duration-200 ${
                window.location.pathname === '/produtos' 
                  ? 'bg-blue-500 text-white' 
                  : 'hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <Package size={20} />
              Upload Produtos
            </a>
          )}
          {userProfile?.tipo === 'afiliado' && (
            <a
              href="/produtos"
              className={`w-full text-left flex items-center gap-3 py-2.5 px-4 rounded transition duration-200 ${
                window.location.pathname === '/produtos' 
                  ? 'bg-blue-500 text-white' 
                  : 'hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <Package size={20} />
              Produtos Afiliados
            </a>
          )}
          <a
            href="/ia-marketing"
            className={`w-full text-left flex items-center gap-3 py-2.5 px-4 rounded transition duration-200 ${
              window.location.pathname === '/ia-marketing' 
                ? 'bg-blue-500 text-white' 
                : 'hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Bot size={20} />
            IA Marketing
          </a>
          <a
            href="/configuracoes/redes-sociais"
            className={`w-full text-left flex items-center gap-3 py-2.5 px-4 rounded transition duration-200 ${
              window.location.pathname === '/configuracoes/redes-sociais' 
                ? 'bg-blue-500 text-white' 
                : 'hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Instagram size={20} />
            Redes Sociais
          </a>
          <a
            href="/biblioteca"
            className={`w-full text-left flex items-center gap-3 py-2.5 px-4 rounded transition duration-200 ${
              window.location.pathname === '/biblioteca' 
                ? 'bg-blue-500 text-white' 
                : 'hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <BookOpen size={20} />
            Biblioteca
          </a>
          {(userProfile?.tipo === 'empresa' || userProfile?.tipo === 'fabrica') && (
            <a
              href="/campanhas"
              className={`w-full text-left flex items-center gap-3 py-2.5 px-4 rounded transition duration-200 ${
                window.location.pathname === '/campanhas' 
                  ? 'bg-blue-500 text-white' 
                  : 'hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <Megaphone size={20} />
              Campanhas Google Ads
            </a>
          )}
          {(userProfile?.tipo === 'empresa' || userProfile?.tipo === 'fabrica') && (
            <a
              href="/analytics"
              className={`w-full text-left flex items-center gap-3 py-2.5 px-4 rounded transition duration-200 ${
                window.location.pathname === '/analytics' 
                  ? 'bg-blue-500 text-white' 
                  : 'hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <BarChart3 size={20} />
              Analytics
            </a>
          )}
          <a
            href="/marketplace"
            className={`w-full text-left flex items-center gap-3 py-2.5 px-4 rounded transition duration-200 ${
              window.location.pathname === '/marketplace' 
                ? 'bg-blue-500 text-white' 
                : 'hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Marketplace
          </a>
          <a
            href="/whatsapp"
            className={`w-full text-left flex items-center gap-3 py-2.5 px-4 rounded transition duration-200 ${
              window.location.pathname === '/whatsapp' 
                ? 'bg-blue-500 text-white' 
                : 'hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            WhatsApp
          </a>
          <a
            href="/perfil"
            className={`w-full text-left flex items-center gap-3 py-2.5 px-4 rounded transition duration-200 ${
              window.location.pathname === '/perfil' 
                ? 'bg-blue-500 text-white' 
                : 'hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <UserCircle size={20} />
            Meu Perfil
          </a>
          <a
            href="/configuracoes"
            className={`w-full text-left flex items-center gap-3 py-2.5 px-4 rounded transition duration-200 ${
              window.location.pathname === '/configuracoes' 
                ? 'bg-blue-500 text-white' 
                : 'hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Settings size={20} />
            Configurações API
          </a>
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
          <div className="flex items-center">
            <button 
              className="text-gray-500 md:hidden" 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <h2 className="ml-4 text-xl font-semibold text-gray-900 dark:text-white">
              Dashboard
            </h2>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleDarkMode}
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <NotificationCenter />
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 dark:text-gray-400">{user?.email}</span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                title="Sair"
              >
                <LogOut size={18} />
                Sair
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 bg-gray-50 dark:bg-gray-900 overflow-auto">
          <div className="p-6">
              {/* Seletor de Tipo de Usuário (apenas para admin) */}
              <UserTypeSelector />
              

              {/* Welcome Message */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Bem-vindo de volta! 👋
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  {userProfile?.tipo === 'afiliado' 
                    ? 'Aqui está um resumo do seu desempenho como afiliado'
                    : 'Aqui está um resumo do desempenho da sua empresa'}
                </p>
                {/* Debug - Mostrar tipo atual */}
                {userProfile && (
                  <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Tipo atual: <span className="font-bold text-blue-600 dark:text-blue-400">{userProfile.tipo?.toUpperCase() || 'NÃO DEFINIDO'}</span>
                  </div>
                )}
              </div>

              {/* Main Metrics - 4 Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {userProfile?.tipo === 'empresa' ? (
                  <>
                    {/* EMPRESA - Postagens */}
                    <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
                      <div className="flex items-center justify-between mb-4">
                        <MessageCircle className="w-10 h-10 opacity-80" />
                        <span className="text-sm font-semibold px-2 py-1 rounded bg-green-500/20">
                          +23%
                        </span>
                      </div>
                      <p className="text-sm opacity-80 mb-1">📱 Postagens</p>
                      <p className="text-3xl font-bold">127</p>
                      <p className="text-xs opacity-70 mt-2">este mês</p>
                    </div>

                    {/* EMPRESA - Alcance */}
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
                      <div className="flex items-center justify-between mb-4">
                        <User className="w-10 h-10 opacity-80" />
                        <span className="text-sm font-semibold px-2 py-1 rounded bg-green-500/20">
                          +18%
                        </span>
                      </div>
                      <p className="text-sm opacity-80 mb-1">👥 Alcance</p>
                      <p className="text-3xl font-bold">45.2K</p>
                      <p className="text-xs opacity-70 mt-2">pessoas alcançadas</p>
                    </div>

                    {/* EMPRESA - Vendas */}
                    <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
                      <div className="flex items-center justify-between mb-4">
                        <DollarSign className="w-10 h-10 opacity-80" />
                        <span className="text-sm font-semibold px-2 py-1 rounded bg-green-500/20">
                          +31%
                        </span>
                      </div>
                      <p className="text-sm opacity-80 mb-1">💰 Vendas</p>
                      <p className="text-3xl font-bold">R$ 12.450</p>
                      <p className="text-xs opacity-70 mt-2">faturamento total</p>
                    </div>

                    {/* EMPRESA - Engajamento */}
                    <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white">
                      <div className="flex items-center justify-between mb-4">
                        <TrendingUp className="w-10 h-10 opacity-80" />
                        <span className="text-sm font-semibold px-2 py-1 rounded bg-green-500/20">
                          +12%
                        </span>
                      </div>
                      <p className="text-sm opacity-80 mb-1">📈 Engajamento</p>
                      <p className="text-3xl font-bold">8.5%</p>
                      <p className="text-xs opacity-70 mt-2">taxa média</p>
                    </div>
                  </>
                ) : (
                  <>
                    {/* AFILIADO/FÁBRICA - Faturamento Total */}
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
                      <div className="flex items-center justify-between mb-4">
                        <DollarSign className="w-10 h-10 opacity-80" />
                        <span className={`text-sm font-semibold px-2 py-1 rounded ${
                          metrics.revenueGrowth > 0 ? 'bg-green-500/20' : 'bg-red-500/20'
                        }`}>
                          {metrics.revenueGrowth > 0 ? '+' : ''}{metrics.revenueGrowth.toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-sm opacity-80 mb-1">Faturamento Total</p>
                      <p className="text-3xl font-bold">R$ {metrics.totalRevenue.toFixed(2)}</p>
                      <p className="text-xs opacity-70 mt-2">{metrics.soldProducts} vendas realizadas</p>
                    </div>

                    {/* Comissões Ganhas (Afiliado) ou Vendas (Empresa) */}
                    <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
                      <div className="flex items-center justify-between mb-4">
                        <TrendingUp className="w-10 h-10 opacity-80" />
                        <span className="text-sm font-semibold px-2 py-1 rounded bg-white/20">
                          {((metrics.totalCommissions / metrics.totalRevenue) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-sm opacity-80 mb-1">
                        {userProfile?.tipo === 'afiliado' ? 'Comissões Ganhas' : 'Vendas Totais'}
                      </p>
                      <p className="text-3xl font-bold">R$ {metrics.totalCommissions.toFixed(2)}</p>
                      <p className="text-xs opacity-70 mt-2">
                        {userProfile?.tipo === 'afiliado' ? 'Total de todos os marketplaces' : 'Total de vendas realizadas'}
                      </p>
                    </div>

                    {/* Lucro Real */}
                    <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
                      <div className="flex items-center justify-between mb-4">
                        <Target className="w-10 h-10 opacity-80" />
                        <span className="text-sm font-semibold px-2 py-1 rounded bg-white/20">
                          100%
                        </span>
                      </div>
                      <p className="text-sm opacity-80 mb-1">Lucro Real</p>
                      <p className="text-3xl font-bold">R$ {metrics.realProfit.toFixed(2)}</p>
                      <p className="text-xs opacity-70 mt-2">Seu ganho líquido</p>
                    </div>

                    {/* Ticket Médio */}
                    <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white">
                      <div className="flex items-center justify-between mb-4">
                        <BarChart3 className="w-10 h-10 opacity-80" />
                        <span className="text-sm font-semibold px-2 py-1 rounded bg-white/20">
                          Médio
                        </span>
                      </div>
                      <p className="text-sm opacity-80 mb-1">Ticket Médio</p>
                      <p className="text-3xl font-bold">R$ {metrics.averageTicket.toFixed(2)}</p>
                      <p className="text-xs opacity-70 mt-2">Valor médio por venda</p>
                    </div>
                  </>
                )}
              </div>






              {/* Google Ads + Analytics - Apenas para Empresa */}
              {userProfile?.tipo === 'empresa' && (
                <div className="mb-8">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Target className="w-6 h-6 text-blue-500" />
                    Marketing Digital
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Google Ads Card */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          🎯 Campanhas Google Ads
                        </h4>
                      </div>
                      
                      <div className="space-y-4 mb-6">
                        <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Campanhas ativas</span>
                          <span className="text-xl font-bold text-blue-600 dark:text-blue-400">3</span>
                        </div>
                        
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <span className="text-sm text-gray-600 dark:text-gray-400">CPC médio</span>
                          <span className="text-lg font-semibold text-gray-900 dark:text-white">R$ 0,85</span>
                        </div>
                        
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <span className="text-sm text-gray-600 dark:text-gray-400">CTR</span>
                          <span className="text-lg font-semibold text-green-600 dark:text-green-400">4.2%</span>
                        </div>
                        
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Budget mensal</span>
                          <div className="text-right">
                            <span className="text-lg font-semibold text-gray-900 dark:text-white">R$ 1.500</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">(68% usado)</span>
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <span className="text-sm text-gray-600 dark:text-gray-400">ROI</span>
                          <span className="text-xl font-bold text-green-600 dark:text-green-400">3.8x</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-3">
                        <button
                          onClick={() => navigate('/campanhas')}
                          className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
                        >
                          Ver Campanhas
                        </button>
                        <button
                          onClick={() => navigate('/campanhas')}
                          className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors"
                        >
                          Criar Nova
                        </button>
                      </div>
                    </div>

                    {/* Google Analytics Card */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          📊 Google Analytics
                        </h4>
                      </div>
                      
                      <div className="space-y-4 mb-6">
                        <div className="flex justify-between items-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Visitas (mês)</span>
                          <span className="text-xl font-bold text-purple-600 dark:text-purple-400">12.458</span>
                        </div>
                        
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Taxa de conversão</span>
                          <span className="text-lg font-semibold text-green-600 dark:text-green-400">2.8%</span>
                        </div>
                        
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Tempo médio</span>
                          <span className="text-lg font-semibold text-gray-900 dark:text-white">3m 42s</span>
                        </div>
                        
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Taxa de rejeição</span>
                          <span className="text-lg font-semibold text-orange-600 dark:text-orange-400">38.5%</span>
                        </div>
                        
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Páginas/visita</span>
                          <span className="text-lg font-semibold text-gray-900 dark:text-white">4.2</span>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => navigate('/analytics')}
                        className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 transition-colors"
                      >
                        Ver Relatório Completo
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;