import { useState, useMemo } from 'react';
import ProductCard from '@/components/ProductCard';
import FilterPanel, { FilterOptions } from '@/components/FilterPanel';
import GerarConteudoModal from './GerarConteudoModal';
import { mockProducts } from '@/data/mockData';
import type { Marketplace, Product } from '@/types/product';

const MARKETPLACE_TABS: { value: Marketplace | 'all'; label: string; icon: string }[] = [
  { value: 'all', label: 'Todos', icon: '🌐' },
  { value: 'amazon', label: 'Amazon', icon: '📦' },
  { value: 'shopee', label: 'Shopee', icon: '🛍️' },
  { value: 'aliexpress', label: 'AliExpress', icon: '🌍' },
  { value: 'lomadee', label: 'Lomadee', icon: '🔗' },
  { value: 'hotmart', label: 'Hotmart', icon: '🎓' },
  { value: 'eduzz', label: 'Eduzz', icon: '💼' },
  { value: 'monetizze', label: 'Monetizze', icon: '💰' }
];

const ProductsPage = () => {
  const [activeTab, setActiveTab] = useState<Marketplace | 'all'>('all');
  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    marketplaces: ['amazon', 'shopee', 'aliexpress', 'lomadee', 'hotmart'],
    categories: [],
    priceRange: { min: 0, max: 10000 },
    minCommission: 0,
    sortBy: 'sales',
    quantity: 500
  });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let filtered = [...mockProducts];

    // Filter by active tab
    if (activeTab !== 'all') {
      filtered = filtered.filter(p => p.marketplace === activeTab);
    }

    // Filter by marketplaces (from sidebar)
    if (filters.marketplaces.length > 0) {
      filtered = filtered.filter(p => filters.marketplaces.includes(p.marketplace));
    }

    // Filter by categories
    if (filters.categories.length > 0) {
      filtered = filtered.filter(p => filters.categories.includes(p.category));
    }

    // Filter by search
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(p =>
        p.title.toLowerCase().includes(searchLower) ||
        p.description.toLowerCase().includes(searchLower)
      );
    }

    // Filter by price range
    filtered = filtered.filter(p =>
      p.price >= filters.priceRange.min &&
      p.price <= filters.priceRange.max
    );

    // Filter by minimum commission
    if (filters.minCommission > 0) {
      filtered = filtered.filter(p => p.commission >= filters.minCommission);
    }

    // Sort
    switch (filters.sortBy) {
      case 'sales':
        filtered.sort((a, b) => b.sales - a.sales);
        break;
      case 'commission':
        filtered.sort((a, b) => b.commission - a.commission);
        break;
      case 'price-asc':
        filtered.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        filtered.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        filtered.sort((a, b) => b.rating - a.rating);
        break;
      case 'newest':
        filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
    }

    // Limit quantity
    return filtered.slice(0, filters.quantity);
  }, [mockProducts, activeTab, filters]);

  // Calculate stats from filtered products
  const stats = useMemo(() => {
    const total = filteredProducts.length;
    const totalCommission = filteredProducts.reduce((sum, p) => sum + p.commission, 0);
    const avgRating = filteredProducts.length > 0
      ? filteredProducts.reduce((sum, p) => sum + p.rating, 0) / filteredProducts.length
      : 0;
    
    const categoryCounts = filteredProducts.reduce((acc, p) => {
      acc[p.category] = (acc[p.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    return {
      totalProducts: total,
      totalCommission: totalCommission.toFixed(2),
      averageRating: avgRating.toFixed(1),
      topSeller: topCategory
    };
  }, [filteredProducts]);

  const handleGenerateContent = (product: Product) => {
    setSelectedProduct(product);
    setShowModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Produtos para Afiliados
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Encontre os melhores produtos para promover e ganhar comissões
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total de Produtos</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalProducts}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Comissão Total</p>
            <p className="text-3xl font-bold text-green-500">R$ {stats.totalCommission}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Avaliação Média</p>
            <p className="text-3xl font-bold text-yellow-500">⭐ {stats.averageRating}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Categoria Top</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{stats.topSeller}</p>
          </div>
        </div>

        {/* Marketplace Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6 p-2 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {MARKETPLACE_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all whitespace-nowrap ${
                  activeTab === tab.value
                    ? 'bg-blue-500 text-white shadow-lg'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <span className="text-xl">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex gap-6">
          {/* Sidebar Filters */}
          <div className="hidden lg:block lg:w-80 flex-shrink-0">
            <div className="sticky top-6">
              <FilterPanel onFilterChange={setFilters} />
            </div>
          </div>

          {/* Products Grid */}
          <div className="flex-1">
            {/* Mobile Filter Toggle */}
            <div className="lg:hidden mb-6">
              <FilterPanel onFilterChange={setFilters} />
            </div>

            {filteredProducts.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
                <p className="text-xl text-gray-500 dark:text-gray-400 mb-4">
                  Nenhum produto encontrado
                </p>
                <p className="text-gray-400 dark:text-gray-500">
                  Tente ajustar os filtros ou escolher outro marketplace
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredProducts.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onGenerateContent={handleGenerateContent}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal de Geração de Conteúdo */}
        {showModal && selectedProduct && (
          <GerarConteudoModal
            product={selectedProduct}
            onClose={() => {
              setShowModal(false);
              setSelectedProduct(null);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default ProductsPage;
