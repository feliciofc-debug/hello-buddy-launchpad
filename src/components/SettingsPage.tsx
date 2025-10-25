import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const SettingsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Estados para o teste de conexão da Hotmart
  const [loadingHotmart, setLoadingHotmart] = useState(false);
  const [hotmartResponse, setHotmartResponse] = useState('');

  // Estados para o teste de conexão da Shopee (simplificado)
  const [loadingShopee, setLoadingShopee] = useState(false);
  const [shopeeResponse, setShopeeResponse] = useState('');

  // Lomadee state
  const [lomadeeAppToken, setLomadeeAppToken] = useState('');
  const [lomadeeSourceId, setLomadeeSourceId] = useState('');
  const [lomadeeLoading, setLomadeeLoading] = useState(false);
  const [lomadeeTesting, setLomadeeTesting] = useState(false);
  const [lomadeeConnected, setLomadeeConnected] = useState(false);

  // Load Lomadee credentials on mount
  useEffect(() => {
    const loadLomadeeCredentials = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('integrations')
          .select('lomadee_app_token, lomadee_source_id')
          .eq('user_id', user.id)
          .eq('platform', 'lomadee')
          .maybeSingle();

        if (data?.lomadee_app_token && data?.lomadee_source_id) {
          setLomadeeAppToken(data.lomadee_app_token);
          setLomadeeSourceId(data.lomadee_source_id);
          setLomadeeConnected(true);
        }
      } catch (error) {
        console.error('Error loading Lomadee credentials:', error);
      }
    };
    loadLomadeeCredentials();
  }, []);

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

  const handleTestLomadeeConnection = async () => {
    if (!lomadeeAppToken.trim() || !lomadeeSourceId.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha as credenciais antes de testar.',
        variant: 'destructive',
      });
      return;
    }

    setLomadeeTesting(true);
    try {
      const testUrl = `https://api.lomadee.com/v3/${lomadeeAppToken}/offer/_search?sourceId=${lomadeeSourceId}&keyword=teste&size=1`;
      const response = await fetch(testUrl);
      
      if (!response.ok) throw new Error('Credenciais inválidas ou API indisponível.');
      
      toast({
        title: 'Conexão bem-sucedida',
        description: '✅ Conexão com a Lomadee funcionando!',
      });
    } catch (error: any) {
      toast({
        title: 'Falha no teste de conexão',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLomadeeTesting(false);
    }
  };

  const handleSaveLomadeeCredentials = async () => {
    if (!lomadeeAppToken.trim() || !lomadeeSourceId.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'O App Token e o Source ID são obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    setLomadeeLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Usuário não autenticado.');

      // Verificar se já existe registro
      const { data: existing, error: checkError } = await supabase
        .from('integrations')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      const payload = {
        lomadee_app_token: lomadeeAppToken.trim(),
        lomadee_source_id: lomadeeSourceId.trim(),
        lomadee_connected_at: new Date().toISOString(),
      };

      let error;
      if (existing) {
        // Atualizar registro existente
        const result = await supabase
          .from('integrations')
          .update(payload)
          .eq('user_id', user.id);
        error = result.error;
      } else {
        // Inserir novo registro
        const result = await supabase
          .from('integrations')
          .insert({
            ...payload,
            user_id: user.id,
            platform: 'lomadee',
            access_token: '', // campo obrigatório
          });
        error = result.error;
      }

      if (error) throw error;

      setLomadeeConnected(true);
      toast({
        title: 'Sucesso',
        description: 'Integração com a Lomadee salva com sucesso!',
      });
    } catch (error: any) {
      console.error('Erro ao salvar credenciais Lomadee:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLomadeeLoading(false);
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

          {/* Card de Integração Meta (Facebook/Instagram) */}
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Meta (Facebook / Instagram)</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Conecte sua conta do Facebook e Instagram para automatizar suas postagens de produtos.
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
                  'email'
                ].join(',');
                const encodedRedirectUri = encodeURIComponent(REDIRECT_URI);
                const loginUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodedRedirectUri}&scope=${permissions}&response_type=code&state=${user.id}`;
                console.log("Redirecionando para a URL de login da Meta:", loginUrl);
                window.location.href = loginUrl;
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors"
            >
              Conectar com Facebook / Instagram
            </button>
          </div>

          {/* Card de Integração Lomadee */}
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Lomadee</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Conecte sua conta da Lomadee para buscar produtos e gerar links de afiliado.
              <br />
              <a 
                href="https://www.lomadee.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline text-sm"
              >
                Obtenha suas credenciais no painel da Lomadee →
              </a>
            </p>
            
            <div className="space-y-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor="lomadee-app-token">App Token</Label>
                <Input
                  id="lomadee-app-token"
                  type="password"
                  placeholder="Seu App Token da Lomadee"
                  value={lomadeeAppToken}
                  onChange={(e) => setLomadeeAppToken(e.target.value)}
                  disabled={lomadeeLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lomadee-source-id">Source ID</Label>
                <Input
                  id="lomadee-source-id"
                  type="password"
                  placeholder="Seu Source ID de afiliado"
                  value={lomadeeSourceId}
                  onChange={(e) => setLomadeeSourceId(e.target.value)}
                  disabled={lomadeeLoading}
                />
              </div>
              {lomadeeConnected && (
                <div className="text-sm text-green-600 dark:text-green-400">
                  ✓ Conectado com sucesso
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleTestLomadeeConnection}
                disabled={lomadeeLoading || lomadeeTesting}
                className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400 transition-colors"
              >
                {lomadeeTesting ? 'Testando...' : 'Testar Conexão'}
              </button>
              <button
                onClick={handleSaveLomadeeCredentials}
                disabled={lomadeeLoading || lomadeeTesting}
                className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400 transition-colors"
              >
                {lomadeeLoading ? 'Salvando...' : (lomadeeConnected ? 'Atualizar' : 'Salvar')}
              </button>
            </div>
          </div>

          {/* Card para futuras integrações */}
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md opacity-60">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Outras Integrações</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Amazon, AliExpress e outras integrações serão adicionadas em breve.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
