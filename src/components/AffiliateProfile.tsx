"use client";

import { useState } from 'react';
import { User, Bell, Save, Mail, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Category } from '@/data/mockData';

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

interface AffiliateSettings {
  name: string;
  email: string;
  favoriteCategories: Category[];
  defaultQuantity: 100 | 200 | 500 | 1000;
  notifications: {
    launches: boolean;
    trending: boolean;
    newInNiche: boolean;
    priceDrops: boolean;
  };
}

const AffiliateProfile = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<AffiliateSettings>({
    name: 'Felicio',
    email: 'felicio@example.com',
    favoriteCategories: ['📱 Eletrônicos', '🏠 Casa e Cozinha'],
    defaultQuantity: 500,
    notifications: {
      launches: true,
      trending: true,
      newInNiche: true,
      priceDrops: false
    }
  });

  const [saved, setSaved] = useState(false);

  const toggleCategory = (category: Category) => {
    setSettings(prev => ({
      ...prev,
      favoriteCategories: prev.favoriteCategories.includes(category)
        ? prev.favoriteCategories.filter(c => c !== category)
        : [...prev.favoriteCategories, category]
    }));
  };

  const toggleNotification = (key: keyof typeof settings.notifications) => {
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: !prev.notifications[key]
      }
    }));
  };

  const handleSave = () => {
    // Aqui você salvaria no banco de dados
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Back Button */}
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="font-medium">Voltar ao Dashboard</span>
      </button>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-gray-200 dark:border-gray-700">
          <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Meu Perfil</h1>
            <p className="text-gray-500 dark:text-gray-400">Configure suas preferências de afiliado</p>
          </div>
        </div>

        {/* Personal Info */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-500" />
            Informações Pessoais
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nome
              </label>
              <input
                type="text"
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={settings.email}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Favorite Categories */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Nichos de Interesse
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Selecione os nichos que você mais gosta de promover. Você receberá recomendações personalizadas.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {CATEGORIES.map(category => (
              <button
                key={category}
                onClick={() => toggleCategory(category)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  settings.favoriteCategories.includes(category)
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <span className="text-sm font-medium">{category}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Default Quantity */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Quantidade Padrão de Produtos
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Quantos produtos você quer ver por padrão nas buscas?
          </p>
          <div className="grid grid-cols-4 gap-3">
            {[100, 200, 500, 1000].map(qty => (
              <button
                key={qty}
                onClick={() => setSettings({ ...settings, defaultQuantity: qty as 100 | 200 | 500 | 1000 })}
                className={`py-3 px-4 rounded-lg font-semibold transition-all ${
                  settings.defaultQuantity === qty
                    ? 'bg-blue-500 text-white shadow-lg'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {qty}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-500" />
            Notificações
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Escolha sobre o que você quer ser notificado
          </p>
          <div className="space-y-3">
            <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
              <div>
                <span className="font-medium text-gray-900 dark:text-white">🔥 Lançamentos</span>
                <p className="text-sm text-gray-500 dark:text-gray-400">Produtos lançados nos últimos 7 dias</p>
              </div>
              <input
                type="checkbox"
                checked={settings.notifications.launches}
                onChange={() => toggleNotification('launches')}
                className="w-5 h-5 text-blue-500 rounded focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
              <div>
                <span className="font-medium text-gray-900 dark:text-white">📈 Produtos em Alta</span>
                <p className="text-sm text-gray-500 dark:text-gray-400">Produtos com vendas crescentes</p>
              </div>
              <input
                type="checkbox"
                checked={settings.notifications.trending}
                onChange={() => toggleNotification('trending')}
                className="w-5 h-5 text-blue-500 rounded focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
              <div>
                <span className="font-medium text-gray-900 dark:text-white">🌟 Novos no Meu Nicho</span>
                <p className="text-sm text-gray-500 dark:text-gray-400">Produtos novos nas suas categorias favoritas</p>
              </div>
              <input
                type="checkbox"
                checked={settings.notifications.newInNiche}
                onChange={() => toggleNotification('newInNiche')}
                className="w-5 h-5 text-blue-500 rounded focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
              <div>
                <span className="font-medium text-gray-900 dark:text-white">💰 Quedas de Preço</span>
                <p className="text-sm text-gray-500 dark:text-gray-400">Quando produtos ficarem mais baratos</p>
              </div>
              <input
                type="checkbox"
                checked={settings.notifications.priceDrops}
                onChange={() => toggleNotification('priceDrops')}
                className="w-5 h-5 text-blue-500 rounded focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
              saved
                ? 'bg-green-500 text-white'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            <Save className="w-5 h-5" />
            {saved ? '✓ Salvo com sucesso!' : 'Salvar Preferências'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AffiliateProfile;
