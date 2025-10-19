// src/components/ProductsPage.tsx
// INSTRUÇÕES LOVABLE: Criar arquivo em src/components/ProductsPage.tsx

"use client";

import { useState, useMemo } from 'react';
import { Package, TrendingUp, DollarSign, Star } from 'lucide-react';
import FilterPanel, { FilterOptions } from './FilterPanel';
import ProductCard from './ProductCard';
import { mockProducts, type Marketplace, type Product } from '@/data/mockData';

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

  // Filtrar e ordenar produtos
  const filteredProducts = useMemo(() => {
    let products = [...mockProducts];

    // Filtro por aba de marketplace
    if (activeTab !== 'all') {
      products = products.filter(p => p.marketplace === activeTab);
    }

    // Filtro por marketplaces selecionados
    if (filters.marketplaces.length > 0) {
      products = products.filter(p => filters.marketplaces.includes(p.marketplace));
    }

    // Filtro por categorias
    if (filters.categories.length > 0) {
      products = products.filter(p => filters.categories.includes(p.category));
    }

    // Filtro por busca
    if (filters.search) {
      const search = filters.search.toLowerCase();
      products = products.filter(p => 
        p.title.toLowerCase().includes(search) ||
        p.description.toLowerCase().includes(search)
      );
    }

    // Filtro por preço
    products = products.filter(p => 
      p.price >= filters.priceRange.min && p.price <= filters.priceRange.max
    );

    // Filtro por comissão mínima
    if (filters.minCommission > 0) {
      products = products.filter(p => p.commission >= filters.minCommission);
    }

    // Ordenação
    switch (filters.sortBy) {
      case 'sales':
        products.sort((a, b) => b.sales - a.sales);
        break;
      case 'commission':
        products.sort((a, b) => b.commission - a.commission);
        break;
      case 'price-asc':
        products.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        products.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        products.sort((a, b) => b.rating - a.rating);
        break;
      case 'newest':
        products.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
    }

    // Limitar quantidade
    return products.slice(0, filters.quantity);
  }, [activeTab, filters]);

  // Calcular estatísticas
  const stats = useMemo(() => {
    const total = filteredProducts.length;
    const totalCommission = filteredProducts.reduce((acc, p) => acc + p.commission, 0);
    const avgRating = filteredProducts.reduce((acc, p) => acc + p.rating, 0) / total || 0;
    const topSeller = filteredProducts.reduce((max, p) => p.sales > max.sales ? p : max, filteredProducts[0]);

    return { total, totalCommission, avgRating, topSeller };
  }, [filteredProducts]);

  const handleGenerateContent = (product: Product) => {
    setSelectedProduct(product);
    // Aqui você integrará com o Gemini para gerar conteúdo
    alert(`Gerando conteúdo para: ${product.title}\n\nEm breve com integração Gemini!`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Produtos para Afiliados
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Encontre os melhores produtos para promover e maximize suas comissões
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <Package className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total de Produtos</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Comissão Potencial</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  R$ {stats.totalCommission.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <Star className="w-8 h-8 text-yellow-500" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Avaliação Média</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.avgRating.toFixed(1)} ⭐
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Top Seller</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white line-clamp-2">
                  {stats.topSeller?.title || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Marketplace Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6 p-2">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {MARKETPLACE_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.value
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Filtros */}
          <div className="lg:col-span-1">
            <FilterPanel onFilterChange={setFilters} />
          </div>

          {/* Main Content - Produtos */}
          <div className="lg:col-span-3">
            {/* Results Header */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Exibindo <span className="font-bold text-gray-900 dark:text-white">{filteredProducts.length}</span> produtos
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Ordenado por:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {filters.sortBy === 'sales' && '⭐ Mais vendidos'}
                    {filters.sortBy === 'commission' && '💰 Maior comissão'}
                    {filters.sortBy === 'price-asc' && '💵 Menor preço'}
                    {filters.sortBy === 'price-desc' && '💸 Maior preço'}
                    {filters.sortBy === 'rating' && '⭐ Melhor avaliação'}
                    {filters.sortBy === 'newest' && '🆕 Lançamentos'}
                  </span>
                </div>
              </div>
            </div>

            {/* Products Grid */}
            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredProducts.map(product => (
                  <ProductCard 
                    key={product.id} 
                    product={product}
                    onGenerateContent={handleGenerateContent}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
                <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  Nenhum produto encontrado
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Tente ajustar seus filtros para ver mais produtos
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductsPage;