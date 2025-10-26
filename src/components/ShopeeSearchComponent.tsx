import React, { useState } from 'react';
import { Search, ShoppingBag, Loader2, AlertCircle, TrendingUp, Star, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Product {
  itemid: number;
  shopid: number;
  name: string;
  image: string;
  price: number;
  price_min: number;
  price_max: number;
  sold: number;
  shop_location: string;
  rating_star: number;
  discount?: string;
  affiliate_link?: string;
}

const ShopeeSearchComponent: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatingLinks, setGeneratingLinks] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Função para buscar produtos diretamente do cliente (sem proxy, sem custos!)
  const searchShopeeProducts = async (query: string) => {
    setLoading(true);
    setError('');
    setProducts([]);

    try {
      // Primeiro, tentamos a API pública da Shopee diretamente do navegador
      const searchUrl = `https://shopee.com.br/api/v4/search/search_items?by=relevancy&keyword=${encodeURIComponent(query)}&limit=20&newest=0&order=desc&page_type=search&scenario=PAGE_GLOBAL_SEARCH&version=2`;
      
      // Headers que simulam uma requisição de navegador real
      const headers = {
        'Accept': 'application/json',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'Referer': 'https://shopee.com.br/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      };

      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: headers,
        mode: 'cors',
        credentials: 'omit'
      });

      if (!response.ok) {
        // Se a API direta não funcionar, usamos o fallback com CORS proxy gratuito
        return await searchWithCorsProxy(query);
      }

      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        const formattedProducts = data.items.map((item: any) => ({
          itemid: item.itemid || item.item_basic?.itemid,
          shopid: item.shopid || item.item_basic?.shopid,
          name: item.name || item.item_basic?.name,
          image: `https://cf.shopee.com.br/file/${item.image || item.item_basic?.image}`,
          price: (item.price || item.item_basic?.price) / 100000,
          price_min: (item.price_min || item.item_basic?.price_min) / 100000,
          price_max: (item.price_max || item.item_basic?.price_max) / 100000,
          sold: item.historical_sold || item.item_basic?.sold,
          shop_location: item.shop_location || item.item_basic?.shop_location || 'Brasil',
          rating_star: item.item_rating?.rating_star || item.item_basic?.item_rating?.rating_star || 0,
          discount: item.raw_discount ? `${item.raw_discount}%` : undefined
        }));
        
        setProducts(formattedProducts);
        toast({
          title: "Produtos encontrados!",
          description: `${formattedProducts.length} produtos carregados`,
        });
      }
    } catch (err) {
      // Fallback para proxy CORS gratuito
      await searchWithCorsProxy(query);
    } finally {
      setLoading(false);
    }
  };

  // Fallback usando proxy CORS gratuito (AllOrigins, cors-anywhere alternativas)
  const searchWithCorsProxy = async (query: string) => {
    try {
      // Lista de proxies CORS gratuitos para fazer rotação
      const corsProxies = [
        'https://api.allorigins.win/raw?url=',
        'https://cors-proxy.htmldriven.com/?url=',
        'https://thingproxy.freeboard.io/fetch/',
      ];

      const shopeeUrl = `https://shopee.com.br/api/v4/search/search_items?by=relevancy&keyword=${encodeURIComponent(query)}&limit=20&newest=0&order=desc&page_type=search`;
      
      for (const proxy of corsProxies) {
        try {
          const response = await fetch(`${proxy}${encodeURIComponent(shopeeUrl)}`);
          if (response.ok) {
            const data = await response.json();
            if (data.items) {
              const formattedProducts = data.items.slice(0, 12).map((item: any) => ({
                itemid: item.itemid || item.item_basic?.itemid,
                shopid: item.shopid || item.item_basic?.shopid,
                name: item.name || item.item_basic?.name,
                image: `https://cf.shopee.com.br/file/${item.image || item.item_basic?.image}`,
                price: (item.price || item.item_basic?.price) / 100000,
                price_min: (item.price_min || item.item_basic?.price_min) / 100000,
                price_max: (item.price_max || item.item_basic?.price_max) / 100000,
                sold: item.historical_sold || item.item_basic?.sold,
                shop_location: item.shop_location || 'Brasil',
                rating_star: item.item_rating?.rating_star || 0,
                discount: item.raw_discount ? `${item.raw_discount}%` : undefined
              }));
              
              setProducts(formattedProducts);
              toast({
                title: "Produtos encontrados (via proxy)",
                description: `${formattedProducts.length} produtos carregados`,
              });
              return;
            }
          }
        } catch {
          continue;
        }
      }
      
      // Se todos os proxies falharem, usa dados mock para demonstração
      setError('Usando modo demonstração. Configure credenciais para links de afiliado.');
      setProducts(getMockProducts(query));
      toast({
        title: "Modo demonstração",
        description: "Mostrando produtos de exemplo",
        variant: "default"
      });
    } catch (err) {
      setError('Erro ao buscar produtos. Mostrando resultados de exemplo.');
      setProducts(getMockProducts(query));
    }
  };

  // Função para gerar link de afiliado (chama Edge Function segura)
  const generateAffiliateLink = async (product: Product) => {
    const key = `${product.itemid}-${product.shopid}`;
    setGeneratingLinks(prev => new Set([...prev, key]));

    try {
      const { data, error } = await supabase.functions.invoke('generate-shopee-affiliate-link', {
        body: {
          itemid: product.itemid,
          shopid: product.shopid,
          productName: product.name
        }
      });

      if (error) {
        console.error('Erro ao gerar link:', error);
        // Fallback: gera link direto sem tracking
        product.affiliate_link = `https://shopee.com.br/product/${product.shopid}/${product.itemid}`;
        toast({
          title: "Link direto gerado",
          description: "Link sem tracking de afiliado",
          variant: "default"
        });
      } else {
        product.affiliate_link = data.affiliateLink;
        toast({
          title: "Link de afiliado gerado!",
          description: "Pronto para compartilhar",
        });
      }
      
      setProducts([...products]);
    } catch (err) {
      console.error('Erro:', err);
      // Fallback para desenvolvimento
      product.affiliate_link = `https://shopee.com.br/product/${product.shopid}/${product.itemid}`;
      setProducts([...products]);
      toast({
        title: "Link direto gerado",
        description: "Link sem tracking de afiliado",
        variant: "default"
      });
    } finally {
      setGeneratingLinks(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  // Dados mock para fallback/demonstração
  const getMockProducts = (query: string): Product[] => {
    return [
      {
        itemid: 1234567890,
        shopid: 987654321,
        name: `${query} - Produto Premium com Frete Grátis`,
        image: 'https://via.placeholder.com/200',
        price: 89.90,
        price_min: 79.90,
        price_max: 99.90,
        sold: 1523,
        shop_location: 'São Paulo',
        rating_star: 4.8,
        discount: '15%'
      },
      {
        itemid: 2345678901,
        shopid: 876543210,
        name: `${query} - Oferta Especial Limitada`,
        image: 'https://via.placeholder.com/200',
        price: 129.90,
        price_min: 119.90,
        price_max: 139.90,
        sold: 892,
        shop_location: 'Rio de Janeiro',
        rating_star: 4.6,
        discount: '20%'
      },
      {
        itemid: 3456789012,
        shopid: 765432109,
        name: `${query} - Mais Vendido da Categoria`,
        image: 'https://via.placeholder.com/200',
        price: 59.90,
        price_min: 49.90,
        price_max: 69.90,
        sold: 3421,
        shop_location: 'Minas Gerais',
        rating_star: 4.9,
        discount: '10%'
      }
    ];
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const formatSold = (sold: number) => {
    if (sold >= 1000) {
      return `${(sold / 1000).toFixed(1)}k vendidos`;
    }
    return `${sold} vendidos`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🛍️ Shopee Affiliate Search
          </h1>
          <p className="text-gray-600">
            Busque produtos e gere links de afiliado - 100% Grátis, Sem APIs Pagas!
          </p>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchShopeeProducts(searchTerm)}
                  placeholder="Busque produtos na Shopee..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
            <button
              onClick={() => searchShopeeProducts(searchTerm)}
              disabled={loading || !searchTerm}
              className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Buscando...
                </>
              ) : (
                <>
                  <Search size={20} />
                  Buscar
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="text-yellow-600 mt-0.5" size={20} />
              <div>
                <p className="text-yellow-800 font-medium">Modo Demonstração</p>
                <p className="text-yellow-700 text-sm">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Products Grid */}
        {products.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => {
              const key = `${product.itemid}-${product.shopid}`;
              const isGenerating = generatingLinks.has(key);
              
              return (
                <div key={key} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                  {/* Product Image */}
                  <div className="relative h-48 bg-gray-100">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200?text=Produto';
                      }}
                    />
                    {product.discount && (
                      <span className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded-md text-sm font-bold">
                        -{product.discount}
                      </span>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="p-4">
                    <h3 className="font-medium text-gray-800 mb-2 line-clamp-2 min-h-[48px]">
                      {product.name}
                    </h3>

                    {/* Rating and Sales */}
                    <div className="flex items-center gap-4 mb-3 text-sm">
                      <div className="flex items-center gap-1">
                        <Star className="text-yellow-400 fill-current" size={16} />
                        <span className="text-gray-600">{product.rating_star.toFixed(1)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="text-green-500" size={16} />
                        <span className="text-gray-600">{formatSold(product.sold)}</span>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="mb-3">
                      <p className="text-2xl font-bold text-orange-500">
                        {formatPrice(product.price)}
                      </p>
                      {product.price_min !== product.price_max && (
                        <p className="text-xs text-gray-500">
                          {formatPrice(product.price_min)} - {formatPrice(product.price_max)}
                        </p>
                      )}
                    </div>

                    {/* Location */}
                    <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
                      <Package size={14} />
                      <span>{product.shop_location}</span>
                    </div>

                    {/* Action Button */}
                    {product.affiliate_link ? (
                      <a
                        href={product.affiliate_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full py-2 bg-green-500 text-white text-center rounded-lg hover:bg-green-600 transition-colors"
                      >
                        🔗 Abrir Link de Afiliado
                      </a>
                    ) : (
                      <button
                        onClick={() => generateAffiliateLink(product)}
                        disabled={isGenerating}
                        className="w-full py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300 transition-colors flex items-center justify-center gap-2"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="animate-spin" size={16} />
                            Gerando...
                          </>
                        ) : (
                          <>
                            <ShoppingBag size={16} />
                            Gerar Link Afiliado
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!loading && products.length === 0 && searchTerm && (
          <div className="text-center py-12">
            <ShoppingBag className="mx-auto text-gray-300 mb-4" size={64} />
            <p className="text-gray-500 text-lg">
              Faça uma busca para encontrar produtos incríveis!
            </p>
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-12 text-center text-sm text-gray-600">
          <p>💡 Esta solução usa busca híbrida client-side</p>
          <p>✅ Sem custos com APIs de scraping</p>
          <p>🔒 Credenciais de afiliado protegidas no servidor</p>
        </div>
      </div>
    </div>
  );
};

export default ShopeeSearchComponent;
