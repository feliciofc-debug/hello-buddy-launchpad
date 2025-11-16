import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, ShoppingBag, Gift, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function Marketplace() {
  const navigate = useNavigate();
  const [produtos, setProdutos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoria, setCategoria] = useState("todos");

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
      
      let query = supabase
        .from('produtos_marketplace')
        .select('*')
        .eq('ativo', true)
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      
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
    const matchCategoria = categoria === "todos" || p.categoria === categoria;
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
    return <Badge className={`${config.color} text-white`}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando produtos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/dashboard')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Marketplace AMZ
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Produtos exclusivos para afiliados
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-purple-600" />
              <span className="text-sm font-medium">{produtosFiltrados.length} produtos</span>
            </div>
          </div>

          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produtos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas Categorias</SelectItem>
                {categorias.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Grid de Produtos */}
      <div className="container mx-auto px-4 py-8">
        {produtosFiltrados.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nenhum produto encontrado</h3>
            <p className="text-muted-foreground">Tente ajustar os filtros de busca</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {produtosFiltrados.map((produto) => (
              <Card
                key={produto.id}
                className="group hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden"
                onClick={() => navigate(`/marketplace/${produto.slug}`)}
              >
                <div className="relative aspect-square overflow-hidden bg-gray-100">
                  {produto.imagens && produto.imagens[0] ? (
                    <img
                      src={produto.imagens[0]}
                      alt={produto.titulo}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Gift className="h-16 w-16 text-gray-300" />
                    </div>
                  )}
                  
                  {produto.preco_original && (
                    <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                      -{Math.round((1 - produto.preco / produto.preco_original) * 100)}%
                    </div>
                  )}

                  <div className="absolute bottom-2 left-2">
                    {getPlatformBadge(produto.plataforma || 'outros')}
                  </div>
                </div>

                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm mb-2 line-clamp-2 min-h-[2.5rem]">
                    {produto.titulo}
                  </h3>

                  {produto.categoria && (
                    <Badge variant="outline" className="text-xs mb-2">
                      {produto.categoria}
                    </Badge>
                  )}

                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-2xl font-bold text-purple-600">
                      R$ {produto.preco.toFixed(2)}
                    </span>
                    {produto.preco_original && (
                      <span className="text-sm text-muted-foreground line-through">
                        R$ {produto.preco_original.toFixed(2)}
                      </span>
                    )}
                  </div>

                  {produto.ebook_bonus && (
                    <div className="mt-3 flex items-center gap-1 text-xs text-green-600">
                      <Gift className="h-3 w-3" />
                      <span>+ E-book bônus</span>
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{produto.visualizacoes || 0} visualizações</span>
                    <span>{produto.cliques_afiliado || 0} cliques</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
