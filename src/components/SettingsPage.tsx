import { ArrowLeft, Loader2, Linkedin, Megaphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { MarcaPersonalizacao } from './MarcaPersonalizacao';
import { buildTikTokAuthUrl } from "@/config/tiktok";
import { isCustomAuth } from "@/config/runtime-config";
import { buildMetaAuthUrl } from "@/config/meta";

type MetaAdsAccount = {
  id: string;
  name?: string;
  currency?: string;
};

type MetaAdsConnection = {
  id: string;
  is_active: boolean | null;
  meta_user_name: string | null;
  meta_ad_account_id: string | null;
  meta_ad_account_name: string | null;
  meta_ad_account_currency: string | null;
  meta_ad_accounts: MetaAdsAccount[];
  limite_mensal_anuncios: number;
  token_expires_at: string | null;
};

const SettingsPage = () => {
  const navigate = useNavigate();
  const customAuth = isCustomAuth();
  const { t, i18n } = useTranslation();
  const [metaConnection, setMetaConnection] = useState<any>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [metaAdsConnection, setMetaAdsConnection] = useState<MetaAdsConnection | null>(null);
  const [loadingMetaAds, setLoadingMetaAds] = useState(true);
  const [savingMetaAds, setSavingMetaAds] = useState(false);
  const [monthlyAdsLimit, setMonthlyAdsLimit] = useState('200');
  const [tiktokConnection, setTiktokConnection] = useState<any>(null);
  const [loadingTiktok, setLoadingTiktok] = useState(true);
  const [disconnectingTiktok, setDisconnectingTiktok] = useState(false);
  const [linkedinConnection, setLinkedinConnection] = useState<any>(null);
  const [loadingLinkedin, setLoadingLinkedin] = useState(true);
  const [connectingLinkedin, setConnectingLinkedin] = useState(false);
  const [disconnectingLinkedin, setDisconnectingLinkedin] = useState(false);

  const fetchMetaAdsConnection = async () => {
    setLoadingMetaAds(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoadingMetaAds(false);
      return;
    }
    const { data, error } = await supabase
      .from('integrations')
      .select('id,platform,is_active,meta_user_name,meta_ad_account_id,meta_ad_account_name,meta_ad_account_currency,meta_ad_accounts,limite_mensal_anuncios,token_expires_at')
      .eq('user_id', user.id)
      .eq('platform', 'meta_ads')
      .maybeSingle();
    if (error) console.error('Erro ao buscar Meta Ads:', error);
    setMetaAdsConnection(data ? {
      ...data,
      meta_ad_accounts: Array.isArray(data.meta_ad_accounts)
        ? data.meta_ad_accounts as unknown as MetaAdsAccount[]
        : [],
    } : null);
    setMonthlyAdsLimit(String(data?.limite_mensal_anuncios ?? 200));
    setLoadingMetaAds(false);
  };

  const handleConnectMetaAds = async () => {
    setSavingMetaAds(true);
    try {
      const { data, error } = await supabase.functions.invoke('meta-ads-oauth-start', {
        body: { returnTo: `${window.location.origin}/configuracoes` },
      });
      if (error || !data?.authorization_url) throw new Error(data?.error || 'Não foi possível iniciar a conexão.');
      window.location.href = data.authorization_url;
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erro ao conectar o Meta Ads.');
      setSavingMetaAds(false);
    }
  };

  const saveMetaAdsSettings = async (accountId?: string) => {
    if (!metaAdsConnection) return;
    const limit = Number(monthlyAdsLimit);
    if (!Number.isFinite(limit) || limit <= 0) {
      toast.error('Informe um limite mensal maior que zero.');
      return;
    }
    const selectedId = accountId || metaAdsConnection.meta_ad_account_id;
    const account = metaAdsConnection.meta_ad_accounts.find((item) => item.id === selectedId);
    setSavingMetaAds(true);
    const { error } = await supabase
      .from('integrations')
      .update({
        meta_ad_account_id: selectedId,
        meta_ad_account_name: account?.name || metaAdsConnection.meta_ad_account_name,
        meta_ad_account_currency: account?.currency || metaAdsConnection.meta_ad_account_currency,
        limite_mensal_anuncios: limit,
      })
      .eq('id', metaAdsConnection.id)
      .eq('platform', 'meta_ads');
    setSavingMetaAds(false);
    if (error) toast.error('Não foi possível salvar as preferências do Meta Ads.');
    else {
      toast.success('Preferências do Meta Ads salvas.');
      await fetchMetaAdsConnection();
    }
  };

  const handleDisconnectMetaAds = async () => {
    if (!window.confirm('Desconectar somente a integração Meta Ads?')) return;
    setSavingMetaAds(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('integrations').delete()
      .eq('user_id', user?.id || '')
      .eq('platform', 'meta_ads');
    setSavingMetaAds(false);
    if (error) toast.error('Não foi possível desconectar o Meta Ads.');
    else {
      setMetaAdsConnection(null);
      toast.success('Meta Ads desconectado. A conexão orgânica foi preservada.');
    }
  };

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
    fetchMetaAdsConnection();
    fetchTiktokConnection();
    fetchLinkedinConnection();

    const params = new URLSearchParams(window.location.search);
    if (params.get('linkedin') === 'conectado') {
      toast.success('✅ LinkedIn conectado com sucesso!');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('linkedin') === 'erro') {
      toast.error(`Falha ao conectar o LinkedIn: ${params.get('motivo') || 'erro'}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
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
    if (params.get('meta_ads') === 'connected') {
      toast.success('Meta Ads conectado com sucesso.');
      window.history.replaceState({}, '', window.location.pathname);
      fetchMetaAdsConnection();
    } else if (params.get('meta_ads') === 'error') {
      toast.error('Não foi possível conectar o Meta Ads.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleConnect = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? (await supabase.auth.getUser()).data.user;
    if (!user) {
      toast.error(t('settings.login_required_meta'));
      return;
    }
    window.location.href = buildMetaAuthUrl(user.id);
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Tem certeza que deseja remover esta página? Isso não pode ser desfeito.')) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setDisconnecting(true);
    try {
      const { error: e1 } = await supabase.from('meta_connections').delete().eq('user_id', user.id);
      const { error: e2 } = await supabase.from('integrations').delete().eq('user_id', user.id).eq('platform', 'meta');
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

        {customAuth && (
          <div className="mb-6 p-5 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Segurança da conta</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Altere a senha temporária recebida no primeiro acesso.
            </p>
            <button
              type="button"
              onClick={() => navigate('/alterar-senha')}
              className="mt-4 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded transition-colors"
            >
              Alterar senha
            </button>
          </div>
        )}

        <Tabs defaultValue="meta" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="meta">{t('settings.meta_tab')}</TabsTrigger>
            <TabsTrigger value="tiktok">{t('settings.tiktok_tab')}</TabsTrigger>
            <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
            <TabsTrigger value="marca">🎨 {t('settings.brand_tab')}</TabsTrigger>
          </TabsList>

          <TabsContent value="meta">
            <div className="space-y-6">
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
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md border-l-4 border-blue-600">
              <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-blue-600" /> Meta Ads
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Conexão separada para relatórios e criação de anúncios. Ela não altera sua integração orgânica de Facebook e Instagram.
              </p>
              {loadingMetaAds ? (
                <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-5 h-5 animate-spin" /> Carregando conexão…</div>
              ) : metaAdsConnection ? (
                <div className="space-y-5">
                  <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">✅ Conectado</span>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium mb-1">Conta de anúncios</label>
                      <select
                        className="w-full rounded-md border border-gray-300 bg-white p-2 dark:border-gray-600 dark:bg-gray-900"
                        value={metaAdsConnection.meta_ad_account_id || ''}
                        onChange={(event) => {
                          const account = metaAdsConnection.meta_ad_accounts.find((item) => item.id === event.target.value);
                          setMetaAdsConnection({ ...metaAdsConnection, meta_ad_account_id: event.target.value, meta_ad_account_name: account?.name, meta_ad_account_currency: account?.currency });
                        }}
                      >
                        {metaAdsConnection.meta_ad_accounts.map((account) => (
                          <option key={account.id} value={account.id}>{account.name || account.id} {account.currency ? `(${account.currency})` : ''}</option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-gray-500">Atual: {metaAdsConnection.meta_ad_account_name || metaAdsConnection.meta_ad_account_id}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Limite mensal de anúncios (R$)</label>
                      <input className="w-full rounded-md border border-gray-300 bg-white p-2 dark:border-gray-600 dark:bg-gray-900" type="number" min="1" step="0.01" value={monthlyAdsLimit} onChange={(event) => setMonthlyAdsLimit(event.target.value)} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button onClick={() => saveMetaAdsSettings()} disabled={savingMetaAds} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded">Salvar Meta Ads</button>
                    <button onClick={() => navigate('/anuncios-meta')} className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 font-bold py-2 px-4 rounded">Abrir painel</button>
                    <button onClick={handleConnectMetaAds} disabled={savingMetaAds} className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 font-bold py-2 px-4 rounded">Reconectar</button>
                    <button onClick={handleDisconnectMetaAds} disabled={savingMetaAds} className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded">Desconectar Meta Ads</button>
                  </div>
                </div>
              ) : (
                <div>
                  <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600 mb-4">Não conectado</span>
                  <div><button onClick={handleConnectMetaAds} disabled={savingMetaAds} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded">{savingMetaAds ? 'Conectando…' : 'Conectar Meta Ads'}</button></div>
                </div>
              )}
            </div>
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
                    {tiktokConnection.verification_unavailable && (
                      <p className="text-yellow-700 dark:text-yellow-400 font-medium">
                        ⚠️ Não foi possível verificar o TikTok agora. A conexão continua ativa.
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
                Publique no seu perfil pessoal. O link entra no fim do post; assim que a permissão de parceiro do LinkedIn for aprovada, ele volta para o primeiro comentário automaticamente.
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
