import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const SettingsPage = () => {
  const navigate = useNavigate();
  
  // Estados para o teste de conexão da Hotmart
  const [loadingHotmart, setLoadingHotmart] = useState(false);
  const [hotmartResponse, setHotmartResponse] = useState('');

  // Estados para o teste de conexão da Shopee (simplificado)
  const [loadingShopee, setLoadingShopee] = useState(false);
  const [shopeeResponse, setShopeeResponse] = useState('');

  // Função para testar a conexão com a Hotmart
  const handleTestHotmart = async () => {
    setLoadingHotmart(true);
    setHotmartResponse('Testando conexão com a Hotmart...');
    try {
      const { data, error } = await supabase.functions.invoke('hotmart-auth');
      if (error) throw error;
      setHotmartResponse('Hotmart conectada com sucesso! Resposta: ' + JSON.stringify(data));
    } catch (error: any) {
      setHotmartResponse('Erro ao conectar com a Hotmart: ' + error.message);
    } finally {
      setLoadingHotmart(false);
    }
  };
  
  // Função SIMPLES para testar se a Edge Function da Shopee responde
  const handleTestShopee = async () => {
    setLoadingShopee(true);
    setShopeeResponse('Testando a função da Shopee...');
    try {
      // Chama a função sem parâmetros, apenas para ver se ela responde
      const { error } = await supabase.functions.invoke('shopee-affiliate-api');
      if (error) throw error;
      setShopeeResponse('Função da Shopee respondeu com sucesso! A conexão está OK.');
    } catch (error: any) {
      setShopeeResponse('Erro ao chamar a função da Shopee: ' + error.message);
    } finally {
      setLoadingShopee(false);
    }
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
        
        <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Configurações de Integração</h1>

        <div className="space-y-8">
          {/* Card de Integração da Hotmart */}
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Hotmart</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Configure suas credenciais da Hotmart para acessar dados de vendas e produtos.
            </p>
            <button
              onClick={handleTestHotmart}
              disabled={loadingHotmart}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded disabled:bg-gray-500 transition-colors"
            >
              {loadingHotmart ? 'Testando...' : 'Testar Conexão Hotmart'}
            </button>
            {hotmartResponse && (
              <p className="mt-4 text-sm text-gray-700 dark:text-gray-300 p-3 bg-gray-100 dark:bg-gray-700 rounded">
                {hotmartResponse}
              </p>
            )}
          </div>

          {/* Card de Integração da Shopee */}
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Shopee Affiliates</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Teste a conexão com a API de afiliados da Shopee. A busca de produtos foi movida para a página de Produtos.
            </p>
            <button
              onClick={handleTestShopee}
              disabled={loadingShopee}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded disabled:bg-gray-500 transition-colors"
            >
              {loadingShopee ? 'Testando...' : 'Testar Função Shopee'}
            </button>
            {shopeeResponse && (
              <p className="mt-4 text-sm text-gray-700 dark:text-gray-300 p-3 bg-gray-100 dark:bg-gray-700 rounded">
                {shopeeResponse}
              </p>
            )}
          </div>

          {/* Card para futuras integrações */}
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md opacity-60">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Outras Integrações</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Amazon, Lomadee, AliExpress e outras integrações serão adicionadas em breve.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
