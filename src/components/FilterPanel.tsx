"use client";

import { useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import type { Marketplace, Category } from '@/data/mockData';

interface FilterPanelProps {
  onFilterChange: (filters: FilterOptions) => void;
}

export interface FilterOptions {
  search: string;
  marketplaces: Marketplace[];
  categories: Category[];
  priceRange: { min: number; max: number };
  minCommission: number;
  sortBy: 'sales' | 'commission' | 'price-asc' | 'price-desc' | 'rating' | 'newest';
  quantity: 100 | 200 | 500 | 1000;
  category?: number | null; // Nova propriedade para categoria Shopee
}

const MARKETPLACES: { value: Marketplace; label: string }[] = [
  { value: 'amazon', label: '📦 Amazon' },
  { value: 'aliexpress', label: '🌐 AliExpress' },
  { value: 'hotmart', label: '🎓 Hotmart' },
  { value: 'eduzz', label: '💼 Eduzz' },
  { value: 'monetizze', label: '💰 Monetizze' }
];

const CATEGORIES: Category[] = [
  '📱 Eletrônicos',
  '🏠 Casa e Cozinha',
  '👶 Bebês',
  '👗 Moda',
  '💄 Beleza',
  '⚽ Esportes',
  '🎮 Games',
  '🐶 Pet Shop',
  '🧸 Brinquedos',
  '💊 Saúde e Suplementos',
  '📚 Livros',
  '🔧 Ferramentas',
  '🚗 Automotivo',
  '💼 Negócios',
  '📖 Educação',
  '💪 Fitness',
  '💰 Finanças'
];

const FilterPanel = ({ onFilterChange }: FilterPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    marketplaces: ['amazon', 'aliexpress', 'hotmart'],
    categories: [],
    priceRange: { min: 0, max: 10000 },
    minCommission: 0,
    sortBy: 'sales',
    quantity: 500
  });

  const updateFilters = (updates: Partial<FilterOptions>) => {
    const newFilters = { ...filters, ...updates };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const toggleMarketplace = (marketplace: Marketplace) => {
    const newMarketplaces = filters.marketplaces.includes(marketplace)
      ? filters.marketplaces.filter(m => m !== marketplace)
      : [...filters.marketplaces, marketplace];
    updateFilters({ marketplaces: newMarketplaces });
  };

  const toggleCategory = (category: Category) => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter(c => c !== category)
      : [...filters.categories, category];
    updateFilters({ categories: newCategories });
  };

  const clearFilters = () => {
    const defaultFilters: FilterOptions = {
      search: '',
      marketplaces: ['amazon', 'aliexpress', 'hotmart'],
      categories: [],
      priceRange: { min: 0, max: 10000 },
      minCommission: 0,
      sortBy: 'sales',
      quantity: 500
    };
    setFilters(defaultFilters);
    onFilterChange(defaultFilters);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <SlidersHorizontal className="w-5 h-5 text-blue-500" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Filtros Avançados</h2>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="md:hidden text-gray-500 hover:text-gray-700"
        >
          {isOpen ? <X size={24} /> : <SlidersHorizontal size={24} />}
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar produtos..."
            value={filters.search}
            onChange={(e) => updateFilters({ search: e.target.value })}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className={`space-y-6 ${isOpen ? 'block' : 'hidden md:block'}`}>
        {/* Quantidade */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Quantidade de Produtos:
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[100, 200, 500, 1000].map((qty) => (
              <button
                key={qty}
                onClick={() => updateFilters({ quantity: qty as 100 | 200 | 500 | 1000 })}
                className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                  filters.quantity === qty
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {qty}
              </button>
            ))}
          </div>
        </div>

        {/* Marketplaces */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Marketplace:
          </label>
          <div className="grid grid-cols-2 gap-2">
            {MARKETPLACES.map((mp) => (
              <label
                key={mp.value}
                className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={filters.marketplaces.includes(mp.value)}
                  onChange={() => toggleMarketplace(mp.value)}
                  className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{mp.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Categorias */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Categorias:
          </label>
          <div className="max-h-64 overflow-y-auto grid grid-cols-2 gap-2 pr-2">
            {CATEGORIES.map((cat) => (
              <label
                key={cat}
                className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={filters.categories.includes(cat)}
                  onChange={() => toggleCategory(cat)}
                  className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-700 dark:text-gray-300">{cat}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Faixa de Preço */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Faixa de Preço:
          </label>
          <div className="flex gap-3 items-center">
            <div className="flex-1">
              <label className="text-xs text-gray-500 dark:text-gray-400">Mínimo</label>
              <input
                type="number"
                value={filters.priceRange.min}
                onChange={(e) => updateFilters({ 
                  priceRange: { ...filters.priceRange, min: Number(e.target.value) }
                })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="R$ 0"
              />
            </div>
            <span className="text-gray-500 mt-6">até</span>
            <div className="flex-1">
              <label className="text-xs text-gray-500 dark:text-gray-400">Máximo</label>
              <input
                type="number"
                value={filters.priceRange.max}
                onChange={(e) => updateFilters({ 
                  priceRange: { ...filters.priceRange, max: Number(e.target.value) }
                })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="R$ 10.000"
              />
            </div>
          </div>
        </div>

        {/* Comissão Mínima */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Comissão Mínima:
          </label>
          <input
            type="number"
            value={filters.minCommission}
            onChange={(e) => updateFilters({ minCommission: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="R$ 0"
          />
        </div>

        {/* Ordenar por */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Ordenar por:
          </label>
          <select
            value={filters.sortBy}
            onChange={(e) => updateFilters({ sortBy: e.target.value as FilterOptions['sortBy'] })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="sales">⭐ Mais vendidos</option>
            <option value="commission">💰 Maior comissão</option>
            <option value="price-desc">💸 Maior preço</option>
            <option value="price-asc">💵 Menor preço</option>
            <option value="rating">⭐ Melhor avaliação</option>
            <option value="newest">🆕 Lançamentos</option>
          </select>
        </div>

        {/* Botões */}
        <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={clearFilters}
            className="flex-1 py-2 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            Limpar Filtros
          </button>
          <button
            onClick={() => onFilterChange(filters)}
            className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
          >
            Aplicar Filtros
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;
