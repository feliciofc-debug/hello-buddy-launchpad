import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link2, ShoppingBag, Gift, CheckCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function Marketplace() {
  const navigate = useNavigate();
  const [produtos, setProdutos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopeeLink, setShopeeLink] = useState("");
  const [converting, setConverting] = useState(false);
  const [categoriaFiltro, setCategoriaFiltro] = useState("todos");

  const categorias = [
    "Beleza & Cosméticos",
    "Suplementos & Vitaminas",
    "Casa & Decoração",
    "Eletrônicos",
    "Moda & Acessórios",
    "Saúde & Bem-estar"
  ];

  useEffect(() => {
    loadProdutos();
  }, []);

  const loadProdutos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('produtos_marketplace')
        .select('*')
        .eq('ativo', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setProdutos(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar produtos");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleConvertLink = async () => {
    if (!shopeeLink.trim()) {
      toast.error("Por favor, cole um link da Shopee");
      return;
    }

    try {
      setConverting(true);
      const { data, error } = await supabase.functions.invoke('converter-shopee', {
        body: { shopeeLink }
      });

      if (error) throw error;

      if (data?.success && data?.linkAfiliado) {
        toast.success("Link convertido! Abrindo no WhatsApp...");
        
        const mensagem = `🎁 *PROMOÇÃO EXCLUSIVA SHOPEE!*

Compre este produto usando MEU link de afiliado e ganhe um E-book GRÁTIS! 🎉

🔗 *Link do produto:*
${data.linkAfiliado}

✅ *Como funciona:*
1️⃣ Compre pelo link acima
2️⃣ Envie print do comprovante aqui no WhatsApp
3️⃣ Receba seu E-book GRÁTIS instantaneamente!

Aproveite! 🛍️`;

        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
        window.open(whatsappUrl, '_blank');
      } else {
        toast.error("Não foi possível converter o link");
      }
    } catch (error: any) {
      console.error('Erro ao converter:', error);
      toast.error("Erro ao converter link. Tente novamente.");
    } finally {
      setConverting(false);
      setShopeeLink("");
    }
  };

  const produtosFiltrados = produtos.filter(p => {
    const matchCategoria = categoriaFiltro === "todos" || p.categoria === categoriaFiltro;
    return matchCategoria;
  });

  const getPlatformBadge = (plataforma: string) => {
    const configs = {
      shopee: { color: 'bg-orange-500', label: '🛍️ Shopee' },
      amazon: { color: 'bg-yellow-600', label: '📦 Amazon' },
      mercadolivre: { color: 'bg-yellow-500', label: '🛒 Mercado Livre' },
      lomadee: { color: 'bg-blue-500', label: '🔗 Lomadee' },
      outros: { color: 'bg-gray-500', label: '🏪 Outros' },
    };
    const config = configs[plataforma as keyof typeof configs] || configs.outros;
    return <Badge className={`${config.color} text-white border-0`}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-purple-200">Carregando ofertas exclusivas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="fixed w-full top-0 z-50 bg-slate-900/80 backdrop-blur-lg border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-2 rounded-lg">
              <svg className="w-8 h-8" fill="white" viewBox="0 0 24 24">
                <path d="M20 7h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zM10 4h4v3h-4V4zm10 16H4V9h16v11z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold">AMZ Ofertas</h1>
              <p className="text-xs text-orange-300">Marketplace Premium</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="text-orange-300 hover:text-white transition">Início</button>
            <button onClick={() => navigate('/login')} className="bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-2 rounded-lg font-semibold hover:shadow-lg transition">Entrar</button>
          </div>
        </div>
      </header>
      {/* Hero Section - Conversor Shopee */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Título Principal */}
          <div className="text-center mb-12">
            <h2 className="text-5xl font-extrabold mb-4">
              Cole seu <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">Link da Shopee</span> Aqui
            </h2>
            <p className="text-purple-200 text-lg">
              Faça sua compra pela <span className="font-bold text-orange-400">AMZ Ofertas</span> e escolha um <span className="font-bold text-purple-400">E-book GRÁTIS!</span>
            </p>
          </div>

          {/* Input Conversor */}
          <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-purple-500/30 shadow-2xl mb-8">
            <CardContent className="p-8">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Link2 className="absolute left-4 top-1/2 transform -translate-y-1/2 text-orange-400" size={24} />
                  <Input
                    placeholder="Cole o link do produto Shopee aqui..."
                    className="pl-12 h-14 bg-slate-700 border-purple-500/50 text-white text-lg placeholder:text-purple-300 focus:border-orange-500"
                    value={shopeeLink}
                    onChange={(e) => setShopeeLink(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleConvertLink()}
                  />
                </div>
                <Button
                  onClick={handleConvertLink}
                  disabled={converting}
                  className="h-14 px-8 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold text-lg shadow-lg"
                >
                  {converting ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Convertendo...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Sparkles size={20} />
                      Converter Link
                    </span>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Cards Explicativos - 3 Colunas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {/* 1. Cole o Link */}
            <Card className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 border-purple-500/30 hover:border-purple-400 transition">
              <CardContent className="p-6 text-center">
                <div className="bg-purple-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Link2 className="text-white" size={32} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">1. Cole o Link</h3>
                <p className="text-purple-200 text-sm">
                  Copie qualquer link de produto da Shopee e cole no campo acima
                </p>
              </CardContent>
            </Card>

            {/* 2. Compre com Desconto */}
            <Card className="bg-gradient-to-br from-orange-900/50 to-orange-800/30 border-orange-500/30 hover:border-orange-400 transition">
              <CardContent className="p-6 text-center">
                <div className="bg-orange-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShoppingBag className="text-white" size={32} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">2. Compre com Desconto</h3>
                <p className="text-orange-200 text-sm">
                  Use nosso link de afiliado e aproveite as melhores ofertas da Shopee
                </p>
              </CardContent>
            </Card>

            {/* 3. Ganhe E-book GRÁTIS */}
            <Card className="bg-gradient-to-br from-pink-900/50 to-pink-800/30 border-pink-500/30 hover:border-pink-400 transition">
              <CardContent className="p-6 text-center">
                <div className="bg-pink-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Gift className="text-white" size={32} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">3. Ganhe E-book GRÁTIS</h3>
                <p className="text-pink-200 text-sm">
                  Envie o comprovante no WhatsApp e receba seu e-book instantaneamente!
                </p>
              </CardContent>
            </Card>
          </div>

          {/* CTA WhatsApp */}
          <div className="text-center">
            <p className="text-purple-300 mb-4">
              <CheckCircle className="inline mr-2 text-green-400" size={20} />
              100% Seguro | E-books entregues automaticamente via WhatsApp
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 py-8 bg-white">
        <div className="flex gap-8">
          <aside className="w-64 hidden lg:block">
            <div className="sticky top-24 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-bold mb-4 text-gray-900">Categorias</h3>
              <div className="space-y-2">
                <button onClick={() => setCategoriaFiltro("todos")} className={`w-full text-left px-4 py-2 rounded-lg transition ${categoriaFiltro === "todos" ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>Todas</button>
                {categorias.map(cat => (
                  <button key={cat} onClick={() => setCategoriaFiltro(cat)} className={`w-full text-left px-4 py-2 rounded-lg transition ${categoriaFiltro === cat ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>{cat}</button>
                ))}
              </div>
            </div>
          </aside>

          <main className="flex-1">
            <div className="mb-6"><p className="text-gray-600"><span className="text-2xl font-bold text-gray-900">{produtosFiltrados.length}</span> produtos encontrados</p></div>
            {produtosFiltrados.length === 0 ? (
              <div className="text-center py-20 bg-gray-50 rounded-2xl border border-gray-200">
                <ShoppingBag className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-2xl font-semibold mb-2 text-gray-900">Nenhum produto encontrado</h3>
                <p className="text-gray-600">Tente ajustar os filtros de busca</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {produtosFiltrados.map((produto) => (
                  <Card key={produto.id} className="group bg-white border-gray-200 hover:border-purple-400 hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden" onClick={() => navigate(`/marketplace/${produto.slug}`)}>
                    <div className="relative aspect-square overflow-hidden bg-gray-50">
                      {produto.imagens && produto.imagens[0] ? (
                        <img src={produto.imagens[0]} alt={produto.titulo} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Gift className="h-16 w-16 text-purple-400" /></div>
                      )}
                      {produto.preco_original && (
                        <div className="absolute top-3 right-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                          -{Math.round((1 - produto.preco / produto.preco_original) * 100)}%
                        </div>
                      )}
                      <div className="absolute top-3 left-3">{getPlatformBadge(produto.plataforma || 'outros')}</div>
                    </div>
                    <CardContent className="p-5 bg-white">
                      <h3 className="font-semibold text-sm mb-3 line-clamp-2 min-h-[2.5rem] text-gray-900 group-hover:text-purple-600 transition">{produto.titulo}</h3>
                      {produto.categoria && <Badge variant="outline" className="text-xs mb-3 border-gray-300 text-gray-700">{produto.categoria}</Badge>}
                      <div className="flex items-baseline gap-2 mb-3">
                        <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">R$ {produto.preco.toFixed(2)}</span>
                        {produto.preco_original && <span className="text-sm text-gray-500 line-through">R$ {produto.preco_original.toFixed(2)}</span>}
                      </div>
                      {produto.ebook_bonus && (
                        <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-green-500/20 border border-green-500/30 rounded-lg">
                          <Gift className="h-4 w-4 text-green-400" />
                          <span className="text-sm text-green-400 font-semibold">🎁 E-book Grátis</span>
                        </div>
                      )}
                      <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold" onClick={(e) => { e.stopPropagation(); navigate(`/marketplace/${produto.slug}`); }}>Ver Produto</Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      <footer className="bg-slate-950 border-t border-purple-500/20 py-12 px-6 mt-20">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-2 rounded-lg">
                <svg className="w-6 h-6" fill="white" viewBox="0 0 24 24"><path d="M20 7h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zM10 4h4v3h-4V4zm10 16H4V9h16v11z"/></svg>
              </div>
              <div><h3 className="font-bold">AMZ Ofertas</h3><p className="text-xs text-orange-300">Marketplace Premium</p></div>
            </div>
            <p className="text-sm text-slate-400">Produtos selecionados das melhores marcas</p>
          </div>
          <div><h4 className="font-bold mb-4 text-purple-300">Empresa</h4><ul className="space-y-2 text-sm text-slate-400"><li><a href="#" className="hover:text-white transition">Sobre Nós</a></li><li><a href="#" className="hover:text-white transition">Blog</a></li></ul></div>
          <div><h4 className="font-bold mb-4 text-purple-300">Suporte</h4><ul className="space-y-2 text-sm text-slate-400"><li><a href="#" className="hover:text-white transition">Central de Ajuda</a></li><li><a href="#" className="hover:text-white transition">FAQ</a></li></ul></div>
          <div><h4 className="font-bold mb-4 text-purple-300">Legal</h4><ul className="space-y-2 text-sm text-slate-400"><li><a href="/terms" className="hover:text-white transition">Termos de Uso</a></li><li><a href="/privacy" className="hover:text-white transition">Privacidade</a></li></ul></div>
        </div>
        <div className="max-w-7xl mx-auto mt-8 pt-8 border-t border-purple-500/20 text-center text-sm text-slate-400"><p>© 2024 AMZ Ofertas. Todos os direitos reservados.</p></div>
      </footer>
    </div>
  );
}
