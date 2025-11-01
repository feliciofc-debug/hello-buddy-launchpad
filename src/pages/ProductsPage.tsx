import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { 
  Search, 
  ShoppingBag, 
  Loader2, 
  Star, 
  TrendingUp,
  Package,
  ArrowLeft 
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import ProductCard from '@/components/ProductCard';
import { LomadeeStoreModal } from '@/components/LomadeeStoreModal';
import type { Product } from '@/data/mockData';

const ProductsPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('shopee');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [shopeeProducts, setShopeeProducts] = useState<Product[]>([]);
  const [lomadeeProducts, setLomadeeProducts] = useState<Product[]>([]);
  const [error, setError] = useState('');
  const [selectedStore, setSelectedStore] = useState<{ name: string; logo: string; commission: string } | null>(null);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);

  // Carrega produtos reais da Lomadee ao montar o componente
  useEffect(() => {
    if (activeTab === 'lomadee') {
      fetchLomadeeProducts();
    }
  }, [activeTab]);

  const fetchLomadeeProducts = async () => {
    setIsLoading(true);
    setError('');
    setLomadeeProducts([]);

    try {
      console.log('[LOMADEE] Carregando ofertas reais...');
      const response = await fetch('https://amz-ofertas-robo.onrender.com/scrape/lomadee?limit=50');
      
      if (!response.ok) {
        throw new Error('Erro ao conectar com a API de ofertas');
      }

      const data = await response.json();

      if (data.success && data.produtos && data.produtos.length > 0) {
        console.log(`[LOMADEE] ✅ ${data.produtos.length} ofertas carregadas`);
        
        const formattedProducts: Product[] = data.produtos.map((item: any, index: number) => ({
          id: `lomadee-${index}`,
          title: item.titulo || 'Loja sem nome',
          description: item.titulo || '',
          price: 0, // API não retorna preço
          commission: item.comissao || 0,
          commissionPercent: item.comissao || 0,
          marketplace: 'lomadee',
          category: '💼 Negócios',
          imageUrl: item.imagem_url || 'https://via.placeholder.com/200',
          affiliateLink: item.produto_url || '#',
          rating: 0,
          reviews: 0,
          sales: 0,
          createdAt: new Date(),
          bsr: 0,
          bsrCategory: 'Business'
        }));
        
        // Ordenar por maior comissão
        const sortedProducts = formattedProducts.sort((a, b) => b.commissionPercent - a.commissionPercent);
        
        setLomadeeProducts(sortedProducts);
      } else {
        throw new Error('Nenhuma oferta encontrada');
      }
    } catch (error) {
      console.error('[LOMADEE] ❌ Erro:', error);
      setError(error instanceof Error ? error.message : 'Erro ao conectar com a API de ofertas');
      setLomadeeProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchShopeeProducts = async (query: string) => {
    setIsLoading(true);
    setError('');
    setShopeeProducts([]);

    // ✅ Proxy privado do Cloudflare configurado e ativo
    const CLOUDFLARE_WORKER_URL = 'https://amz-ofertas-proxy.feliciofc.workers.dev/?url=';
    
    const shopeeApiUrl = `https://shopee.com.br/api/v4/search/search_items?by=sales&keyword=${encodeURIComponent(query)}&limit=20&newest=0&order=desc&page_type=search`;

    console.log(`[BUSCA V10] Iniciando busca por: "${query}"`);

    try {
      // Verifica se o proxy foi configurado
      if (CLOUDFLARE_WORKER_URL.includes('COLOQUE_A_URL')) {
        console.warn('[BUSCA V10] ⚠️ Cloudflare Worker não configurado, usando Edge Function como fallback');
        
        // FALLBACK: Usa nossa Edge Function do Supabase
        const { data, error: funcError } = await supabase.functions.invoke('shopee-proxy-cors', {
          body: { query }
        });

        if (funcError) {
          throw new Error(funcError.message || 'Erro na Edge Function');
        }

        if (data && data.items && data.items.length > 0) {
          console.log(`[BUSCA V10] ✅ ${data.items.length} produtos encontrados via Edge Function`);
          const formattedProducts: Product[] = data.items.map((item: any) => {
            const itemBasic = item.item_basic || item;
            const price = (itemBasic.price || 0) / 100000;
            
            return {
              id: itemBasic.itemid?.toString() || String(Math.random()),
              title: itemBasic.name || 'Produto sem nome',
              description: itemBasic.name || '',
              price: price,
              originalPrice: price * 1.2,
              imageUrl: itemBasic.image 
                ? `https://cf.shopee.com.br/file/${itemBasic.image}`
                : 'https://via.placeholder.com/200',
              affiliateLink: `https://shopee.com.br/product/${itemBasic.shopid}/${itemBasic.itemid}`,
              marketplace: 'shopee',
              category: '📱 Eletrônicos',
              rating: itemBasic.item_rating?.rating_star || 0,
              reviews: itemBasic.historical_sold || itemBasic.sold || 0,
              sales: itemBasic.historical_sold || itemBasic.sold || 0,
              commission: price * 0.1,
              commissionPercent: 10,
              createdAt: new Date(),
              bsr: 0,
              bsrCategory: 'Electronics'
            };
          });
          
          setShopeeProducts(formattedProducts);
          return;
        } else {
          throw new Error('Nenhum produto encontrado');
        }
      }

      // USA CLOUDFLARE WORKER (quando configurado)
      console.log('[BUSCA V10] 🚀 Usando Cloudflare Worker privado...');
      const response = await fetch(`${CLOUDFLARE_WORKER_URL}${encodeURIComponent(shopeeApiUrl)}`);

      if (!response.ok) {
        throw new Error(`Proxy retornou erro: ${response.status}`);
      }

      const data = await response.json();

      if (data && data.items && data.items.length > 0) {
        console.log(`[BUSCA V10] ✅ ${data.items.length} produtos encontrados via Cloudflare`);
        
        const formattedProducts: Product[] = data.items
          .filter((item: any) => item != null) // Remove items null/undefined
          .map((item: any) => {
            // Lógica de segurança para encontrar os dados do item
            const itemBasic = item.item_basic || item;
            const ratingInfo = itemBasic?.item_rating || {};
            
            const price = (itemBasic?.price || 0) / 100000;
            const soldCount = itemBasic?.historical_sold || itemBasic?.sold || 0;
            
            return {
              id: itemBasic?.itemid?.toString() || `shopee-${Math.random()}`,
              title: itemBasic?.name || 'Produto Shopee',
              description: itemBasic?.name || '',
              price: price,
              originalPrice: price * 1.2,
              imageUrl: itemBasic?.image 
                ? `https://cf.shopee.com.br/file/${itemBasic.image}`
                : 'https://via.placeholder.com/200',
              affiliateLink: `https://shopee.com.br/product/${itemBasic?.shopid || '0'}/${itemBasic?.itemid || '0'}`,
              marketplace: 'shopee',
              category: '📱 Eletrônicos',
              rating: ratingInfo?.rating_star || 4.5,
              reviews: soldCount,
              sales: soldCount,
              commission: price * 0.1,
              commissionPercent: 10,
              createdAt: new Date(),
              bsr: 0,
              bsrCategory: 'Electronics'
            };
          });

        setShopeeProducts(formattedProducts);
      } else {
        console.log('[BUSCA V10] Nenhum produto encontrado');
        setError('Nenhum produto encontrado para esta busca.');
        setShopeeProducts([]);
      }
    } catch (error) {
      console.error('[BUSCA V10] ❌ Erro:', error);
      setError(error instanceof Error ? error.message : 'Não foi possível buscar produtos. Tente novamente.');
      setShopeeProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const formatSold = (sold: number = 0) => {
    if (sold >= 1000) {
      return `${(sold / 1000).toFixed(1)}k vendidos`;
    }
    return `${sold} vendidos`;
  };

  const categories = [
    { icon: '📱', name: 'Eletrônicos', query: 'eletrônicos' },
    { icon: '💻', name: 'Notebooks', query: 'notebook' },
    { icon: '🎧', name: 'Fones', query: 'fone' },
    { icon: '📺', name: 'Smart TV', query: 'tv' },
    { icon: '🏠', name: 'Casa', query: 'casa' },
    { icon: '👕', name: 'Moda', query: 'moda' },
    { icon: '💄', name: 'Beleza', query: 'beleza' },
    { icon: '⚽', name: 'Esportes', query: 'esporte' }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                Voltar
              </button>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <ShoppingBag className="w-6 h-6" />
                Buscar Produtos
              </h1>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-card border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-4 py-4">
            <button
              onClick={() => setActiveTab('shopee')}
              className={`px-6 py-2 rounded-md font-medium transition-all ${
                activeTab === 'shopee'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Shopee
            </button>
            <button
              onClick={() => setActiveTab('lomadee')}
              className={`px-6 py-2 rounded-md font-medium transition-all ${
                activeTab === 'lomadee'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Lomadee
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'shopee' && (
          <div className="space-y-6">
            {/* Categories */}
            <div className="bg-card rounded-lg shadow-sm p-6 border">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Categorias Populares
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                {categories.map((cat) => (
                  <button
                    key={cat.name}
                    onClick={() => fetchShopeeProducts(cat.query)}
                    className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-accent transition-colors group"
                  >
                    <span className="text-3xl">{cat.icon}</span>
                    <span className="text-sm text-foreground group-hover:text-orange-600 font-medium">
                      {cat.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Search */}
            <div className="bg-card rounded-lg shadow-sm p-6 border">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Buscar produtos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && fetchShopeeProducts(searchTerm)}
                    className="w-full pl-10 pr-4 py-3 border border-input bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <button
                  onClick={() => fetchShopeeProducts(searchTerm)}
                  disabled={isLoading}
                  className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-400 transition-colors flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Buscando...
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5" />
                      Buscar
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Loading */}
            {isLoading && (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              </div>
            )}

            {/* Products Grid */}
            {!isLoading && shopeeProducts.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {shopeeProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}

            {/* Empty State */}
            {!isLoading && shopeeProducts.length === 0 && (
              <div className="bg-card rounded-lg shadow-sm p-12 text-center border">
                <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-lg">
                  Nenhum produto encontrado. Tente outra busca!
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'lomadee' && (
          <div className="space-y-6">
            {/* Loading */}
            {isLoading && (
              <div className="flex flex-col justify-center items-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
                <p className="text-muted-foreground">Carregando ofertas reais...</p>
              </div>
            )}

            {/* Error */}
            {error && !isLoading && (
              <div className="bg-destructive/10 border border-destructive rounded-lg p-6 text-center">
                <p className="text-destructive font-medium">{error}</p>
                <button
                  onClick={fetchLomadeeProducts}
                  className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {/* Banner IA Marketing */}
            {!isLoading && !error && lomadeeProducts.length > 0 && (
              <div className="sticky top-0 z-10 mb-8 p-6 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl shadow-2xl border-2 border-purple-400">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <p className="text-center md:text-left text-lg font-semibold text-white">
                    💡 Já escolheu seu produto? Copie o link e use nossa ferramenta de IA para criar posts virais!
                  </p>
                  <button
                    onClick={() => navigate('/ia-marketing')}
                    className="whitespace-nowrap px-8 py-3 bg-white text-purple-600 rounded-lg font-bold hover:bg-purple-50 transition-colors shadow-lg hover:shadow-xl"
                  >
                    USAR IA MARKETING ➡️
                  </button>
                </div>
              </div>
            )}

            {/* Contador de Lojas */}
            {!isLoading && !error && lomadeeProducts.length > 0 && (
              <div className="mb-6">
                <p className="text-center text-lg font-semibold text-gray-700 dark:text-gray-300">
                  Exibindo <span className="text-green-600 dark:text-green-400 font-bold">{lomadeeProducts.length}</span> lojas com as melhores comissões
                </p>
              </div>
            )}

            {/* Products Grid - Cards de Lojas Clicáveis */}
            {!isLoading && !error && lomadeeProducts.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {lomadeeProducts.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => {
                      setSelectedStore({
                        name: product.title,
                        logo: product.imageUrl,
                        commission: `até ${product.commissionPercent}%`
                      });
                      setIsStoreModalOpen(true);
                    }}
                    className="cursor-pointer"
                  >
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && lomadeeProducts.length === 0 && (
              <div className="bg-card rounded-lg shadow-sm p-12 text-center border">
                <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-lg">
                  Nenhuma oferta disponível no momento
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Produtos da Loja */}
      <LomadeeStoreModal
        store={selectedStore}
        open={isStoreModalOpen}
        onClose={() => {
          setIsStoreModalOpen(false);
          setSelectedStore(null);
        }}
      />
    </div>
  );
};

export default ProductsPage;