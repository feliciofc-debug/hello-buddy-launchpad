import React, { useState } from 'react';
import { Search, ShoppingBag, Loader2, AlertCircle, TrendingUp, Star, Package } from 'lucide-react';
import { toast } from 'sonner';

interface Product {
  itemid: number;
  shopid: number;
  name: string;
  image: string;
  price: number;
  sold: number;
  location: string;
  rating: number;
  discount?: string;
  affiliate_link?: string;
}

const ShopeeSearchComponent: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatingLinks, setGeneratingLinks] = useState<Set<string>>(new Set());

  // MÉTODO DE BUSCA - SEM SCRAPERAPI
  const searchShopeeProducts = async (query: string) => {
    setLoading(true);
    setError('');
    setProducts([]);

    try {
      // MÉTODO 1: Tenta API direta do navegador
      const response = await fetch(
        `https://shopee.com.br/api/v4/search/search_items?by=relevancy&keyword=${encodeURIComponent(query)}&limit=20`,
        {
          method: 'GET',
          mode: 'no-cors', // IMPORTANTE: permite requisição cross-origin
        }
      );
      
      // Como no-cors não permite ler a resposta, vamos direto para o fallback
      throw new Error('no-cors mode');
    } catch (error) {
      // MÉTODO 2: Usar proxy CORS gratuito como fallback
      try {
        const proxyUrl = 'https://api.allorigins.win/raw?url=';
        const shopeeUrl = `https://shopee.com.br/api/v4/search/search_items?keyword=${encodeURIComponent(query)}&limit=20`;
        const response = await fetch(proxyUrl + encodeURIComponent(shopeeUrl));
        
        if (response.ok) {
          const data = await response.json();
          if (data.items && data.items.length > 0) {
            const formattedProducts = data.items.map((item: any) => ({
              itemid: item.itemid || item.item_basic?.itemid,
              shopid: item.shopid || item.item_basic?.shopid,
              name: item.name || item.item_basic?.name,
              image: `https://cf.shopee.com.br/file/${item.image || item.item_basic?.image}`,
              price: (item.price || item.item_basic?.price) / 100000,
              sold: item.historical_sold || item.item_basic?.sold || 0,
              location: item.shop_location || 'Brasil',
              rating: item.item_rating?.rating_star || 4.5,
              discount: item.raw_discount ? `${item.raw_discount}%` : undefined
            }));
            
            setProducts(formattedProducts);
            toast.success(`${formattedProducts.length} produtos encontrados!`);
            setLoading(false);
            return;
          }
        }
      } catch (proxyError) {
        console.log('Proxy falhou, usando dados mock');
      }
      
      // MÉTODO 3: Se tudo falhar, usar dados MOCK
      const mockProducts = getMockProducts(query);
      setProducts(mockProducts);
      setError('Mostrando produtos de exemplo. Configure suas credenciais para resultados reais.');
      toast.info('Modo demonstração ativado');
    } finally {
      setLoading(false);
    }
  };

  // DADOS MOCK (IMPORTANTE - sempre ter fallback)
  const getMockProducts = (query: string): Product[] => [
    {
      itemid: Date.now(),
      shopid: Math.floor(Math.random() * 1000000),
      name: `${query} - Produto Premium Oferta Especial`,
      price: 89.90,
      image: `https://via.placeholder.com/300x300/FF6B35/FFFFFF?text=${encodeURIComponent(query)}`,
      sold: 1523,
      rating: 4.8,
      location: 'São Paulo',
      discount: '15%'
    },
    {
      itemid: Date.now() + 1,
      shopid: Math.floor(Math.random() * 1000000),
      name: `${query} - Kit Completo com Frete Grátis`,
      price: 129.90,
      image: `https://via.placeholder.com/300x300/FF6B35/FFFFFF?text=${encodeURIComponent(query + ' 2')}`,
      sold: 892,
      rating: 4.6,
      location: 'Rio de Janeiro',
      discount: '20%'
    },
    {
      itemid: Date.now() + 2,
      shopid: Math.floor(Math.random() * 1000000),
      name: `${query} - Mais Vendido da Categoria`,
      price: 59.90,
      image: `https://via.placeholder.com/300x300/FF6B35/FFFFFF?text=${encodeURIComponent(query + ' 3')}`,
      sold: 3421,
      rating: 4.9,
      location: 'Minas Gerais',
      discount: '10%'
    },
    {
      itemid: Date.now() + 3,
      shopid: Math.floor(Math.random() * 1000000),
      name: `${query} - Edição Limitada Super Desconto`,
      price: 199.90,
      image: `https://via.placeholder.com/300x300/FF6B35/FFFFFF?text=${encodeURIComponent(query + ' 4')}`,
      sold: 645,
      rating: 4.7,
      location: 'Santa Catarina',
      discount: '25%'
    }
  ];

  // Gerar link de afiliado usando Edge Function do Supabase
  const generateAffiliateLink = async (product: Product) => {
    const key = `${product.itemid}-${product.shopid}`;
    setGeneratingLinks(prev => new Set([...prev, key]));

    try {
      // USA A EDGE FUNCTION DO SUPABASE JÁ EXISTENTE
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-shopee-affiliate-link`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            itemid: product.itemid,
            shopid: product.shopid,
            productName: product.name
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        product.affiliate_link = data.affiliateLink;
        setProducts([...products]);
        toast.success('Link de afiliado gerado!');
      } else {
        // Fallback: link direto sem tracking
        product.affiliate_link = `https://shopee.com.br/product/${product.shopid}/${product.itemid}`;
        setProducts([...products]);
        toast.info('Link direto gerado');
      }
    } catch (error) {
      console.error('Erro ao gerar link:', error);
      // Em caso de erro, gera link direto
      product.affiliate_link = `https://shopee.com.br/product/${product.shopid}/${product.itemid}`;
      setProducts([...products]);
      toast.info('Link direto gerado');
    } finally {
      setGeneratingLinks(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
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
            🛍️ Busca de Produtos Shopee
          </h1>
          <p className="text-gray-600">
            Encontre produtos incríveis e gere seus links de afiliado
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
                  onKeyPress={(e) => e.key === 'Enter' && searchTerm && searchShopeeProducts(searchTerm)}
                  placeholder="Digite o produto que você procura..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
            <button
              onClick={() => searchTerm && searchShopeeProducts(searchTerm)}
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
              const key = `${product.itemid}`;
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
                        (e.target as HTMLImageElement).src = `https://via.placeholder.com/300x300/FF6B35/FFFFFF?text=Produto`;
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
                        <span className="text-gray-600">{product.rating.toFixed(1)}</span>
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
                    </div>

                    {/* Location */}
                    <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
                      <Package size={14} />
                      <span>{product.location}</span>
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
        {!loading && products.length === 0 && (
          <div className="text-center py-12">
            <ShoppingBag className="mx-auto text-gray-300 mb-4" size={64} />
            <p className="text-gray-500 text-lg">
              Digite um produto e clique em Buscar para começar!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShopeeSearchComponent;
