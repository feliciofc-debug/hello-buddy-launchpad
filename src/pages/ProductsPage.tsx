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
import type { Product } from '@/data/mockData';

const ProductsPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('shopee');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [shopeeProducts, setShopeeProducts] = useState<Product[]>([]);
  const [lomadeeProducts, setLomadeeProducts] = useState<Product[]>([]);
  const [error, setError] = useState('');

  // Produtos de exemplo convertidos para o formato do ProductCard
  const exampleProducts: Product[] = [
    {
      id: '1',
      title: 'iPhone 15 Pro Max 256GB - Titânio Natural',
      description: 'O iPhone mais avançado com chip A17 Pro e câmera de 48MP',
      price: 8999.90,
      originalPrice: 10999.90,
      imageUrl: 'https://images.unsplash.com/photo-1696446701796-da61225697cc?w=400',
      affiliateLink: 'https://shopee.com.br/iphone-15-pro',
      marketplace: 'shopee',
      category: '📱 Eletrônicos',
      rating: 4.9,
      reviews: 1523,
      sales: 1523,
      commission: 899.99,
      commissionPercent: 10,
      badge: '⭐ TOP VENDAS',
      createdAt: new Date('2024-09-15'),
      bsr: 10,
      bsrCategory: 'Electronics'
    },
    {
      id: '2',
      title: 'Notebook Gamer Dell G15 RTX 4060',
      description: 'Notebook gamer com RTX 4060, 16GB RAM e SSD 512GB',
      price: 6499.90,
      originalPrice: 7999.90,
      imageUrl: 'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=400',
      affiliateLink: 'https://shopee.com.br/notebook-gamer',
      marketplace: 'shopee',
      category: '📱 Eletrônicos',
      rating: 4.8,
      reviews: 892,
      sales: 892,
      commission: 649.99,
      commissionPercent: 10,
      badge: '📈 EM ALTA',
      createdAt: new Date('2024-09-20'),
      bsr: 25,
      bsrCategory: 'Electronics'
    },
    {
      id: '3',
      title: 'Sony WH-1000XM5 - Fone com Cancelamento de Ruído',
      description: 'Fone premium com cancelamento de ruído de última geração',
      price: 2199.90,
      originalPrice: 2699.90,
      imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400',
      affiliateLink: 'https://shopee.com.br/fone-sony',
      marketplace: 'shopee',
      category: '📱 Eletrônicos',
      rating: 4.9,
      reviews: 3421,
      sales: 3421,
      commission: 219.99,
      commissionPercent: 10,
      badge: '⭐ TOP VENDAS',
      createdAt: new Date('2024-08-10'),
      bsr: 5,
      bsrCategory: 'Electronics'
    },
    {
      id: '4',
      title: 'Smart TV Samsung Neo QLED 55" 4K',
      description: 'Smart TV com tecnologia Neo QLED e resolução 4K',
      price: 3799.90,
      originalPrice: 4999.90,
      imageUrl: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=400',
      affiliateLink: 'https://shopee.com.br/smart-tv',
      marketplace: 'shopee',
      category: '📱 Eletrônicos',
      rating: 4.7,
      reviews: 567,
      sales: 567,
      commission: 379.99,
      commissionPercent: 10,
      createdAt: new Date('2024-09-01'),
      bsr: 50,
      bsrCategory: 'Electronics'
    },
    {
      id: '5',
      title: 'iPad Pro M2 12.9" 128GB Wi-Fi',
      description: 'iPad Pro com chip M2 e tela Liquid Retina XDR',
      price: 9499.90,
      originalPrice: 11999.90,
      imageUrl: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400',
      affiliateLink: 'https://shopee.com.br/ipad-pro',
      marketplace: 'shopee',
      category: '📱 Eletrônicos',
      rating: 5.0,
      reviews: 234,
      sales: 234,
      commission: 949.99,
      commissionPercent: 10,
      badge: '🔥 LANÇAMENTO',
      createdAt: new Date('2024-10-10'),
      bsr: 15,
      bsrCategory: 'Electronics'
    },
    {
      id: '6',
      title: 'Air Fryer Philco 12L Digital',
      description: 'Fritadeira elétrica sem óleo com capacidade de 12 litros',
      price: 599.90,
      originalPrice: 799.90,
      imageUrl: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400',
      affiliateLink: 'https://shopee.com.br/air-fryer',
      marketplace: 'shopee',
      category: '🏠 Casa e Cozinha',
      rating: 4.6,
      reviews: 4567,
      sales: 4567,
      commission: 59.99,
      commissionPercent: 10,
      badge: '⭐ TOP VENDAS',
      createdAt: new Date('2024-07-15'),
      bsr: 3,
      bsrCategory: 'Home & Kitchen'
    }
  ];

  // Carrega produtos ao montar o componente
  useEffect(() => {
    if (activeTab === 'shopee') {
      setShopeeProducts(exampleProducts);
    }
  }, [activeTab]);

  const fetchShopeeProducts = async (query: string) => {
    setIsLoading(true);
    setError('');
    setShopeeProducts([]);

    console.log(`[BUSCA REAL] Iniciando busca por: "${query}"`);

    try {
      // Usa nossa Edge Function própria como proxy CORS
      console.log('[BUSCA REAL] Usando nosso proxy CORS próprio (Supabase Edge Function)');
      
      const { data, error: funcError } = await supabase.functions.invoke('shopee-proxy-cors', {
        body: { query }
      });

      if (funcError) {
        console.error('[BUSCA REAL] Erro na Edge Function:', funcError);
        throw funcError;
      }

      if (data && data.items && data.items.length > 0) {
        console.log(`[BUSCA REAL] SUCESSO! ${data.items.length} produtos encontrados.`);
        
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
      } else {
        console.warn('[BUSCA REAL] Nenhum produto encontrado na resposta');
        setError('Nenhum produto encontrado para esta busca.');
      }

    } catch (error) {
      console.error('[BUSCA REAL] Erro geral:', error);
      setError('Não foi possível buscar produtos no momento. Tente novamente.');
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
          <div className="bg-card rounded-lg shadow-sm p-12 text-center border">
            <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-lg">
              Integração Lomadee em desenvolvimento
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductsPage;