import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { LomadeeSettings } from '@/components/LomadeeSettings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const SettingsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Estados para o teste de conexão da Hotmart
  const [loadingHotmart, setLoadingHotmart] = useState(false);
  const [hotmartResponse, setHotmartResponse] = useState('');

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

        <Tabs defaultValue="lomadee" className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-8">
            <TabsTrigger value="lomadee">Lomadee</TabsTrigger>
            <TabsTrigger value="hotmart">Hotmart</TabsTrigger>
            <TabsTrigger value="shopee">Shopee</TabsTrigger>
            <TabsTrigger value="meta">Meta</TabsTrigger>
            <TabsTrigger value="tiktok">TikTok</TabsTrigger>
          </TabsList>

          <TabsContent value="lomadee">
            <LomadeeSettings />
          </TabsContent>

          <TabsContent value="hotmart">
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
          </TabsContent>

          <TabsContent value="shopee">
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
          </TabsContent>

          <TabsContent value="meta">
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Meta para Empresas (Facebook / Instagram)</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Conecte sua conta comercial do Facebook e Instagram para automatizar suas postagens de produtos e gerenciar campanhas publicitárias.
              </p>
              <button
                onClick={async () => {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) {
                    alert('Você precisa estar logado para conectar com a Meta');
                    return;
                  }
                  
                  const META_APP_ID = import.meta.env.VITE_META_APP_ID;
                  const REDIRECT_URI = 'https://www.amzofertas.com.br/auth/callback/meta';
                  const permissions = [
                    'public_profile',
                    'email',
                    'pages_show_list',
                    'pages_read_engagement',
                    'pages_manage_posts',
                    'business_management'
                  ].join(',');
                  const encodedRedirectUri = encodeURIComponent(REDIRECT_URI);
                  const loginUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodedRedirectUri}&scope=${permissions}&response_type=code&state=${user.id}`;
                  console.log("Redirecionando para a URL de login da Meta:", loginUrl);
                  window.location.href = loginUrl;
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors"
              >
                Conectar com Meta Business
              </button>
            </div>
          </TabsContent>

          <TabsContent value="tiktok">
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">TikTok para Empresas</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Conecte sua conta empresarial do TikTok para automatizar suas postagens e gerenciar campanhas publicitárias.
              </p>
              <button
                disabled
                className="bg-gray-400 text-white font-bold py-2 px-4 rounded cursor-not-allowed"
              >
                Em Breve
              </button>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                A integração com TikTok for Business estará disponível em breve.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SettingsPage;
