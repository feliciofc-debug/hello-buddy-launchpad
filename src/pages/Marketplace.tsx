import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingBag, Search } from "lucide-react";
import { toast } from "sonner";
import { CATEGORIAS_MARKETPLACE } from "@/lib/categories";

export default function Marketplace() {
  const navigate = useNavigate();
  const [produtos, setProdutos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("todas");
  const [precoMin, setPrecoMin] = useState("");
  const [precoMax, setPrecoMax] = useState("");
  const [ordenacao, setOrdenacao] = useState("relevancia");

  useEffect(() => {
    carregarProdutos();
  }, [categoriaFiltro, busca, precoMin, precoMax, ordenacao]);

  const carregarProdutos = async () => {
    setLoading(true);
    
    try {
      let query = supabase
        .from('produtos')
        .select(`
          *,
          user_id
        `)
        .eq('publicar_marketplace', true)
        .eq('ativo', true);

      // Filtro de categoria
      if (categoriaFiltro !== 'todas') {
        query = query.eq('categoria', categoriaFiltro);
      }

      // Filtro de busca
      if (busca) {
        query = query.or(`nome.ilike.%${busca}%,descricao.ilike.%${busca}%`);
      }

      // Filtro de preço
      if (precoMin) {
        query = query.gte('preco', parseFloat(precoMin));
      }
      if (precoMax) {
        query = query.lte('preco', parseFloat(precoMax));
      }

      // Ordenação
      if (ordenacao === 'menor-preco') {
        query = query.order('preco', { ascending: true });
      } else if (ordenacao === 'maior-preco') {
        query = query.order('preco', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;

      if (error) throw error;
      setProdutos(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar produtos:', error);
      toast.error("Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando produtos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* HEADER */}
      <header className="bg-[#232F3E] text-white py-4 sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-8 w-8 text-[#FF9900]" />
              <h1 className="text-2xl font-bold">AMZ Ofertas</h1>
            </div>
            
            {/* BUSCA */}
            <div className="flex-1 max-w-2xl">
              <div className="flex">
                <Input
                  placeholder="Buscar produtos..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="rounded-r-none bg-white text-black"
                />
                <Button className="rounded-l-none bg-[#FF9900] hover:bg-[#FF9900]/90">
                  <Search className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <Button variant="ghost" onClick={() => navigate('/')} className="text-white">
              Início
            </Button>
            <Button onClick={() => navigate('/login')} className="bg-[#FF9900] hover:bg-[#FF9900]/90">
              Entrar
            </Button>
          </div>
        </div>
      </header>

      {/* CATEGORIAS */}
      <div className="bg-[#37475A] text-white py-2">
        <div className="container mx-auto px-4">
          <div className="flex gap-4 overflow-x-auto">
            <Button
              variant="ghost"
              size="sm"
              className={categoriaFiltro === 'todas' ? 'bg-white/10' : ''}
              onClick={() => setCategoriaFiltro('todas')}
            >
              Todas
            </Button>
            {CATEGORIAS_MARKETPLACE.map(cat => (
              <Button
                key={cat.id}
                variant="ghost"
                size="sm"
                className={categoriaFiltro === cat.id ? 'bg-white/10' : ''}
                onClick={() => setCategoriaFiltro(cat.id)}
              >
                {cat.icone} {cat.nome}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* CONTEÚDO */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-6">
          {/* FILTROS LATERAIS */}
          <aside className="w-64 hidden lg:block space-y-4">
            <Card>
              <CardContent className="p-4">
                <h3 className="font-bold mb-3">💰 Faixa de Preço</h3>
                <div className="space-y-2">
                  <Input
                    type="number"
                    placeholder="Mínimo"
                    value={precoMin}
                    onChange={(e) => setPrecoMin(e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder="Máximo"
                    value={precoMax}
                    onChange={(e) => setPrecoMax(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <h3 className="font-bold mb-3">📦 Categorias</h3>
                <div className="space-y-2">
                  <Button
                    variant={categoriaFiltro === 'todas' ? 'default' : 'outline'}
                    className="w-full justify-start"
                    onClick={() => setCategoriaFiltro('todas')}
                  >
                    Todas
                  </Button>
                  {CATEGORIAS_MARKETPLACE.map(cat => (
                    <Button
                      key={cat.id}
                      variant={categoriaFiltro === cat.id ? 'default' : 'outline'}
                      className="w-full justify-start text-sm"
                      onClick={() => setCategoriaFiltro(cat.id)}
                    >
                      {cat.icone} {cat.nome}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </aside>

          {/* GRID DE PRODUTOS */}
          <main className="flex-1">
            <div className="mb-4 flex justify-between items-center">
              <p className="text-muted-foreground">
                <span className="font-bold text-foreground">{produtos.length}</span> produtos encontrados
              </p>
              <Select value={ordenacao} onValueChange={setOrdenacao}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevancia">Mais relevantes</SelectItem>
                  <SelectItem value="menor-preco">Menor preço</SelectItem>
                  <SelectItem value="maior-preco">Maior preço</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {produtos.length === 0 ? (
              <div className="text-center py-20">
                <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-2xl font-semibold mb-2">Nenhum produto encontrado</h3>
                <p className="text-muted-foreground">Tente ajustar os filtros de busca</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {produtos.map(produto => (
                  <Card 
                    key={produto.id} 
                    className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => navigate(`/marketplace/${produto.id}`)}
                  >
                    <CardContent className="p-4">
                      {/* IMAGEM */}
                      <div className="aspect-square mb-3 bg-muted rounded overflow-hidden">
                        <img
                          src={produto.imagens?.[0] || produto.imagem_url || '/placeholder.svg'}
                          alt={produto.nome}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* NOME */}
                      <h3 className="font-medium text-sm mb-2 line-clamp-2 min-h-[2.5rem]">
                        {produto.nome}
                      </h3>

                      {/* CATEGORIA */}
                      {produto.categoria && (
                        <Badge variant="outline" className="text-xs mb-2">
                          {CATEGORIAS_MARKETPLACE.find(c => c.id === produto.categoria)?.nome || produto.categoria}
                        </Badge>
                      )}

                      {/* PREÇO */}
                      <div className="mb-3">
                        <p className="text-2xl font-bold text-primary">
                          R$ {produto.preco?.toFixed(2)}
                        </p>
                      </div>

                      {/* ESTOQUE */}
                      {produto.estoque > 0 ? (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          ✅ Em estoque ({produto.estoque})
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-red-600 border-red-600">
                          ❌ Esgotado
                        </Badge>
                      )}

                      <Button 
                        className="w-full mt-3 bg-[#FF9900] hover:bg-[#FF9900]/90"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/marketplace/${produto.id}`);
                        }}
                      >
                        Ver Produto
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="bg-muted border-t py-12 px-6 mt-20">
        <div className="container mx-auto grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <ShoppingBag className="h-6 w-6 text-[#FF9900]" />
              <h3 className="font-bold">AMZ Ofertas</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Marketplace com produtos de qualidade de vendedores verificados
            </p>
          </div>
          <div>
            <h4 className="font-bold mb-4">Empresa</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition">Sobre Nós</a></li>
              <li><a href="#" className="hover:text-foreground transition">Blog</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-4">Suporte</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition">Central de Ajuda</a></li>
              <li><a href="#" className="hover:text-foreground transition">FAQ</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="/terms" className="hover:text-foreground transition">Termos de Uso</a></li>
              <li><a href="/privacy" className="hover:text-foreground transition">Privacidade</a></li>
            </ul>
          </div>
        </div>
        <div className="container mx-auto mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
          <p>© 2024 AMZ Ofertas. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
