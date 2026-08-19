import { ArrowLeft, Loader2, Linkedin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { MarcaPersonalizacao } from './MarcaPersonalizacao';
import { buildTikTokAuthUrl } from "@/config/tiktok";

const SettingsPage = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [metaConnection, setMetaConnection] = useState<any>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [tiktokConnection, setTiktokConnection] = useState<any>(null);
  const [loadingTiktok, setLoadingTiktok] = useState(true);
  const [disconnectingTiktok, setDisconnectingTiktok] = useState(false);
  const [linkedinConnection, setLinkedinConnection] = useState<any>(null);
  const [loadingLinkedin, setLoadingLinkedin] = useState(true);
  const [connectingLinkedin, setConnectingLinkedin] = useState(false);
  const [disconnectingLinkedin, setDisconnectingLinkedin] = useState(false);

  const fetchLinkedinConnection = async () => {
    setLoadingLinkedin(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('linkedin_connections' as any)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      setLinkedinConnection(data);
    } finally {
      setLoadingLinkedin(false);
    }
  };

  const handleConnectLinkedin = async () => {
    setConnectingLinkedin(true);
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-oauth-start', {
        body: { redirect_to: '/configuracoes' },
      });
      if (error) throw error;
      if (!data?.auth_url) throw new Error(data?.error || 'Não foi possível iniciar a conexão');
      window.location.href = data.auth_url;
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao conectar o LinkedIn');
      setConnectingLinkedin(false);
    }
  };

  const handleDisconnectLinkedin = async () => {
    if (!window.confirm('Tem certeza que deseja desconectar a conta do LinkedIn?')) return;
    setDisconnectingLinkedin(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from('linkedin_connections' as any).delete().eq('user_id', user.id);
      if (error) throw error;
      setLinkedinConnection(null);
      toast.success('Conta do LinkedIn desconectada.');
    } catch {
      toast.error('Erro ao desconectar. Tente novamente.');
    } finally {
      setDisconnectingLinkedin(false);
    }
  };


  const fetchTiktokConnection = async () => {
    setLoadingTiktok(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoadingTiktok(false); return; }
      const { data, error } = await supabase.functions.invoke('tiktok-fetch-userinfo', {
        body: { user_id: user.id }
      });
      if (error) {
        console.error('Erro ao buscar TikTok:', error);
        setTiktokConnection(null);
      } else {
        setTiktokConnection(data?.connected ? data : null);
      }
    } catch (err) {
      console.error('Erro inesperado TikTok:', err);
      setTiktokConnection(null);
    } finally {
      setLoadingTiktok(false);
    }
  };

  useEffect(() => {
    const fetchMetaConnection = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoadingMeta(false); return; }
      const { data } = await supabase
        .from('meta_connections')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      setMetaConnection(data);
      setLoadingMeta(false);
    };
    fetchMetaConnection();
    fetchTiktokConnection();

    const params = new URLSearchParams(window.location.search);
    const urlMessage = params.get('message');
    if (params.get('success') === 'true' && params.get('platform') === 'meta') {
      toast.success('✅ Meta Business conectado com sucesso!');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('error') === 'true') {
      toast.error(urlMessage ? `❌ ${decodeURIComponent(urlMessage)}` : '❌ Erro ao conectar. Tente novamente.');
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (params.get('success') === 'true' && params.get('platform') === 'tiktok') {
      toast.success('✅ TikTok conectado com sucesso!');
      window.history.replaceState({}, '', window.location.pathname);
      fetchTiktokConnection();
    }
    if (params.get('error') && params.get('platform') === 'tiktok') {
      toast.error('Erro ao conectar TikTok: ' + decodeURIComponent(params.get('error') || ''));
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleConnect = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error(t('settings.login_required_meta'));
      return;
    }
    const authUrl = `https://www.facebook.com/v25.0/dialog/oauth?client_id=1254152493364240&redirect_uri=${encodeURIComponent('https://www.amzofertas.com.br/auth/callback/meta')}&scope=pages_show_list,pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish,business_management&response_type=code&state=${user.id}`;
    window.location.href = authUrl;
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Tem certeza que deseja remover esta página? Isso não pode ser desfeito.')) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setDisconnecting(true);
    try {
      const { error: e1 } = await supabase.from('meta_connections').delete().eq('user_id', user.id);
      const { error: e2 } = await supabase.from('integrations').delete().eq('user_id', user.id).like('platform', 'meta%');
      if (e1) console.error('Erro meta_connections:', e1);
      if (e2) console.error('Erro integrations:', e2);
      setMetaConnection(null);
      toast.success('Conta Meta desconectada com sucesso.');
    } catch (err) {
      toast.error('Erro ao desconectar. Tente novamente.');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleConnectTiktok = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error(t('settings.login_required_tiktok'));
      return;
    }
    const authUrl = buildTikTokAuthUrl(user.id);
    localStorage.setItem('tiktok_auth_origin', 'settings');
    window.location.href = authUrl;
  };

  const handleDisconnectTiktok = async () => {
    if (!window.confirm('Tem certeza que deseja desconectar a conta TikTok?')) return;
    setDisconnectingTiktok(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from('integrations').delete()
        .eq('user_id', user.id).eq('platform', 'tiktok');
      if (error) throw error;
      setTiktokConnection(null);
      toast.success('Conta TikTok desconectada com sucesso.');
    } catch (err) {
      console.error('Erro ao desconectar:', err);
      toast.error('Erro ao desconectar. Tente novamente.');
    } finally {
      setDisconnectingTiktok(false);
    }
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
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="meta">{t('settings.meta_tab')}</TabsTrigger>
            <TabsTrigger value="tiktok">{t('settings.tiktok_tab')}</TabsTrigger>
            <TabsTrigger value="marca">🎨 {t('settings.brand_tab')}</TabsTrigger>
          </TabsList>

          <TabsContent value="meta">
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">{t('settings.meta_business_title')}</h2>

              {loadingMeta ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{t('settings.loading_connection')}</span>
                </div>
              ) : metaConnection ? (
                <div className="space-y-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    ✅ {t('settings.connected')}
                  </span>

                  <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    {metaConnection.page_name && (
                      <p><span className="font-medium">{t('settings.page_label')}</span> {metaConnection.page_name}</p>
                    )}
                    {metaConnection.ig_username && (
                      <p><span className="font-medium">Instagram:</span> @{metaConnection.ig_username}</p>
                    )}
                    {metaConnection.page_id && (
                      <p><span className="font-medium">Facebook Page ID:</span> {metaConnection.page_id}</p>
                    )}
                    {metaConnection.last_verified_at && (
                      <p><span className="font-medium">{t('settings.connected_since')}</span> {new Date(metaConnection.last_verified_at).toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    )}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleConnect}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors"
                    >
                      🔄 {t('settings.reconnect')}
                    </button>
                    <button
                      onClick={handleDisconnect}
                      disabled={disconnecting}
                      className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded transition-colors flex items-center gap-2"
                    >
                      {disconnecting && <Loader2 className="w-4 h-4 animate-spin" />}
                      🔌 {t('settings.disconnect')}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 mb-4">
                    {t('settings.not_connected')}
                  </span>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 mt-3">
                    {t('settings.meta_business_description')}
                  </p>
                  <button
                    onClick={handleConnect}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors"
                  >
                    {t('settings.connect_meta_business')}
                  </button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="tiktok">
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">TikTok for Developers</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                {t('settings.tiktok_dev_description')}
              </p>

              {loadingTiktok ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{t('settings.loading_connection')}</span>
                </div>
              ) : tiktokConnection ? (
                <div className="space-y-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    ✅ {t('settings.connected')}
                  </span>

                  <div className="flex items-center gap-4">
                    {tiktokConnection.avatar_url && (
                      <img
                        src={tiktokConnection.avatar_url}
                        alt={tiktokConnection.display_name || 'TikTok avatar'}
                        className="w-16 h-16 rounded-full border border-gray-200 dark:border-gray-700"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div>
                      {tiktokConnection.display_name && (
                        <p className="text-lg font-semibold text-gray-900 dark:text-white">
                          {tiktokConnection.display_name}
                        </p>
                      )}
                      {tiktokConnection.username && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          @{tiktokConnection.username}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    {tiktokConnection.open_id && (
                      <p><span className="font-medium">Open ID:</span> {tiktokConnection.open_id}</p>
                    )}
                    {tiktokConnection.scope && (
                      <p><span className="font-medium">{t('settings.permissions_label')}</span> {tiktokConnection.scope}</p>
                    )}
                    {tiktokConnection.connected_at && (
                      <p>
                        <span className="font-medium">{t('settings.connected_at')}</span>{' '}
                        {new Date(tiktokConnection.connected_at).toLocaleString(i18n.language === 'en' ? 'en-US' : 'pt-BR')}
                      </p>
                    )}
                    {tiktokConnection.expired && (
                      <p className="text-yellow-700 dark:text-yellow-400 font-medium">
                        ⚠️ {t('settings.token_expired_reconnect')}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleConnectTiktok}
                      className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold py-2 px-4 rounded transition-colors"
                    >
                      🔄 {t('settings.reconnect')}
                    </button>
                    <button
                      onClick={handleDisconnectTiktok}
                      disabled={disconnectingTiktok}
                      className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded transition-colors flex items-center gap-2"
                    >
                      {disconnectingTiktok && <Loader2 className="w-4 h-4 animate-spin" />}
                      🗑️ {t('settings.disconnect')}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 mb-4">
                    {t('settings.not_connected')}
                  </span>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 mt-3">
                    {t('settings.tiktok_not_connected_desc')}
                  </p>
                  <button
                    onClick={handleConnectTiktok}
                    className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold py-2 px-4 rounded transition-colors"
                  >
                    {t('settings.connect_tiktok')}
                  </button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="linkedin">
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white flex items-center gap-2">
                <Linkedin className="w-5 h-5 text-[#0A66C2]" /> LinkedIn (perfil pessoal)
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Publique no seu perfil com o link no primeiro comentário, para não reduzir o alcance.
              </p>

              {loadingLinkedin ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{t('settings.loading_connection')}</span>
                </div>
              ) : linkedinConnection ? (
                <div className="space-y-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    ✅ {t('settings.connected')}
                  </span>
                  <div className="flex items-center gap-4">
                    {linkedinConnection.avatar_url && (
                      <img src={linkedinConnection.avatar_url} alt="" className="w-16 h-16 rounded-full border border-gray-200 dark:border-gray-700"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    )}
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">{linkedinConnection.nome || 'Perfil conectado'}</p>
                      {linkedinConnection.token_expires_at && (
                        <p>Token válido até {new Date(linkedinConnection.token_expires_at).toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'pt-BR')}</p>
                      )}
                      {linkedinConnection.alert_status === 'reconectar' && (
                        <p className="text-yellow-700 dark:text-yellow-400 font-medium">⚠️ Reconecte a conta para continuar publicando.</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={handleConnectLinkedin} disabled={connectingLinkedin}
                      className="bg-[#0A66C2] hover:bg-[#08529b] disabled:opacity-50 text-white font-bold py-2 px-4 rounded transition-colors flex items-center gap-2">
                      {connectingLinkedin && <Loader2 className="w-4 h-4 animate-spin" />}
                      🔄 {t('settings.reconnect')}
                    </button>
                    <button onClick={() => navigate('/linkedin')}
                      className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-bold py-2 px-4 rounded transition-colors">
                      Abrir painel
                    </button>
                    <button onClick={handleDisconnectLinkedin} disabled={disconnectingLinkedin}
                      className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded transition-colors flex items-center gap-2">
                      {disconnectingLinkedin && <Loader2 className="w-4 h-4 animate-spin" />}
                      🗑️ {t('settings.disconnect')}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 mb-4">
                    {t('settings.not_connected')}
                  </span>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 mt-3">
                    Conecte seu perfil do LinkedIn para publicar textos, imagens e vídeos direto da plataforma.
                  </p>
                  <button onClick={handleConnectLinkedin} disabled={connectingLinkedin}
                    className="bg-[#0A66C2] hover:bg-[#08529b] disabled:opacity-50 text-white font-bold py-2 px-4 rounded transition-colors flex items-center gap-2">
                    {connectingLinkedin && <Loader2 className="w-4 h-4 animate-spin" />}
                    Conectar LinkedIn
                  </button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="marca">
            <MarcaPersonalizacao />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SettingsPage;
