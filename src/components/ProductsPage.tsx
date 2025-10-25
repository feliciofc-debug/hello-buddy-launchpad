import { useState, useMemo, useEffect } from "react";
import ProductCard from "./ProductCard";
import { TrendingUp, DollarSign, Star, ShoppingBag, Search, Loader2 } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import GerarConteudoModal from "@/pages/GerarConteudoModal";
import { TesmannModal } from "./TesmannModal";
import type { Product } from "@/types/product";

// Tipos para os marketplaces suportados
type Marketplace = 'shopee' | 'lomadee';

// Configuração central para cada marketplace
const marketplaceConfig = {
  shopee: {
    label: 'Shopee',
    placeholder: 'Buscar produtos na Shopee...',
    apiFunctionName: 'shopee-affiliate-api',
    categoryTitle: 'Categorias Shopee',
    icon: '🛍️',
  },
  lomadee: {
    label: 'Lomadee',
    placeholder: 'Buscar produtos na Lomadee...',
    apiFunctionName: 'buscar-produtos-lomadee',
    categoryTitle: 'Categorias Lomadee',
    icon: '🔗',
  },
};

export default function ProductsPage() {
  const [activeMarketplace, setActiveMarketplace] = useState<Marketplace>('lomadee');
  const [keyword, setKeyword] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showTesmannModal, setShowTesmannModal] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const handleSearch = async () => {
    if (!keyword.trim()) {
      toast.warning('Por favor, digite um termo para buscar.');
      return;
    }

    setIsLoading(true);
    setProducts([]);

    try {
      const config = marketplaceConfig[activeMarketplace];
      
      const { data, error } = await supabase.functions.invoke(config.apiFunctionName, {
        body: {
          searchTerm: keyword,
          limit: 50,
          offset: 0
        }
      });

      if (error) throw error;

      setProducts(data.produtos || data.products || []);
      
      if ((data.produtos || data.products || []).length === 0) {
        toast.info('Nenhum produto encontrado para este termo.');
      }

    } catch (err: any) {
      console.error('Erro ao buscar produtos:', err);
      toast.error('Falha na busca', { description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateContent = async (product: Product) => {
    setSelectedProduct(product);
    setAiLoading(true);
    setShowTesmannModal(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-tesmann-content', {
        body: {
          productTitle: product.title,
          productPrice: product.price,
          productRating: product.rating,
          productLink: product.affiliateLink,
        }
      });

      if (error) throw error;

      setGeneratedContent(data);
      toast.success('Conteúdo gerado com sucesso!');
    } catch (err: any) {
      console.error('Erro ao gerar conteúdo:', err);
      toast.error('Erro ao gerar conteúdo. Tente novamente.');
      setShowTesmannModal(false);
    } finally {
      setAiLoading(false);
    }
  };

  // Calcular estatísticas
  const stats = useMemo(() => {
    const total = products.length;
    const totalCommission = products.reduce((acc, p) => acc + (p.commission || 0), 0);
    const avgRating = products.length > 0 
      ? products.reduce((acc, p) => acc + (p.rating || 0), 0) / total 
      : 0;
    const topSeller = products.length > 0
      ? products.reduce((max, p) => (p.sales || 0) > (max.sales || 0) ? p : max, products[0])
      : null;

    return { total, totalCommission, avgRating, topSeller };
  }, [products]);

  const currentConfig = marketplaceConfig[activeMarketplace];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Produtos para Afiliados</h1>
        <p className="text-muted-foreground">
          Encontre os melhores produtos para promover e ganhar comissões.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-8 h-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total de Produtos</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Comissão Potencial</p>
                <p className="text-2xl font-bold">
                  R$ {stats.totalCommission.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Star className="w-8 h-8 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Avaliação Média</p>
                <p className="text-2xl font-bold">
                  {stats.avgRating.toFixed(1)} ⭐
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Top Seller</p>
                <p className="text-sm font-bold line-clamp-2">
                  {stats.topSeller?.title || 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SELETOR DE MARKETPLACE */}
      <Tabs value={activeMarketplace} onValueChange={(value) => setActiveMarketplace(value as Marketplace)}>
        <TabsList>
          <TabsTrigger value="shopee">
            <span className="mr-2">{marketplaceConfig.shopee.icon}</span>
            {marketplaceConfig.shopee.label}
          </TabsTrigger>
          <TabsTrigger value="lomadee">
            <span className="mr-2">{marketplaceConfig.lomadee.icon}</span>
            {marketplaceConfig.lomadee.label}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* BARRA DE BUSCA DINÂMICA */}
      <div className="flex w-full max-w-2xl items-center space-x-2">
        <Input
          type="text"
          placeholder={currentConfig.placeholder}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          disabled={isLoading}
        />
        <Button onClick={handleSearch} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-2 h-4 w-4" />
          )}
          Buscar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* FILTROS LATERAIS DINÂMICOS */}
        <aside className="md:col-span-1">
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-4">{currentConfig.categoryTitle}</h3>
              <p className="text-sm text-muted-foreground">Categorias em breve...</p>
            </CardContent>
          </Card>
        </aside>

        {/* ÁREA DE RESULTADOS */}
        <main className="md:col-span-3">
          {isLoading && (
            <div className="flex flex-col items-center justify-center text-center p-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-4 text-muted-foreground">Buscando as melhores ofertas...</p>
            </div>
          )}
          
          {!isLoading && products.length === 0 && keyword && (
            <Card>
              <CardContent className="p-10 text-center">
                <ShoppingBag className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Nenhum produto encontrado</h3>
                <p className="text-muted-foreground">
                  Tente um termo de busca diferente.
                </p>
              </CardContent>
            </Card>
          )}

          {!isLoading && products.length === 0 && !keyword && (
            <Card>
              <CardContent className="p-10 text-center">
                <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Comece sua busca</h3>
                <p className="text-muted-foreground">
                  Digite um termo acima para encontrar produtos incríveis.
                </p>
              </CardContent>
            </Card>
          )}
          
          {!isLoading && products.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((product) => (
                <ProductCard 
                  key={`${product.id}-${activeMarketplace}`} 
                  product={product}
                  onGenerateContent={handleGenerateContent}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Modal Tesmann */}
      <TesmannModal
        isOpen={showTesmannModal}
        onClose={() => {
          setShowTesmannModal(false);
          setSelectedProduct(null);
          setGeneratedContent(null);
        }}
        content={generatedContent}
        isLoading={aiLoading}
      />
    </div>
  );
}
