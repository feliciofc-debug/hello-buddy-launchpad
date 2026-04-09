import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const SettingsPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleConnect = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error(t('settings.login_required_meta'));
      return;
    }
    const authUrl = `https://www.facebook.com/v25.0/dialog/oauth?client_id=1254152493364240&redirect_uri=${encodeURIComponent('https://www.amzofertas.com.br/auth/callback/meta')}&scope=pages_show_list,pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish&response_type=code&state=${user.id}`;
    window.location.href = authUrl;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">{t('settings.back_to_dashboard')}</span>
        </button>
        
        <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">{t('settings.api_settings_title')}</h1>

        <Tabs defaultValue="meta" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="meta">{t('settings.meta_tab')}</TabsTrigger>
            <TabsTrigger value="tiktok">{t('settings.tiktok_tab')}</TabsTrigger>
          </TabsList>

          <TabsContent value="meta">
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">{t('settings.meta_business_title')}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {t('settings.meta_business_description')}
              </p>
              <button
                onClick={handleConnect}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors"
              >
                {t('settings.connect_meta_business')}
              </button>
            </div>
          </TabsContent>

          <TabsContent value="tiktok">
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">{t('settings.tiktok_business_title')}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {t('settings.tiktok_business_description')}
              </p>
              <button
                onClick={async () => {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) {
                    alert(t('settings.login_required_tiktok'));
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
                {t('settings.connect_tiktok')}
              </button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SettingsPage;
