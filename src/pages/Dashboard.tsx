"use client";

import { useState, useMemo, useEffect } from 'react';
import { Bell, User, Menu, X, Package, UserCircle, DollarSign, TrendingUp, Target, BarChart3, ShoppingBag, LogOut } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ProductsPage from '@/components/ProductsPage';
import AffiliateProfile from '@/components/AffiliateProfile';
import NotificationCenter from '@/components/NotificationCenter';
import { mockProducts, type Marketplace } from '@/data/mockData';

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'products' | 'profile'>('dashboard');

  // Verificar autenticação e assinatura
  useEffect(() => {
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        navigate('/login');
        return;
      }
      setUser(session?.user ?? null);
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

  // Calcular métricas reais baseadas nos produtos
  const metrics = useMemo(() => {
    const totalProducts = mockProducts.length;
    
    // Simular vendas (assumindo que vendeu alguns produtos)
    const soldProducts = mockProducts.slice(0, 8); // Primeiros 8 produtos vendidos
    
    const totalRevenue = soldProducts.reduce((acc, p) => acc + p.price, 0);
    const totalCommissions = soldProducts.reduce((acc, p) => acc + p.commission, 0);
    const realProfit = totalCommissions;
    const averageTicket = totalRevenue / soldProducts.length;
    
    // Calcular crescimento (simulado - 12.5% de crescimento)
    const previousRevenue = totalRevenue / 1.125;
    const revenueGrowth = ((totalRevenue - previousRevenue) / previousRevenue) * 100;
    
    // Calcular ganhos por marketplace
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

    // Contar produtos por marketplace
    mockProducts.forEach(product => {
      const mp = product.marketplace;
      if (marketplaceEarnings[mp]) {
        marketplaceEarnings[mp].products += 1;
      }
    });

    // Converter para array e ordenar por comissão
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

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className={`bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 w-64 space-y-6 py-7 px-2 absolute inset-y-0 left-0 transform ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition duration-200 ease-in-out z-20`}>
        <a href="#" className="text-gray-900 dark:text-white text-2xl font-bold px-4">
          Amazon Seller Pro
        </a>
        <nav className="space-y-2">
          <button
            onClick={() => setCurrentPage('dashboard')}
            className={`w-full text-left flex items-center gap-3 py-2.5 px-4 rounded transition duration-200 ${
              currentPage === 'dashboard' 
                ? 'bg-blue-500 text-white' 
                : 'hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <BarChart3 size={20} />
            Dashboard
          </button>
          <button
            onClick={() => setCurrentPage('products')}
            className={`w-full text-left flex items-center gap-3 py-2.5 px-4 rounded transition duration-200 ${
              currentPage === 'products' 
                ? 'bg-blue-500 text-white' 
                : 'hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Package size={20} />
            Produtos
          </button>
          <button
            onClick={() => setCurrentPage('profile')}
            className={`w-full text-left flex items-center gap-3 py-2.5 px-4 rounded transition duration-200 ${
              currentPage === 'profile' 
                ? 'bg-blue-500 text-white' 
                : 'hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <UserCircle size={20} />
            Meu Perfil
          </button>
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
              {currentPage === 'dashboard' && 'Dashboard'}
              {currentPage === 'products' && 'Produtos'}
              {currentPage === 'profile' && 'Meu Perfil'}
            </h2>
          </div>
          <div className="flex items-center space-x-4">
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
          {currentPage === 'dashboard' && (
            <div className="p-6">
              {/* Welcome Message */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Bem-vindo de volta! 👋
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Aqui está um resumo do seu desempenho como afiliado
                </p>
              </div>

              {/* Main Metrics - 4 Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* Faturamento Total */}
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

                {/* Comissões Ganhas */}
                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
                  <div className="flex items-center justify-between mb-4">
                    <TrendingUp className="w-10 h-10 opacity-80" />
                    <span className="text-sm font-semibold px-2 py-1 rounded bg-white/20">
                      {((metrics.totalCommissions / metrics.totalRevenue) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-sm opacity-80 mb-1">Comissões Ganhas</p>
                  <p className="text-3xl font-bold">R$ {metrics.totalCommissions.toFixed(2)}</p>
                  <p className="text-xs opacity-70 mt-2">Total de todos os marketplaces</p>
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
              </div>

              {/* Ganhos por Marketplace */}
              <div className="mb-8">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <ShoppingBag className="w-6 h-6 text-blue-500" />
                  Ganhos por Marketplace
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {metrics.marketplaceEarnings.map((mp) => {
                    const info = getMarketplaceInfo(mp.marketplace);
                    return (
                      <div key={mp.marketplace} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5 hover:shadow-lg transition-shadow">
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`w-12 h-12 ${info.color} rounded-lg flex items-center justify-center text-2xl`}>
                            {info.icon}
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-900 dark:text-white">{info.name}</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{mp.sales} vendas</p>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Comissão:</span>
                            <span className="text-lg font-bold text-green-500">
                              R$ {mp.commission.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Faturamento:</span>
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                              R$ {mp.revenue.toFixed(2)}
                            </span>
                          </div>
                          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-gray-500 dark:text-gray-400">Produtos ativos:</span>
                              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                {mp.products}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Barra de progresso */}
                        <div className="mt-3">
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div 
                              className={`${info.color} h-2 rounded-full`}
                              style={{ width: `${(mp.commission / metrics.totalCommissions) * 100}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                            {((mp.commission / metrics.totalCommissions) * 100).toFixed(1)}% do total
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Secondary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                      <Package className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Produtos Ativos</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{metrics.totalProducts}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Taxa de Conversão</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {((metrics.soldProducts / metrics.totalProducts) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Comissão Média</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        R$ {(metrics.totalCommissions / metrics.soldProducts).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  Produtos Mais Vendidos
                </h3>
                <div className="space-y-4">
                  {mockProducts.slice(0, 5).map((product, index) => (
                    <div key={product.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex items-center gap-4">
                        <span className="text-2xl font-bold text-gray-400">#{index + 1}</span>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white line-clamp-1">{product.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500 dark:text-gray-400">{product.category}</span>
                            <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                              {getMarketplaceInfo(product.marketplace).name}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-500">R$ {product.commission.toFixed(2)}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">comissão</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {currentPage === 'products' && <ProductsPage />}
          {currentPage === 'profile' && <AffiliateProfile />}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;