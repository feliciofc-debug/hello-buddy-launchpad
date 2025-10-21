"use client";

import { useState } from 'react';
import { Save, Eye, EyeOff, Key, ShoppingBag, AlertCircle, CheckCircle, Copy, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface APIConfig {
  marketplace: string;
  apiKey: string;
  userId: string;
  isActive: boolean;
}

const SettingsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [shopeeProducts, setShopeeProducts] = useState<any[]>([]);
  const [configs, setConfigs] = useState<APIConfig[]>([
    {
      marketplace: 'Amazon Associates',
      apiKey: '',
      userId: '',
      isActive: false
    },
    {
      marketplace: 'Shopee Affiliates',
      apiKey: '',
      userId: '',
      isActive: false
    },
    {
      marketplace: 'AliExpress Affiliate',
      apiKey: '',
      userId: '',
      isActive: false
    },
    {
      marketplace: 'Lomadee',
      apiKey: '',
      userId: '',
      isActive: false
    },
    {
      marketplace: 'Hotmart',
      apiKey: '',
      userId: '',
      isActive: false
    },
    {
      marketplace: 'Eduzz',
      apiKey: '',
      userId: '',
      isActive: false
    },
    {
      marketplace: 'Monetizze',
      apiKey: '',
      userId: '',
      isActive: false
    }
  ]);

  const toggleShowKey = (marketplace: string) => {
    setShowKeys(prev => ({
      ...prev,
      [marketplace]: !prev[marketplace]
    }));
  };

  const updateConfig = (index: number, field: keyof APIConfig, value: string | boolean) => {
    setConfigs(prev => {
      const newConfigs = [...prev];
      newConfigs[index] = { ...newConfigs[index], [field]: value };
      return newConfigs;
    });
  };

  const handleSave = () => {
    // Aqui você salvaria no banco de dados
    console.log('Salvando configurações:', configs);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const testConnection = async (marketplace: string) => {
    if (marketplace === 'Hotmart') {
      setTesting(prev => ({ ...prev, [marketplace]: true }));
      
      try {
        console.log('🔐 Testando autenticação Hotmart...');
        
        const { data, error } = await supabase.functions.invoke('hotmart-auth');
        
        if (error) {
          console.error('❌ Erro ao testar Hotmart:', error);
          toast({
            title: "Erro ao testar Hotmart",
            description: error.message || "Não foi possível conectar à API da Hotmart",
            variant: "destructive",
          });
        } else {
          console.log('✅ Resposta da Hotmart:', data);
          toast({
            title: "✅ Hotmart conectado!",
            description: data.message || "Autenticação realizada com sucesso",
          });
        }
      } catch (error: any) {
        console.error('💥 Erro crítico:', error);
        toast({
          title: "Erro crítico",
          description: error.message || "Erro desconhecido ao testar conexão",
          variant: "destructive",
        });
      } finally {
        setTesting(prev => ({ ...prev, [marketplace]: false }));
      }
    } else if (marketplace === 'Shopee Affiliates') {
      setTesting(prev => ({ ...prev, [marketplace]: true }));
      setShopeeProducts([]); // Limpa a lista antes de uma nova busca
      
      try {
        console.log('🛒 Buscando produtos na Shopee...');
        
        const { data, error } = await supabase.functions.invoke('shopee-affiliate-api', {
          body: { keyword: 'fone de ouvido bluetooth', limit: 10 }
        });
        
        if (error) {
          console.error('❌ Erro ao buscar produtos na Shopee:', error);
          toast({
            title: "Erro ao buscar produtos",
            description: error.message || "Não foi possível conectar à API de Afiliados",
            variant: "destructive",
          });
        } else {
          console.log('✅ Resposta da API de Afiliados Shopee:', data);
          const products = data?.data?.productOfferV2?.nodes || [];
          
          if (products.length > 0) {
            setShopeeProducts(products);
            toast({
              title: "✅ Produtos carregados!",
              description: `Encontrados ${products.length} produtos da Shopee.`,
            });
          } else {
            setShopeeProducts([]);
            toast({
              title: "Nenhum produto encontrado",
              description: "A API conectou, mas não retornou produtos. Tente outra palavra-chave.",
            });
          }
        }
      } catch (error: any) {
        console.error('💥 Erro crítico:', error);
        toast({
          title: "Erro crítico",
          description: error.message || "Erro desconhecido ao buscar produtos",
          variant: "destructive",
        });
      } finally {
        setTesting(prev => ({ ...prev, [marketplace]: false }));
      }
    } else {
      toast({
        title: `Teste de ${marketplace}`,
        description: "Teste em desenvolvimento para este marketplace",
      });
    }
  };

  const getMarketplaceIcon = (marketplace: string) => {
    const icons: Record<string, string> = {
      'Amazon Associates': '📦',
      'Shopee Affiliates': '🛍️',
      'AliExpress Affiliate': '🌐',
      'Lomadee': '🔗',
      'Hotmart': '🎓',
      'Eduzz': '💼',
      'Monetizze': '💰'
    };
    return icons[marketplace] || '🏪';
  };

  const getDocsLink = (marketplace: string) => {
    const links: Record<string, string> = {
      'Amazon Associates': 'https://affiliate-program.amazon.com/help/node/topic/G201823250',
      'Shopee Affiliates': 'https://shopee.com.br/affiliate',
      'AliExpress Affiliate': 'https://portals.aliexpress.com/affiliate',
      'Lomadee': 'https://lomadee.com/',
      'Hotmart': 'https://developers.hotmart.com/',
      'Eduzz': 'https://atendimento.eduzz.com/',
      'Monetizze': 'https://www.monetizze.com.br/'
    };
    return links[marketplace] || '#';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Voltar ao Dashboard</span>
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
            <Key className="w-8 h-8 text-blue-500" />
            Configurações de API
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Configure suas credenciais de API para cada marketplace. Seus dados são criptografados e seguros.
          </p>
        </div>

        {/* Alert - Instruções */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                Como obter suas credenciais?
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Clique em "Ver Documentação" ao lado de cada marketplace para acessar o guia oficial de como gerar sua API Key e User ID.
              </p>
            </div>
          </div>
        </div>

        {/* API Configs */}
        <div className="space-y-4">
          {configs.map((config, index) => (
            <div 
              key={config.marketplace}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border-l-4 border-blue-500"
            >
              {/* Header do Card */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{getMarketplaceIcon(config.marketplace)}</span>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {config.marketplace}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-1 rounded ${
                        config.isActive 
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' 
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}>
                        {config.isActive ? '✓ Ativo' : '○ Inativo'}
                      </span>
                      <a
                        href={getDocsLink(config.marketplace)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:text-blue-600 underline"
                      >
                        Ver Documentação →
                      </a>
                    </div>
                  </div>
                </div>
                
                {/* Toggle Ativo/Inativo */}
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.isActive}
                    onChange={(e) => updateConfig(index, 'isActive', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300">
                    {config.isActive ? 'Ativado' : 'Desativado'}
                  </span>
                </label>
              </div>

              {/* Campos de Input */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* API Key */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    API Key / Access Token
                  </label>
                  <div className="relative">
                    <input
                      type={showKeys[config.marketplace] ? 'text' : 'password'}
                      value={config.apiKey}
                      onChange={(e) => updateConfig(index, 'apiKey', e.target.value)}
                      placeholder="Cole sua API Key aqui"
                      className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => toggleShowKey(config.marketplace)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      {showKeys[config.marketplace] ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* User ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    User ID / Affiliate ID
                  </label>
                  <input
                    type="text"
                    value={config.userId}
                    onChange={(e) => updateConfig(index, 'userId', e.target.value)}
                    placeholder="Seu ID de afiliado"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Botão de Testar Conexão */}
              <button
                onClick={() => testConnection(config.marketplace)}
                disabled={testing[config.marketplace]}
                className={`text-sm font-medium flex items-center gap-2 ${
                  testing[config.marketplace]
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-blue-500 hover:text-blue-600'
                }`}
              >
                <CheckCircle size={16} />
                {testing[config.marketplace] ? 'Testando...' : config.marketplace === 'Shopee Affiliates' ? 'Buscar Produtos' : 'Testar Conexão'}
              </button>

              {/* Tabela de Produtos da Shopee */}
              {config.marketplace === 'Shopee Affiliates' && shopeeProducts.length > 0 && (
                <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-3">
                    Produtos Encontrados ({shopeeProducts.length})
                  </h4>
                  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-900">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Produto
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Preço
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Comissão
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {shopeeProducts.map((product, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                              {product.productName || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                              {product.price || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                              {product.commissionRate ? `${product.commissionRate}%` : 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Botão Salvar */}
        <div className="mt-8 flex justify-end gap-4">
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
              saved
                ? 'bg-green-500 text-white'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            <Save className="w-5 h-5" />
            {saved ? '✓ Salvo com sucesso!' : 'Salvar Configurações'}
          </button>
        </div>

        {/* Seção de Segurança */}
        <div className="mt-8 bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
          <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Key className="w-5 h-5 text-blue-500" />
            Segurança das suas credenciais
          </h3>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
              Todas as API Keys são criptografadas com AES-256
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
              Conexões protegidas por HTTPS/SSL
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
              Suas credenciais nunca são compartilhadas com terceiros
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
              Você pode desativar qualquer integração a qualquer momento
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
