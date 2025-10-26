import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  link: string;
  store: string;
  rating?: number;
  sold?: number;
}

const ProductsPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('shopee');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [shopeeProducts, setShopeeProducts] = useState<Product[]>([]);
  const [lomadeeProducts, setLomadeeProducts] = useState<Product[]>([]);
  const [error, setError] = useState('');

  // Produtos de exemplo para demonstração
  const exampleProducts: Product[] = [
    {
      id: '1',
      name: 'iPhone 15 Pro Max 256GB - Titânio Natural',
      price: 8999.90,
      image: 'https://images.unsplash.com/photo-1696446701796-da61225697cc?w=400',
      link: 'https://shopee.com.br',
      store: 'Shopee',
      rating: 4.9,
      sold: 1523
    },
    {
      id: '2',
      name: 'Notebook Gamer Dell G15 RTX 4060',
      price: 6499.90,
      image: 'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=400',
      link: 'https://shopee.com.br',
      store: 'Shopee',
      rating: 4.8,
      sold: 892
    },
    {
      id: '3',
      name: 'Sony WH-1000XM5 - Fone com Cancelamento de Ruído',
      price: 2199.90,
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400',
      link: 'https://shopee.com.br',
      store: 'Shopee',
      rating: 4.9,
      sold: 3421
    },
    {
      id: '4',
      name: 'Smart TV Samsung Neo QLED 55" 4K',
      price: 3799.90,
      image: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=400',
      link: 'https://shopee.com.br',
      store: 'Shopee',
      rating: 4.7,
      sold: 567
    },
    {
      id: '5',
      name: 'iPad Pro M2 12.9" 128GB Wi-Fi',
      price: 9499.90,
      image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400',
      link: 'https://shopee.com.br',
      store: 'Shopee',
      rating: 5.0,
      sold: 234
    },
    {
      id: '6',
      name: 'Air Fryer Philco 12L Digital',
      price: 599.90,
      image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400',
      link: 'https://shopee.com.br',
      store: 'Shopee',
      rating: 4.6,
      sold: 4567
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
    
    // Simula busca com delay
    setTimeout(() => {
      const filtered = query 
        ? exampleProducts.filter(p => 
            p.name.toLowerCase().includes(query.toLowerCase())
          )
        : exampleProducts;
      
      setShopeeProducts(filtered.length > 0 ? filtered : exampleProducts);
      setIsLoading(false);
    }, 1000);
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
                  <div key={product.id} className="bg-card rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden border">
                    <div className="relative aspect-square bg-muted">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x400/FF6B35/FFFFFF?text=Produto';
                        }}
                      />
                      <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
                        -20%
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-foreground mb-2 line-clamp-2 h-12">
                        {product.name}
                      </h3>
                      <div className="flex items-center justify-between mb-3 text-sm">
                        <div className="flex items-center gap-1 text-orange-500">
                          <Star className="w-4 h-4 fill-current" />
                          <span className="font-medium">{product.rating || 4.8}</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <TrendingUp className="w-4 h-4" />
                          <span>{formatSold(product.sold)}</span>
                        </div>
                      </div>
                      <div className="mb-4">
                        <div className="text-2xl font-bold text-orange-600">
                          {formatPrice(product.price)}
                        </div>
                        <div className="text-sm text-muted-foreground line-through">
                          {formatPrice(product.price * 1.2)}
                        </div>
                      </div>
                      <a
                        href={product.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full py-2 bg-orange-500 text-white text-center rounded-lg hover:bg-orange-600 transition-colors"
                      >
                        Ver Produto
                      </a>
                    </div>
                  </div>
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