import React, { useState, useEffect } from 'react';
import { Search, ShoppingBag, Loader2, AlertCircle, TrendingUp, Star, Package } from 'lucide-react';
import { toast } from 'sonner';

interface Product {
  itemid: number;
  shopid: number;
  name: string;
  image: string;
  price: number;
  price_min?: number;
  price_max?: number;
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
  const [sortBy, setSortBy] = useState('relevancia');

  // Categorias populares para busca rápida
  const categoriasPopulares = [
    { nome: '📱 Celulares', termo: 'celular smartphone' },
    { nome: '💻 Notebooks', termo: 'notebook laptop' },
    { nome: '🎧 Fones', termo: 'fone bluetooth airpods' },
    { nome: '⌚ Smartwatch', termo: 'smartwatch relógio inteligente' },
    { nome: '👟 Tênis', termo: 'tênis esportivo' },
    { nome: '💄 Beleza', termo: 'maquiagem perfume' },
    { nome: '🎮 Games', termo: 'playstation xbox nintendo' },
    { nome: '🏠 Casa', termo: 'decoração casa cozinha' }
  ];

  // Carrega produtos populares ao iniciar
  useEffect(() => {
    const termosPopolares = [
      'eletrônicos',
      'celular',
      'notebook',
      'fone bluetooth',
      'smartwatch',
      'tênis',
      'perfume',
      'maquiagem'
    ];
    
    const termoAleatorio = termosPopolares[Math.floor(Math.random() * termosPopolares.length)];
    searchShopeeProducts(termoAleatorio);
  }, []);

  // SISTEMA HÍBRIDO: Tenta múltiplos métodos até funcionar
  const searchShopeeProducts = async (query: string) => {
    console.log('🔍 Iniciando busca por:', query);
    console.log('📡 Tentando buscar dados reais da Shopee...');
    
    setLoading(true);
    setError('');
    setProducts([]);

    try {
      // MÉTODO 1: Tenta buscar via PROXY CORS (mais confiável)
      const corsProxies = [
        'https://api.codetabs.com/v1/proxy?quest=',
        'https://corsproxy.io/?',
        'https://api.allorigins.win/raw?url=',
        'https://cors-anywhere.herokuapp.com/',
        'https://thingproxy.freeboard.io/fetch/'
      ];
      
      // URL da API pública da Shopee
      const shopeeApiUrl = `https://shopee.com.br/api/v4/search/search_items?by=relevancy&keyword=${encodeURIComponent(query)}&limit=20&newest=0&order=desc&page_type=search&scenario=PAGE_GLOBAL_SEARCH&version=2`;
      
      let dataFetched = false;
      
      // Tenta cada proxy até funcionar
      for (const proxy of corsProxies) {
        try {
          console.log(`📡 Tentando proxy: ${proxy}`);
          const response = await fetch(`${proxy}${encodeURIComponent(shopeeApiUrl)}`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('✅ Resposta da Shopee:', data);
            
            // Verifica se tem produtos
            if (data && data.items && data.items.length > 0) {
              const formattedProducts = data.items.map((item: any) => {
                // Extrai os dados corretos da estrutura da Shopee
                const itemBasic = item.item_basic || item;
                return {
                  itemid: itemBasic.itemid,
                  shopid: itemBasic.shopid,
                  name: itemBasic.name,
                  image: itemBasic.image ? `https://cf.shopee.com.br/file/${itemBasic.image}` : 'https://via.placeholder.com/200',
                  price: itemBasic.price ? itemBasic.price / 100000 : itemBasic.price_min / 100000,
                  price_min: itemBasic.price_min ? itemBasic.price_min / 100000 : 0,
                  price_max: itemBasic.price_max ? itemBasic.price_max / 100000 : 0,
                  sold: itemBasic.historical_sold || itemBasic.sold || 0,
                  shop_location: itemBasic.shop_location || 'Brasil',
                  rating_star: itemBasic.item_rating?.rating_star || 0,
                  discount: itemBasic.raw_discount ? `${itemBasic.raw_discount}%` : null
                };
              });
              
              setProducts(formattedProducts);
              toast.success(`🎉 ${formattedProducts.length} produtos REAIS encontrados!`);
              dataFetched = true;
              break; // Sucesso! Para de tentar outros proxies
            }
          }
        } catch (proxyError) {
          console.error(`❌ Erro com proxy ${proxy}:`, proxyError);
          continue; // Tenta o próximo proxy
        }
      }
      
      // MÉTODO 2: FALLBACK via Edge Function (se proxies falharam)
      if (!dataFetched) {
        console.log('⚠️ Proxies falharam, tentando Edge Function...');
        
        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/buscar-produtos-shopee`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
              },
              body: JSON.stringify({
                searchTerm: query,
                limit: 20
              })
            }
          );

          if (response.ok) {
            const data = await response.json();
            console.log('✅ Produtos da Edge Function:', data);
            
            if (data.products && data.products.length > 0) {
              const formattedProducts = data.products.map((item: any) => ({
                itemid: item.itemid || item.item_id,
                shopid: item.shopid || item.shop_id,
                name: item.name || item.title,
                image: item.image || item.image_url || 'https://via.placeholder.com/200',
                price: item.price || item.price_min || 99.90,
                price_min: item.price_min || item.price,
                price_max: item.price_max || item.price,
                sold: item.sold || item.historical_sold || 0,
                shop_location: item.location || item.shop_location || 'Brasil',
                rating_star: item.rating || item.rating_star || 4.5,
                discount: item.discount || null
              }));
              
              setProducts(formattedProducts);
              toast.success(`✅ ${formattedProducts.length} produtos encontrados via API!`);
              dataFetched = true;
            }
          }
        } catch (edgeFunctionError) {
          console.error('❌ Edge Function também falhou:', edgeFunctionError);
        }
      }
      
      // MÉTODO 3: JSONP como backup adicional
      if (!dataFetched) {
        console.log('🔄 Tentando JSONP...');
        try {
          const jsonpData = await searchViaJSONP(query);
          if (jsonpData && jsonpData.items && jsonpData.items.length > 0) {
            const formattedProducts = jsonpData.items.map((item: any) => {
              const itemBasic = item.item_basic || item;
              return {
                itemid: itemBasic.itemid,
                shopid: itemBasic.shopid,
                name: itemBasic.name,
                image: itemBasic.image ? `https://cf.shopee.com.br/file/${itemBasic.image}` : 'https://via.placeholder.com/200',
                price: itemBasic.price ? itemBasic.price / 100000 : itemBasic.price_min / 100000,
                sold: itemBasic.historical_sold || itemBasic.sold || 0,
                shop_location: itemBasic.shop_location || 'Brasil',
                rating_star: itemBasic.item_rating?.rating_star || 0,
                discount: itemBasic.raw_discount ? `${itemBasic.raw_discount}%` : null
              };
            });
            setProducts(formattedProducts);
            toast.success(`🎉 ${formattedProducts.length} produtos via JSONP!`);
            dataFetched = true;
          }
        } catch (jsonpError) {
          console.error('❌ JSONP falhou:', jsonpError);
        }
      }
      
      // ÚLTIMO RECURSO: Dados mock para demonstração
      if (!dataFetched) {
        console.log('📦 Usando dados de demonstração...');
        setError('Não foi possível buscar dados reais. Mostrando produtos de exemplo.');
        setProducts(getMockProducts(query));
        toast.info('Mostrando produtos de exemplo');
      }
      
    } catch (error) {
      console.error('❌ Erro geral na busca:', error);
      setError('Erro ao buscar produtos. Mostrando resultados de exemplo.');
      setProducts(getMockProducts(query));
      toast.error('Erro na busca, mostrando exemplos');
    } finally {
      setLoading(false);
    }
  };

  // Função auxiliar para busca via JSONP (backup)
  const searchViaJSONP = (query: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      const callbackName = `shopeeCallback_${Date.now()}`;
      const script = document.createElement('script');
      
      // Define callback global
      (window as any)[callbackName] = (data: any) => {
        delete (window as any)[callbackName];
        document.body.removeChild(script);
        resolve(data);
      };
      
      // URL com callback JSONP
      script.src = `https://shopee.com.br/api/v4/search/search_items?by=relevancy&keyword=${encodeURIComponent(query)}&limit=20&newest=0&order=desc&callback=${callbackName}`;
      
      script.onerror = () => {
        delete (window as any)[callbackName];
        document.body.removeChild(script);
        reject(new Error('JSONP failed'));
      };
      
      document.body.appendChild(script);
      
      // Timeout de 5 segundos
      setTimeout(() => {
        if ((window as any)[callbackName]) {
          delete (window as any)[callbackName];
          document.body.removeChild(script);
          reject(new Error('JSONP timeout'));
        }
      }, 5000);
    });
  };

  // DADOS MOCK (FALLBACK)
  const getMockProducts = (query: string): Product[] => [
    {
      itemid: Date.now(),
      shopid: Math.floor(Math.random() * 1000000),
      name: `${query} - Produto Premium Oferta Especial`,
      price: 89.90,
      image: `https://via.placeholder.com/300x300/FF6B35/FFFFFF?text=${encodeURIComponent(query)}`,
      sold: 1523,
      rating_star: 4.8,
      shop_location: 'São Paulo',
      discount: '15%'
    },
    {
      itemid: Date.now() + 1,
      shopid: Math.floor(Math.random() * 1000000),
      name: `${query} - Kit Completo com Frete Grátis`,
      price: 129.90,
      image: `https://via.placeholder.com/300x300/FF6B35/FFFFFF?text=${encodeURIComponent(query + ' 2')}`,
      sold: 892,
      rating_star: 4.6,
      shop_location: 'Rio de Janeiro',
      discount: '20%'
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
            🛍️ Produtos em Destaque
          </h1>
          <p className="text-gray-600 text-lg mb-1">
            Encontre as melhores ofertas e ganhe comissões como afiliado!
          </p>
          <p className="text-sm text-gray-500">
            Produtos atualizados em tempo real • Clique para gerar seu link de afiliado
          </p>
        </div>

        {/* Categorias Populares */}
        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-3 font-medium">Busque por categoria:</p>
          <div className="flex flex-wrap gap-2">
            {categoriasPopulares.map((cat) => (
              <button
                key={cat.termo}
                onClick={() => {
                  setSearchTerm(cat.termo);
                  searchShopeeProducts(cat.termo);
                }}
                className="px-4 py-2 bg-white border border-orange-300 text-orange-600 rounded-full hover:bg-orange-50 transition-colors text-sm font-medium"
              >
                {cat.nome}
              </button>
            ))}
          </div>
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

        {/* Filtros e Ordenação */}
        {products.length > 0 && (
          <div className="flex justify-between items-center mb-6">
            <p className="text-gray-600 font-medium">
              {products.length} produtos encontrados
            </p>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                const sorted = [...products].sort((a, b) => {
                  switch(e.target.value) {
                    case 'preco_menor': return a.price - b.price;
                    case 'preco_maior': return b.price - a.price;
                    case 'mais_vendidos': return b.sold - a.sold;
                    case 'melhor_avaliados': return b.rating_star - a.rating_star;
                    default: return 0;
                  }
                });
                setProducts(sorted);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="relevancia">Relevância</option>
              <option value="preco_menor">Menor Preço</option>
              <option value="preco_maior">Maior Preço</option>
              <option value="mais_vendidos">Mais Vendidos</option>
              <option value="melhor_avaliados">Melhor Avaliados</option>
            </select>
          </div>
        )}

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
