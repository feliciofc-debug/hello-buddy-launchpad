import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const SettingsPage = () => {
  const navigate = useNavigate();


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
        
        <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Configurações de API</h1>

        <Tabs defaultValue="meta" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="meta">Meta</TabsTrigger>
            <TabsTrigger value="tiktok">TikTok</TabsTrigger>
          </TabsList>

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
                  const REDIRECT_URI = 'https://amzofertas.com.br/auth/callback/meta';
                  const permissions = [
                    'email',
                    'public_profile'
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
                onClick={async () => {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) {
                    alert('Você precisa estar logado para conectar com o TikTok');
                    return;
                  }
                  
                  const CLIENT_KEY = 'aw2ouo90dyp4ju9w';
                  const REDIRECT_URI = encodeURIComponent('https://amzofertas.com.br/tiktok/callback');
                  const SCOPE = encodeURIComponent('user.info.basic,user.info.profile,video.upload,video.publish');
                  const STATE = user.id;

                  const authUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${CLIENT_KEY}&response_type=code&scope=${SCOPE}&redirect_uri=${REDIRECT_URI}&state=${STATE}`;
                  
                  console.log("Redirecionando para a URL de login do TikTok:", authUrl);
                  window.location.href = authUrl;
                }}
                className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold py-2 px-4 rounded transition-colors"
              >
                Conectar com TikTok
              </button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SettingsPage;
