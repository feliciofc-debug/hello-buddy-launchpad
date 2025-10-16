import React, { useState, useEffect } from 'react';
import { Package, RefreshCw, Bell, X, ShoppingCart, Plus, Copy, Check, Sparkles, MessageSquare, Calculator, TrendingUp, DollarSign, Target, Zap, Send, LogOut } from 'lucide-react';
import { API_URL } from '../config';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

function Index() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isScanning, setIsScanning] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [oportunidades, setOportunidades] = useState([]);
  const [produtosAtivos, setProdutosAtivos] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [showGerarPosts, setShowGerarPosts] = useState(false);
  const [showCalculadora, setShowCalculadora] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [postsGerados, setPostsGerados] = useState([]);
  const [isGeneratingPosts, setIsGeneratingPosts] = useState(false);
  const [copiedStates, setCopiedStates] = useState({});
  const [buscaTexto, setBuscaTexto] = useState('');
  const [calculoROI, setCalculoROI] = useState({ investimento: '', vendasEsperadas: '', resultado: null });
  const [notifications, setNotifications] = useState([{ id: 1, type: 'success', message: 'Sistema online!', time: 'Agora', unread: true }]);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [whatsappData, setWhatsappData] = useState({ phone: '', message: '' });

  const stats = {
    produtosListados: produtosAtivos.length,
    oportunidadesEncontradas: oportunidades.length,
    comissaoEstimada: produtosAtivos.reduce((sum, p) => sum + p.comissao, 0),
    totalVendas: vendas.length,
    faturamentoTotal: vendas.reduce((sum, v) => sum + v.valor, 0),
    comissoesGanhas: vendas.reduce((sum, v) => sum + v.comissao, 0),
    ticketMedio: vendas.length > 0 ? vendas.reduce((sum, v) => sum + v.valor, 0) / vendas.length : 0
  };

  const unreadCount = notifications.filter(n => n.unread).length;

  const handleCalcularROI = async () => {
    if (!produtoSelecionado || !calculoROI.investimento || !calculoROI.vendasEsperadas) return;
    try {
      const response = await fetch(`${API_URL}/calcular-roi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comissao: produtoSelecionado.comissao,
          investimento: parseFloat(calculoROI.investimento),
          vendasEsperadas: parseInt(calculoROI.vendasEsperadas)
        })
      });
      const data = await response.json();
      if (data.calculo) setCalculoROI({ ...calculoROI, resultado: data.calculo });
    } catch (error) {
      console.error('Erro:', error);
    }
  };

  const handleCopyLink = (produto) => {
    navigator.clipboard.writeText(produto.url);
    setCopiedStates({...copiedStates, [`link-${produto.asin}`]: true});
    setTimeout(() => setCopiedStates({...copiedStates, [`link-${produto.asin}`]: false}), 2000);
  };

  const handleCopyMessage = (produto) => {
    const msg = `🔥 ${produto.nome}\n💰 R$ ${produto.preco.toFixed(2)}\n⭐ ${produto.rating} estrelas\n📦 Frete GRÁTIS\n👉 ${produto.url}`;
    navigator.clipboard.writeText(msg);
    setCopiedStates({...copiedStates, [`msg-${produto.asin}`]: true});
    setTimeout(() => setCopiedStates({...copiedStates, [`msg-${produto.asin}`]: false}), 2000);
  };

  const handleGerarPosts = async (produto) => {
    setProdutoSelecionado(produto);
    setShowGerarPosts(true);
    setIsGeneratingPosts(true);
    setPostsGerados([]);
    try {
      const response = await fetch(`${API_URL}/gerar-posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ produto })
      });
      const data = await response.json();
      if (data.posts) setPostsGerados(data.posts);
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setIsGeneratingPosts(false);
    }
  };

  const handleCopyPost = (postId, conteudo) => {
    navigator.clipboard.writeText(conteudo);
    setCopiedStates({...copiedStates, [`post-${postId}`]: true});
    setTimeout(() => setCopiedStates({...copiedStates, [`post-${postId}`]: false}), 2000);
  };

  const handleScanOportunidades = async () => {
    setIsScanning(true);
    try {
      const url = buscaTexto ? `${API_URL}/buscar-oportunidades?limite=1000&busca=${encodeURIComponent(buscaTexto)}` : `${API_URL}/buscar-oportunidades?limite=1000`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.produtos) {
        setOportunidades(data.produtos);
        setNotifications([{ id: Date.now(), type: 'success', message: `${data.total} produtos!`, time: 'Agora', unread: true }, ...notifications]);
        setActiveTab('oportunidades');
      }
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setIsScanning(false);
    }
  };

  const handleListarProduto = (produto) => {
    setProdutosAtivos([...produtosAtivos, { ...produto, id: Date.now() }]);
    setActiveTab('produtos');
  };

  const handleSimularVenda = (produto) => {
    setVendas([{ id: Date.now(), produtoNome: produto.nome, valor: produto.preco, comissao: produto.comissao, data: new Date().toISOString() }, ...vendas]);
  };

  const handleOpenWhatsApp = (produto) => {
    const defaultMessage = `🔥 ${produto.nome}\n💰 R$ ${produto.preco.toFixed(2)}\n⭐ ${produto.rating} estrelas\n📦 Frete GRÁTIS\n👉 ${produto.url}`;
    setProdutoSelecionado(produto);
    setWhatsappData({ phone: '', message: defaultMessage });
    setShowWhatsApp(true);
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/login');
        return;
      }
      
      setUser(session.user);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        return; // Não faz nada, deixa o handleLogout controlar
      }
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logout realizado com sucesso!');
    navigate('/');
  };

  const handleSendWhatsApp = async () => {
    if (!whatsappData.phone || !whatsappData.message) return;
    
    try {
      const response = await fetch(`${API_URL}/send-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: whatsappData.phone,
          message: whatsappData.message,
          userId: user?.id || 'anonymous'
        })
      });
      
      const data = await response.json();
      
      if (data.success && data.whatsappUrl) {
        window.open(data.whatsappUrl, '_blank');
        setShowWhatsApp(false);
        setNotifications([{ id: Date.now(), type: 'success', message: 'WhatsApp aberto!', time: 'Agora', unread: true }, ...notifications]);
      }
    } catch (error) {
      console.error('Erro ao enviar WhatsApp:', error);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {showWhatsApp && produtoSelecionado && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-orange-500/30 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Send className="w-8 h-8 text-green-400" />
                <h2 className="text-2xl font-bold text-white">Enviar WhatsApp</h2>
              </div>
              <button onClick={() => setShowWhatsApp(false)} className="text-orange-300 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="bg-slate-700/50 p-4 rounded-lg">
                <p className="text-orange-300 text-sm mb-2">{produtoSelecionado.nome}</p>
                <p className="text-white font-bold">R$ {produtoSelecionado.preco.toFixed(2)}</p>
              </div>
              <div>
                <label className="text-orange-300 text-sm block mb-2">Telefone (com DDD)</label>
                <input 
                  type="tel" 
                  value={whatsappData.phone} 
                  onChange={(e) => setWhatsappData({...whatsappData, phone: e.target.value})} 
                  className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg border border-orange-500/30 focus:outline-none" 
                  placeholder="11999999999" 
                />
              </div>
              <div>
                <label className="text-orange-300 text-sm block mb-2">Mensagem</label>
                <textarea 
                  value={whatsappData.message} 
                  onChange={(e) => setWhatsappData({...whatsappData, message: e.target.value})} 
                  className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg border border-orange-500/30 focus:outline-none h-32" 
                  placeholder="Digite sua mensagem..."
                />
              </div>
              <button 
                onClick={handleSendWhatsApp} 
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
              >
                <Send className="w-5 h-5" />
                Enviar WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {showCalculadora && produtoSelecionado && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-orange-500/30 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Calculator className="w-8 h-8 text-orange-400" />
                <h2 className="text-2xl font-bold text-white">Calculadora ROI</h2>
              </div>
              <button onClick={() => setShowCalculadora(false)} className="text-orange-300 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="bg-slate-700/50 p-4 rounded-lg">
                <p className="text-orange-300 text-sm mb-2">{produtoSelecionado.nome}</p>
                <p className="text-white font-bold">Comissão: R$ {produtoSelecionado.comissao.toFixed(2)}</p>
              </div>
              <div>
                <label className="text-orange-300 text-sm block mb-2">Investimento (R$)</label>
                <input type="number" value={calculoROI.investimento} onChange={(e) => setCalculoROI({...calculoROI, investimento: e.target.value})} className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg border border-orange-500/30 focus:outline-none" placeholder="100" />
              </div>
              <div>
                <label className="text-orange-300 text-sm block mb-2">Vendas Esperadas</label>
                <input type="number" value={calculoROI.vendasEsperadas} onChange={(e) => setCalculoROI({...calculoROI, vendasEsperadas: e.target.value})} className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg border border-orange-500/30 focus:outline-none" placeholder="20" />
              </div>
              <button onClick={handleCalcularROI} className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-3 rounded-lg font-semibold">Calcular</button>
              {calculoROI.resultado && (
                <div className="bg-slate-700/50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between"><span className="text-orange-300">Lucro Total:</span><span className="text-white font-bold">R$ {calculoROI.resultado.lucroTotal}</span></div>
                  <div className="flex justify-between"><span className="text-orange-300">Lucro Líquido:</span><span className="text-white font-bold">R$ {calculoROI.resultado.lucroLiquido}</span></div>
                  <div className="flex justify-between"><span className="text-orange-300">ROI:</span><span className={`font-bold ${parseFloat(calculoROI.resultado.roi) > 0 ? 'text-green-400' : 'text-red-400'}`}>{calculoROI.resultado.roi}</span></div>
                  <div className="flex justify-between"><span className="text-orange-300">Break-even:</span><span className="text-white font-bold">{calculoROI.resultado.breakEven} vendas</span></div>
                  {calculoROI.resultado.rentavel ? (
                    <div className="bg-green-500/20 text-green-300 p-3 rounded-lg text-center font-semibold mt-3">✅ Rentável!</div>
                  ) : (
                    <div className="bg-red-500/20 text-red-300 p-3 rounded-lg text-center font-semibold mt-3">⚠️ Precisa mais vendas</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showGerarPosts && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-orange-500/30 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Sparkles className="w-8 h-8 text-orange-400" />
                <div>
                  <h2 className="text-2xl font-bold text-white">Posts IA</h2>
                  <p className="text-orange-300 text-sm">{produtoSelecionado?.nome}</p>
                </div>
              </div>
              <button onClick={() => setShowGerarPosts(false)} className="text-orange-300 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            {isGeneratingPosts ? (
              <div className="text-center py-12">
                <Sparkles className="w-16 h-16 text-orange-400 mx-auto mb-4 animate-pulse" />
                <p className="text-white text-lg">Gerando posts...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {postsGerados.map((post) => (
                  <div key={post.id} className="bg-slate-700/50 border border-orange-500/20 rounded-lg p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="bg-orange-500 text-white text-xs px-3 py-1 rounded-full font-semibold">{post.tipo}</span>
                      <button onClick={() => handleCopyPost(post.id, post.conteudo)} className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 text-sm font-semibold">
                        {copiedStates[`post-${post.id}`] ? <><Check className="w-4 h-4" /> Copiado!</> : <><Copy className="w-4 h-4" /> Copiar</>}
                      </button>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4 whitespace-pre-wrap text-white text-sm">{post.conteudo}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-slate-800/50 backdrop-blur-sm border-b border-purple-500/30">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-2 rounded-lg"><Package className="w-6 h-6 text-white" /></div>
              <div>
                <h1 className="text-2xl font-bold text-white">AMZ Ofertas</h1>
                <p className="text-orange-300 text-sm">💰 Sistema Online</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 mr-4">
                <div className="text-right">
                  <p className="text-white text-sm font-semibold">{user?.email}</p>
                  <p className="text-orange-300 text-xs">Conta ativa</p>
                </div>
                <button onClick={handleLogout} className="p-2 bg-red-500/20 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition">
                  <LogOut className="w-5 h-5 text-red-400" />
                </button>
              </div>
              <div className="relative">
                <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2 bg-slate-700 rounded-lg hover:bg-slate-600">
                  <Bell className="w-5 h-5 text-orange-300" />
                  {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">{unreadCount}</span>}
                </button>
              </div>
              <div className="flex gap-2">
                <input type="text" value={buscaTexto} onChange={(e) => setBuscaTexto(e.target.value)} placeholder="Buscar produto..." className="bg-slate-700 text-white px-4 py-2 rounded-lg border border-orange-500/30 focus:outline-none w-64" />
                <button onClick={handleScanOportunidades} className={`flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-lg font-semibold ${isScanning ? 'opacity-75' : ''}`} disabled={isScanning}>
                  <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
                  {isScanning ? 'Buscando...' : 'Buscar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/30 backdrop-blur-sm border-b border-orange-500/20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1 overflow-x-auto">
            {[
              { id: 'dashboard', label: '📊 Dashboard' },
              { id: 'oportunidades', label: '🔍 Produtos' },
              { id: 'produtos', label: '📦 Listados' },
              { id: 'vendas', label: '💰 Vendas' }
            ].map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-6 py-3 font-semibold whitespace-nowrap ${activeTab === tab.id ? 'text-white border-b-2 border-orange-500 bg-slate-700/50' : 'text-orange-300 hover:text-white'}`}>{tab.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
                <p className="text-blue-100 text-sm mb-2">Produtos</p>
                <p className="text-3xl font-bold">{stats.produtosListados}</p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
                <p className="text-green-100 text-sm mb-2">Encontrados</p>
                <p className="text-3xl font-bold">{stats.oportunidadesEncontradas}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
                <p className="text-purple-100 text-sm mb-2">Comissão</p>
                <p className="text-2xl font-bold">R$ {stats.comissaoEstimada.toFixed(2)}</p>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
                <p className="text-orange-100 text-sm mb-2">Vendas</p>
                <p className="text-3xl font-bold">{stats.totalVendas}</p>
              </div>
            </div>
            {stats.totalVendas === 0 && (
              <div className="bg-gradient-to-r from-orange-500/20 to-yellow-500/20 border-2 border-orange-500 rounded-xl p-6">
                <div className="flex items-center gap-4">
                  <Zap className="w-12 h-12 text-orange-400" />
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">🎯 Sistema Pronto!</h3>
                    <p className="text-orange-300">Busque produtos e comece a vender!</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'oportunidades' && (
          <div className="space-y-6">
            <div className="bg-slate-800/50 border border-orange-500/30 rounded-xl p-6">
              {oportunidades.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-orange-400 mx-auto mb-4 opacity-50" />
                  <p className="text-orange-300 text-lg mb-2">Busque produtos!</p>
                  <p className="text-orange-400 text-sm">Use o campo acima</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {oportunidades.map((produto) => (
                    <div key={produto.asin} className="bg-slate-700/50 border border-orange-500/20 rounded-lg p-5">
                      <div className="flex items-start gap-4">
                        <img src={produto.imagem} alt={produto.nome} className="w-20 h-20 object-cover rounded-lg" />
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-white mb-3">{produto.nome}</h3>
                          <div className="grid grid-cols-5 gap-4 mb-4">
                            <div><p className="text-orange-300 text-xs mb-1">Preço</p><p className="text-white font-semibold">R$ {produto.preco.toFixed(2)}</p></div>
                            <div><p className="text-orange-300 text-xs mb-1">Comissão</p><p className="text-green-400 font-bold">R$ {produto.comissao.toFixed(2)}</p></div>
                            <div><p className="text-orange-300 text-xs mb-1">Rating</p><p className="text-yellow-400 font-semibold">⭐ {produto.rating}</p></div>
                            <div><p className="text-orange-300 text-xs mb-1">Reviews</p><p className="text-white font-semibold">{produto.reviews}</p></div>
                            <div><p className="text-orange-300 text-xs mb-1">Demanda</p><p className="text-white font-semibold">{produto.demandaMensal}</p></div>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <button onClick={() => handleCopyLink(produto)} className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 text-sm font-semibold">
                              {copiedStates[`link-${produto.asin}`] ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                              {copiedStates[`link-${produto.asin}`] ? 'Copiado!' : 'Link'}
                            </button>
                            <button onClick={() => handleCopyMessage(produto)} className="flex items-center gap-2 bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 text-sm font-semibold">
                              {copiedStates[`msg-${produto.asin}`] ? <Check className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                              Mensagem
                            </button>
                            <button onClick={() => handleOpenWhatsApp(produto)} className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 text-sm font-semibold">
                              <Send className="w-4 h-4" />
                              WhatsApp
                            </button>
                            <button onClick={() => handleGerarPosts(produto)} className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-pink-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                              <Sparkles className="w-4 h-4" />
                              Posts IA
                            </button>
                            <button onClick={() => { setProdutoSelecionado(produto); setShowCalculadora(true); setCalculoROI({ investimento: '', vendasEsperadas: '', resultado: null }); }} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                              <Calculator className="w-4 h-4" />
                              ROI
                            </button>
                            <button onClick={() => handleListarProduto(produto)} className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-6 py-3 rounded-lg font-semibold">
                              <Plus className="w-5 h-5" />
                              Listar
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'produtos' && (
          <div className="space-y-6">
            <div className="bg-slate-800/50 border border-orange-500/30 rounded-xl p-6">
              {produtosAtivos.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-orange-400 mx-auto mb-4 opacity-50" />
                  <p className="text-orange-300 text-lg mb-2">Nenhum produto listado</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {produtosAtivos.map((produto) => (
                    <div key={produto.id} className="bg-slate-700/50 border border-orange-500/20 rounded-lg p-5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-white">{produto.nome}</h3>
                        <button onClick={() => handleSimularVenda(produto)} className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-lg font-semibold text-sm">Simular Venda</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'vendas' && (
          <div className="space-y-6">
            <div className="bg-slate-800/50 border border-orange-500/30 rounded-xl p-6">
              {vendas.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-16 h-16 text-orange-400 mx-auto mb-4 opacity-50" />
                  <p className="text-orange-300 text-lg mb-2">Nenhuma venda</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {vendas.map((venda) => (
                    <div key={venda.id} className="bg-slate-700/50 border border-green-500/20 rounded-lg p-5">
                      <h3 className="text-lg font-bold text-white mb-2">{venda.produtoNome}</h3>
                      <p className="text-green-400 font-bold">R$ {venda.comissao.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Index;
