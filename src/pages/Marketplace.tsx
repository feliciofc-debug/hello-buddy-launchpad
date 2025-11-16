import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, ShoppingBag, Gift } from "lucide-react";
import { toast } from "sonner";

export default function Marketplace() {
  const navigate = useNavigate();
  const [produtos, setProdutos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
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

  const produtosFiltrados = produtos.filter(p => {
    const matchSearch = p.titulo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategoria = categoriaFiltro === "todos" || p.categoria === categoriaFiltro;
    return matchSearch && matchCategoria;
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

      <section className="pt-32 pb-12 px-6 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-5xl md:text-6xl font-bold mb-6">
            Marketplace de <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">Ofertas Premium</span>
          </h2>
          <p className="text-xl text-purple-200 mb-8 max-w-3xl mx-auto">Produtos selecionados das melhores marcas com preços exclusivos. Ganhe e-book grátis em cada compra!</p>
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-purple-400" />
              <Input placeholder="Buscar produtos..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-12 h-14 bg-slate-800/50 border-purple-500/30 text-white placeholder:text-purple-300" />
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex gap-8">
          <aside className="w-64 hidden lg:block">
            <div className="sticky top-24 bg-slate-800/50 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-4 text-purple-300">Categorias</h3>
              <div className="space-y-2">
                <button onClick={() => setCategoriaFiltro("todos")} className={`w-full text-left px-4 py-2 rounded-lg transition ${categoriaFiltro === "todos" ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white' : 'text-purple-200 hover:bg-slate-700/50'}`}>Todas</button>
                {categorias.map(cat => (
                  <button key={cat} onClick={() => setCategoriaFiltro(cat)} className={`w-full text-left px-4 py-2 rounded-lg transition ${categoriaFiltro === cat ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white' : 'text-purple-200 hover:bg-slate-700/50'}`}>{cat}</button>
                ))}
              </div>
            </div>
          </aside>

          <main className="flex-1">
            <div className="mb-6"><p className="text-purple-200"><span className="text-2xl font-bold text-white">{produtosFiltrados.length}</span> produtos encontrados</p></div>
            {produtosFiltrados.length === 0 ? (
              <div className="text-center py-20 bg-slate-800/30 rounded-2xl border border-purple-500/20">
                <ShoppingBag className="h-16 w-16 mx-auto text-purple-400 mb-4" />
                <h3 className="text-2xl font-semibold mb-2">Nenhum produto encontrado</h3>
                <p className="text-purple-300">Tente ajustar os filtros de busca</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {produtosFiltrados.map((produto) => (
                  <Card key={produto.id} className="group bg-slate-800/50 border-purple-500/30 hover:border-purple-500/60 hover:shadow-2xl hover:shadow-purple-500/20 transition-all duration-300 cursor-pointer overflow-hidden" onClick={() => navigate(`/marketplace/${produto.slug}`)}>
                    <div className="relative aspect-square overflow-hidden bg-slate-900">
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
                    <CardContent className="p-5 bg-gradient-to-b from-slate-800/80 to-slate-900">
                      <h3 className="font-semibold text-sm mb-3 line-clamp-2 min-h-[2.5rem] text-white group-hover:text-purple-300 transition">{produto.titulo}</h3>
                      {produto.categoria && <Badge variant="outline" className="text-xs mb-3 border-purple-500/50 text-purple-300">{produto.categoria}</Badge>}
                      <div className="flex items-baseline gap-2 mb-3">
                        <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">R$ {produto.preco.toFixed(2)}</span>
                        {produto.preco_original && <span className="text-sm text-slate-400 line-through">R$ {produto.preco_original.toFixed(2)}</span>}
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
