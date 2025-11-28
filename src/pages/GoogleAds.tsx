import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  ExternalLink, 
  TrendingUp, 
  DollarSign, 
  Eye, 
  MousePointerClick,
  Play,
  Pause,
  RefreshCw,
  Plus,
  ArrowLeft,
  Settings
} from 'lucide-react';
import { toast } from 'sonner';

interface GoogleAdsConfig {
  id: string;
  user_id: string;
  customer_id: string | null;
  account_email: string | null;
  connected_at: string;
}

interface GoogleAdsCampaign {
  id: string;
  campaign_id: string;
  name: string;
  status: string;
  budget_daily: number;
  budget_total: number | null;
  start_date: string;
  end_date: string | null;
  keywords: string[];
  targeting: Record<string, unknown>;
  metrics: {
    impressions?: number;
    clicks?: number;
    ctr?: number;
    cpc?: number;
    conversions?: number;
    cost?: number;
    last_sync?: string;
  };
  produtos?: {
    id: string;
    nome: string;
    imagem_url: string | null;
  };
}

export default function GoogleAds() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [connected, setConnected] = useState(false);
  const [config, setConfig] = useState<GoogleAdsConfig | null>(null);
  const [campaigns, setCampaigns] = useState<GoogleAdsCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  
  // Modal criar campanha
  const [modalCriar, setModalCriar] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    budgetDaily: '',
    budgetTotal: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    keywords: '',
    targeting: {
      location: 'BR',
      age: '18-65',
      interests: [] as string[]
    },
    produtoId: null as string | null,
    bibliotecaCampanhaId: null as string | null
  });

  useEffect(() => {
    verificarConexao();
    carregarCampanhas();

    // Verificar se voltou do OAuth
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    
    if (success === 'true') {
      toast.success('✅ Google Ads conectado com sucesso!');
      verificarConexao();
    } else if (error) {
      toast.error('Erro ao conectar: ' + error);
    }
  }, [searchParams]);

  const verificarConexao = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data } = await supabase
      .from('google_ads_config')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setConnected(true);
      setConfig(data as GoogleAdsConfig);
    }
    
    setLoading(false);
  };

  const conectarGoogleAds = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Faça login primeiro');
      return;
    }

    try {
      toast.info('Redirecionando para Google...');
      
      const res = await supabase.functions.invoke('google-ads-auth', {
        body: { userId: user.id }
      });

      if (res.data?.authUrl) {
        window.location.href = res.data.authUrl;
      } else {
        toast.error(res.data?.error || 'Erro ao gerar URL de autorização');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error('Erro ao conectar: ' + errorMessage);
    }
  };

  const desconectar = async () => {
    const confirmar = window.confirm('Deseja desconectar o Google Ads?');
    if (!confirmar) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('google_ads_config')
      .delete()
      .eq('user_id', user.id);

    setConnected(false);
    setConfig(null);
    toast.success('Desconectado com sucesso');
  };

  const carregarCampanhas = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('google_ads_campaigns')
      .select(`
        *,
        produtos (
          id,
          nome,
          imagem_url
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    setCampaigns((data || []) as GoogleAdsCampaign[]);
  };

  const criarCampanha = async () => {
    if (!formData.name || !formData.budgetDaily || !formData.startDate) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setCreating(true);

    try {
      const res = await supabase.functions.invoke('google-ads-create-campaign', {
        body: {
          userId: user.id,
          campaignName: formData.name,
          budgetDaily: parseFloat(formData.budgetDaily),
          budgetTotal: formData.budgetTotal ? parseFloat(formData.budgetTotal) : null,
          startDate: formData.startDate,
          endDate: formData.endDate || null,
          keywords: formData.keywords.split(',').map(k => k.trim()).filter(Boolean),
          targeting: formData.targeting,
          produtoId: formData.produtoId,
          bibliotecaCampanhaId: formData.bibliotecaCampanhaId
        }
      });

      if (res.data?.success) {
        toast.success('✅ Campanha criada com sucesso!');
        setModalCriar(false);
        setFormData({
          name: '',
          budgetDaily: '',
          budgetTotal: '',
          startDate: new Date().toISOString().split('T')[0],
          endDate: '',
          keywords: '',
          targeting: { location: 'BR', age: '18-65', interests: [] },
          produtoId: null,
          bibliotecaCampanhaId: null
        });
        carregarCampanhas();
      } else {
        toast.error(res.data?.error || 'Erro ao criar campanha');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error('Erro: ' + errorMessage);
    }

    setCreating(false);
  };

  const sincronizarMetricas = async () => {
    setSyncing(true);
    toast.info('Sincronizando métricas...');

    try {
      const res = await supabase.functions.invoke('google-ads-sync-metrics');
      
      if (res.data?.success) {
        toast.success(`✅ ${res.data.synced} campanhas atualizadas!`);
        carregarCampanhas();
      } else {
        toast.error(res.data?.error || 'Erro ao sincronizar');
      }
    } catch {
      toast.error('Erro ao sincronizar métricas');
    }

    setSyncing(false);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">🎯 Google Ads</h1>
            <p className="text-muted-foreground">
              Crie e gerencie campanhas de anúncios
            </p>
          </div>
        </div>

        {connected && (
          <Button onClick={sincronizarMetricas} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Sincronizar Métricas
          </Button>
        )}
      </div>

      {/* STATUS CONEXÃO */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Status da Conexão
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!connected ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <ExternalLink className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Conecte sua conta Google Ads</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Conecte sua conta do Google Ads para criar campanhas de remarketing 
                e alcançar seus clientes em toda a rede do Google.
              </p>
              <Button onClick={conectarGoogleAds} size="lg">
                <ExternalLink className="w-4 h-4 mr-2" />
                Conectar Google Ads
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-green-500">✓ Conectado</Badge>
                  </div>
                  <p className="text-sm">
                    <strong>Email:</strong> {config?.account_email || 'N/A'}
                  </p>
                  <p className="text-sm">
                    <strong>Customer ID:</strong> {config?.customer_id || 'Não configurado'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Conectado em: {config?.connected_at ? new Date(config.connected_at).toLocaleString('pt-BR') : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => setModalCriar(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Campanha
                </Button>
                <Button variant="outline" onClick={desconectar}>
                  Desconectar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* LISTA DE CAMPANHAS */}
      {connected && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">
              Campanhas ({campaigns.length})
            </h2>
          </div>

          {campaigns.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Nenhuma campanha criada</h3>
                <p className="text-muted-foreground mb-6">
                  Crie sua primeira campanha para começar a anunciar no Google
                </p>
                <Button onClick={() => setModalCriar(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeira Campanha
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {campaigns.map(campaign => (
                <Card key={campaign.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {campaign.produtos?.imagem_url && (
                          <img
                            src={campaign.produtos.imagem_url}
                            alt={campaign.produtos.nome}
                            className="w-12 h-12 object-cover rounded"
                          />
                        )}
                        <div>
                          <CardTitle className="text-lg">{campaign.name}</CardTitle>
                          {campaign.produtos && (
                            <p className="text-xs text-muted-foreground">
                              {campaign.produtos.nome}
                            </p>
                          )}
                        </div>
                      </div>

                      <Badge className={
                        campaign.status === 'ENABLED' ? 'bg-green-500' : 
                        campaign.status === 'DRAFT' ? 'bg-yellow-500' : 'bg-gray-500'
                      }>
                        {campaign.status === 'ENABLED' ? '🚀 Ativa' : 
                         campaign.status === 'DRAFT' ? '📝 Rascunho' : '⏸️ Pausada'}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {/* ORÇAMENTO */}
                    <div className="mb-4 p-3 bg-primary/10 rounded-lg">
                      <p className="text-xs text-muted-foreground">Orçamento Diário</p>
                      <p className="text-xl font-bold">
                        R$ {campaign.budget_daily?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    {/* MÉTRICAS */}
                    {campaign.metrics && Object.keys(campaign.metrics).length > 0 && (
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="p-2 bg-muted rounded">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <Eye className="w-3 h-3" />
                            Impressões
                          </div>
                          <p className="font-bold">
                            {campaign.metrics.impressions?.toLocaleString() || 0}
                          </p>
                        </div>

                        <div className="p-2 bg-muted rounded">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <MousePointerClick className="w-3 h-3" />
                            Cliques
                          </div>
                          <p className="font-bold">
                            {campaign.metrics.clicks?.toLocaleString() || 0}
                          </p>
                        </div>

                        <div className="p-2 bg-muted rounded">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <TrendingUp className="w-3 h-3" />
                            CTR
                          </div>
                          <p className="font-bold">
                            {((campaign.metrics.ctr || 0) * 100).toFixed(2)}%
                          </p>
                        </div>

                        <div className="p-2 bg-muted rounded">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <DollarSign className="w-3 h-3" />
                            CPC
                          </div>
                          <p className="font-bold">
                            R$ {campaign.metrics.cpc?.toFixed(2) || '0.00'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* KEYWORDS */}
                    {campaign.keywords && campaign.keywords.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-muted-foreground mb-2">Palavras-chave:</p>
                        <div className="flex flex-wrap gap-1">
                          {campaign.keywords.slice(0, 5).map((keyword, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {keyword}
                            </Badge>
                          ))}
                          {campaign.keywords.length > 5 && (
                            <Badge variant="outline" className="text-xs">
                              +{campaign.keywords.length - 5}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* AÇÕES */}
                    <div className="flex gap-2 pt-3 border-t">
                      {campaign.status !== 'DRAFT' && (
                        <Button size="sm" variant="outline" className="flex-1">
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Ver no Google Ads
                        </Button>
                      )}
                      
                      {campaign.status === 'ENABLED' ? (
                        <Button size="sm" variant="outline">
                          <Pause className="w-3 h-3" />
                        </Button>
                      ) : campaign.status === 'PAUSED' ? (
                        <Button size="sm" variant="outline">
                          <Play className="w-3 h-3" />
                        </Button>
                      ) : null}
                    </div>

                    {/* ÚLTIMA SYNC */}
                    {campaign.metrics?.last_sync && (
                      <p className="text-xs text-muted-foreground mt-2 text-right">
                        Última atualização: {new Date(campaign.metrics.last_sync).toLocaleString('pt-BR')}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL CRIAR CAMPANHA */}
      <Dialog open={modalCriar} onOpenChange={setModalCriar}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Campanha Google Ads</DialogTitle>
            <DialogDescription>
              Configure sua campanha de anúncios para alcançar mais clientes
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nome da Campanha *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Promoção Verão 2024"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Orçamento Diário (R$) *</Label>
                <Input
                  type="number"
                  value={formData.budgetDaily}
                  onChange={(e) => setFormData({ ...formData, budgetDaily: e.target.value })}
                  placeholder="50.00"
                />
              </div>

              <div>
                <Label>Orçamento Total (R$)</Label>
                <Input
                  type="number"
                  value={formData.budgetTotal}
                  onChange={(e) => setFormData({ ...formData, budgetTotal: e.target.value })}
                  placeholder="1500.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data Início *</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <Label>Data Fim (opcional)</Label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Palavras-chave (separadas por vírgula) *</Label>
              <Textarea
                value={formData.keywords}
                onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                placeholder="comprar produto, promoção, oferta especial"
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Digite palavras-chave relevantes para seu produto ou serviço
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={criarCampanha}
                disabled={creating}
                className="flex-1"
              >
                {creating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar Campanha'
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setModalCriar(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
