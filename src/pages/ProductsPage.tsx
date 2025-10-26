import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ProductCard from "@/components/ProductCard";
import { Search, Loader2, ArrowLeft, BarChart3, Package } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TesmannModal } from "@/components/TesmannModal";
import type { Product, Marketplace } from "@/types/product";

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

  // Carrega produtos automaticamente ao abrir a aba Shopee
  useEffect(() => {
    if (activeMarketplace === 'shopee' && products.length === 0) {
      console.log('🚀 Carregando produtos Shopee automaticamente...');
      executeSearch('eletrônicos em oferta');
    }
  }, [activeMarketplace]);

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

      // ===== SHOPEE VIA EDGE FUNCTION (COM CREDENCIAIS) =====
      if (activeMarketplace === 'shopee') {
        console.log('🛍️ [SHOPEE] Buscando via Edge Function...');
        
        try {
          const response = await fetch(
            `${supabaseUrl}/functions/v1/buscar-produtos-shopee`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({
                searchTerm: searchTerm,
                limit: 20
              })
            }
          );

          if (!response.ok) {
            throw new Error(`Erro HTTP ${response.status}`);
          }

          const data = await response.json();
          console.log('✅ [SHOPEE] Dados recebidos:', data);

          if (data.products && Array.isArray(data.products)) {
            setProducts(data.products);
            toast.success(`${data.products.length} produtos encontrados!`);
          } else {
            throw new Error('Formato de resposta inválido');
          }
        } catch (error: any) {
          console.error('❌ [SHOPEE] Erro:', error);
          toast.error('Erro ao buscar produtos Shopee');
        }
      }
      // ===== LOMADEE VIA EDGE FUNCTION =====
      else if (activeMarketplace === 'lomadee') {
        console.log('🔗 [LOMADEE] Buscando via Edge Function...');
        
        const response = await fetch(
          `${supabaseUrl}/functions/v1/buscar-produtos-lomadee`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              keyword: searchTerm,
              sourceId: "all"
            })
          }
        );

        if (!response.ok) {
          throw new Error(`Erro HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log('✅ [LOMADEE] Dados recebidos:', data);

        if (data.products && Array.isArray(data.products)) {
          setProducts(data.products);
          toast.success(`${data.products.length} produtos encontrados!`);
        }
      }
    } catch (error: any) {
      console.error('❌ Erro na busca:', error);
      toast.error(error.message || 'Erro ao buscar produtos');
    } finally {
      setIsLoading(false);
    }
  }, [activeMarketplace]);

  const handleGenerateContent = async (product: Product) => {
    setSelectedProduct(product);
    setShowTesmannModal(true);
    setAiLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-tesmann-content', {
        body: { product }
      });

      if (error) throw error;
      
      setGeneratedContent(data);
    } catch (error) {
      console.error('Erro ao gerar conteúdo:', error);
      toast.error('Erro ao gerar conteúdo');
      setShowTesmannModal(false);
    } finally {
      setAiLoading(false);
    }
  };

  const currentConfig = marketplaceConfig[activeMarketplace];

  return (
    <div className="flex min-h-screen">
      {/* Sidebar igual ao Dashboard */}
      <aside className="hidden lg:block bg-card border-r w-64 space-y-6 py-7 px-2">
        <a href="/dashboard" className="flex items-center gap-3 px-4">
          <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center shadow-md">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <span className="text-2xl font-bold">AMZ Ofertas</span>
        </a>
        <nav className="space-y-2">
          <a href="/dashboard" className="w-full text-left flex items-center gap-3 py-2.5 px-4 rounded hover:bg-accent transition">
            <BarChart3 size={20} />
            Dashboard
          </a>
          <a href="/produtos" className="w-full text-left flex items-center gap-3 py-2.5 px-4 rounded bg-primary text-primary-foreground">
            <Package size={20} />
            Produtos
          </a>
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Header igual ao Dashboard */}
        <header className="flex items-center justify-between p-4 bg-card border-b">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="lg:hidden flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h2 className="text-xl font-semibold">Buscar Produtos</h2>
          </div>
          <ThemeToggle />
        </header>

        {/* Content */}
        <main className="flex-1 bg-background overflow-auto p-6">
          {/* SELETOR DE MARKETPLACE */}
          <div className="flex items-center gap-2 border-b pb-4 mb-6">
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
                    variant="outline"
                    onClick={() => {
                      setKeyword(category);
                      executeSearch(category);
                    }}
                    className="justify-start"
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </aside>

            {/* Main Content */}
            <div className="lg:col-span-3 space-y-6">
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

              {/* Loading State */}
              {isLoading && (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}

              {/* Products Grid */}
              {!isLoading && products.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {products.map((product, index) => (
                    <ProductCard
                      key={product.id || index}
                      product={product}
                      onGenerateContent={handleGenerateContent}
                    />
                  ))}
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
