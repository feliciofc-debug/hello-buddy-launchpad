import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import ProductCard from "@/components/ProductCard";
import { Search, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TesmannModal } from "@/components/TesmannModal";
import type { Product } from "@/types/product";

type Marketplace = 'shopee' | 'lomadee';

// Categorias estáticas clicáveis
const staticCategories = [
  'Celulares',
  'Informática',
  'Casa e Cozinha',
  'Beleza',
  'Moda',
  'Esportes',
];

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
  const navigate = useNavigate();
  const [activeMarketplace, setActiveMarketplace] = useState<Marketplace>('shopee');
  const [keyword, setKeyword] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showTesmannModal, setShowTesmannModal] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const executeSearch = useCallback(async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      toast.warning('Digite ou selecione um termo para buscar');
      return;
    }

    console.log('🔍 [BUSCA] Iniciando:', searchTerm);
    console.log('📍 [MARKETPLACE]:', activeMarketplace);

    setIsLoading(true);
    setProducts([]);
    setKeyword(searchTerm);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('Faça login para buscar produtos');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Configuração do sistema incompleta');
      }

      // ===== SHOPEE =====
      if (activeMarketplace === 'shopee') {
        // Aviso sobre limitação da API
        toast.info('A Shopee retorna ofertas em destaque que serão filtradas pela busca');
        
        console.log('🛍️ [SHOPEE] Buscando ofertas...');
        
        const { data, error } = await supabase.functions.invoke('shopee-affiliate-api', {
          body: { pageSize: 50, keywords: searchTerm }
        });

        console.log('📥 [SHOPEE] Resposta completa:', data);
        console.log('❌ [SHOPEE] Erro:', error);

        if (error) throw error;

        if (data.status === 'error') {
          throw new Error(data.error || 'Erro na API Shopee');
        }

        const shopeeNodes = data.data?.productOfferV2?.nodes || [];
        console.log('🛍️ [SHOPEE] Nodes recebidos:', shopeeNodes.length);

        if (shopeeNodes.length === 0) {
          toast.warning('Nenhuma oferta disponível no momento. Tente novamente mais tarde.');
          setProducts([]);
          return;
        }

        const foundProducts = shopeeNodes.map((node: any) => ({
          id: `shopee_${node.productLink?.split('/').pop() || Math.random()}`,
          title: node.productName || 'Produto sem nome',
          price: parseFloat(node.price) || 0,
          commission: parseFloat(node.commission) || 0,
          commissionPercent: Math.round((parseFloat(node.commissionRate) || 0) * 100),
          rating: 4.5,
          reviews: 0,
          sales: 0,
          imageUrl: node.imageUrl || 'https://via.placeholder.com/400',
          affiliateLink: node.offerLink || node.productLink || '#',
          category: 'Shopee',
          marketplace: 'shopee',
          badge: '',
        }));

        console.log('🛍️ [SHOPEE] Produtos mapeados:', foundProducts.length);
        setProducts(foundProducts);
        toast.success(`${foundProducts.length} produtos encontrados!`);
      }

      // ===== LOMADEE =====
      else if (activeMarketplace === 'lomadee') {
        console.log('🔗 [LOMADEE] Buscando produtos...');
        
        const lomadeeUrl = `${supabaseUrl}/functions/v1/buscar-produtos-lomadee`;
        const params = new URLSearchParams({
          keyword: searchTerm,
          limit: '50',
          offset: '0',
        });

        console.log('🌐 [LOMADEE] URL completa:', `${lomadeeUrl}?${params}`);

        const response = await fetch(`${lomadeeUrl}?${params}`, {
          method: 'GET',
          headers: { 
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        console.log('📡 [LOMADEE] Status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ [LOMADEE] Erro:', errorText);
          throw new Error(`Erro Lomadee: ${errorText}`);
        }

        const data = await response.json();
        console.log('📦 [LOMADEE] Resposta:', data);

        const lomadeeProducts = data.produtos || [];
        console.log('📦 [LOMADEE] Produtos:', lomadeeProducts.length);

        if (lomadeeProducts.length === 0) {
          toast.info('Nenhum produto encontrado na Lomadee');
          setProducts([]);
          return;
        }

        // Mapear para formato universal
        const mappedProducts = lomadeeProducts.map((p: any) => ({
          id: p.id,
          title: p.nome,
          price: p.preco,
          commission: p.comissao,
          commissionPercent: p.comissaoPercentual || 0,
          rating: p.rating || 0,
          reviews: p.reviews || 0,
          sales: p.demandaMensal || 0,
          imageUrl: p.imagem,
          affiliateLink: p.url,
          category: p.categoria || 'Lomadee',
          marketplace: 'lomadee',
          badge: '',
        }));

        setProducts(mappedProducts);
        toast.success(`${mappedProducts.length} produtos encontrados!`);
      }

    } catch (err: any) {
      console.error('❌ [BUSCA] Erro:', err);
      
      toast.error('Erro na busca', { 
        description: err.message || 'Erro desconhecido',
        duration: 6000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeMarketplace]);

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


  const currentConfig = marketplaceConfig[activeMarketplace];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 space-y-6">
      {/* Botão Voltar */}
      <div>
        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Dashboard
        </Button>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Buscador de Produtos para Afiliados</h1>
        <p className="text-muted-foreground">
          Encontre as melhores ofertas para promover e ganhar comissões
        </p>
      </div>

      {/* SELETOR DE MARKETPLACE */}
      <div className="flex items-center gap-2 border-b pb-2">
        {Object.keys(marketplaceConfig).map((key) => (
          <Button
            key={key}
            variant={activeMarketplace === key ? 'default' : 'ghost'}
            onClick={() => {
              setActiveMarketplace(key as Marketplace);
              setProducts([]);
              setKeyword('');
            }}
          >
            <span className="mr-2">{marketplaceConfig[key as Marketplace].icon}</span>
            {marketplaceConfig[key as Marketplace].label}
          </Button>
        ))}
      </div>

      {/* Layout: Sidebar + Main */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Sidebar: Categorias Clicáveis */}
        <aside className="lg:col-span-1">
          <h3 className="font-semibold mb-4">
            {currentConfig.categoryTitle}
          </h3>
          <div className="flex flex-col space-y-2">
            {staticCategories.map((category) => (
              <Button
                key={category}
                variant="ghost"
                className="justify-start"
                onClick={() => executeSearch(category)}
                disabled={isLoading}
              >
                {category}
              </Button>
            ))}
          </div>
        </aside>

        {/* Main Content */}
        <main className="lg:col-span-3 space-y-6">
          
          {/* Campo de Busca */}
          <div className="flex w-full items-center space-x-2">
            <Input
              type="text"
              placeholder={currentConfig.placeholder}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  executeSearch(keyword);
                }
              }}
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              onClick={() => executeSearch(keyword)} 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Buscar
                </>
              )}
            </Button>
          </div>

          {/* Resultados */}
          <div>
            {/* Loading Skeleton */}
            {isLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="bg-muted h-64 rounded-lg"></div>
                    <div className="mt-2 bg-muted h-4 w-3/4 rounded"></div>
                    <div className="mt-2 bg-muted h-4 w-1/2 rounded"></div>
                  </div>
                ))}
              </div>
            )}

            {/* Products Grid */}
            {!isLoading && products.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {products.map((product) => (
                  <ProductCard
                    key={`${product.id}-${activeMarketplace}`}
                    product={product}
                    onGenerateContent={handleGenerateContent}
                  />
                ))}
              </div>
            )}

            {/* Empty State */}
            {!isLoading && products.length === 0 && keyword && (
              <div className="text-center p-10 text-muted-foreground">
                <p className="text-lg mb-2">Nenhum produto encontrado</p>
                <p className="text-sm">Tente outro termo ou categoria</p>
              </div>
            )}

            {/* Initial State */}
            {!isLoading && products.length === 0 && !keyword && (
              <div className="text-center p-10 text-muted-foreground">
                <Search className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">Busque produtos em {currentConfig.label}</p>
                <p className="text-sm">Digite um termo ou clique em uma categoria</p>
              </div>
            )}
          </div>
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
