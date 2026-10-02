import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BarChart3, Loader2, Megaphone, Pause, Play, RefreshCw, Search, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import MediaPicker, { MetaAdsMedia } from '@/components/meta-ads/MediaPicker';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

type Target = { id?: string; key?: string; name: string; region?: string };
type Campaign = {
  id: string;
  nome: string;
  status: string;
  campaign_id: string | null;
  adset_id: string | null;
  creative_id: string | null;
  ad_id: string | null;
  gasto_maximo: number;
  created_at: string;
};
type Insight = {
  campaign_id?: string;
  campaign_name?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  spend?: string;
  ctr?: string;
};

const steps = ['Objetivo', 'Público', 'Orçamento', 'Criativo e revisão'];

function functionError(error: unknown, data?: { error?: string }) {
  return data?.error || (error instanceof Error ? error.message : 'Não foi possível concluir a operação.');
}

export default function AnunciosMeta() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState('');
  const [connected, setConnected] = useState<boolean | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [period, setPeriod] = useState('last_30d');
  const [currency, setCurrency] = useState('BRL');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [media, setMedia] = useState<MetaAdsMedia | null>(null);
  const [dailyBudget, setDailyBudget] = useState(10);
  const [maxSpend, setMaxSpend] = useState(100);
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState(65);
  const [cityQuery, setCityQuery] = useState('');
  const [interestQuery, setInterestQuery] = useState('');
  const [cities, setCities] = useState<Target[]>([]);
  const [interests, setInterests] = useState<Target[]>([]);
  const [selectedCities, setSelectedCities] = useState<Target[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<Target[]>([]);
  const [productTitle, setProductTitle] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productRating, setProductRating] = useState('');
  const [productLink, setProductLink] = useState('');
  const [draftId, setDraftId] = useState<string | null>(null);
  const [previews, setPreviews] = useState<{ format: string; body: string | null }[]>([]);
  const [publishedIds, setPublishedIds] = useState<Record<string, string> | null>(null);

  const loadCampaigns = async () => {
    const { data } = await supabase
      .from('meta_ads_campanhas')
      .select('id,nome,status,campaign_id,adset_id,creative_id,ad_id,gasto_maximo,created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    setCampaigns((data as Campaign[] | null) ?? []);
  };

  const loadConnection = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setConnected(false);
      return;
    }
    const { data } = await supabase
      .from('integrations')
      .select('id,meta_ad_account_id,is_active')
      .eq('user_id', user.id)
      .eq('platform', 'meta_ads')
      .maybeSingle();
    setConnected(Boolean(data?.is_active && data?.meta_ad_account_id));
  };

  const loadInsights = useCallback(async () => {
    setBusy('insights');
    const { data, error } = await supabase.functions.invoke('meta-ads-insights', {
      body: { date_preset: period, level: 'campaign' },
    });
    if (error || !data?.success) {
      toast.error(functionError(error, data));
    } else {
      setInsights(data.data ?? []);
      setCurrency(data.currency || 'BRL');
    }
    setBusy('');
  }, [period]);

  useEffect(() => {
    void loadConnection();
    void loadCampaigns();
  }, []);

  useEffect(() => {
    if (connected) void loadInsights();
  }, [connected, loadInsights]);

  const totals = useMemo(() => insights.reduce((acc, item) => ({
    impressions: acc.impressions + Number(item.impressions || 0),
    reach: acc.reach + Number(item.reach || 0),
    clicks: acc.clicks + Number(item.clicks || 0),
    spend: acc.spend + Number(item.spend || 0),
  }), { impressions: 0, reach: 0, clicks: 0, spend: 0 }), [insights]);

  const searchTarget = async (type: 'city' | 'interest') => {
    const query = type === 'city' ? cityQuery : interestQuery;
    if (query.trim().length < 2) return;
    setBusy(type);
    const { data, error } = await supabase.functions.invoke('meta-ads-targeting-search', { body: { query, type } });
    if (error || !data?.success) toast.error(functionError(error, data));
    else (type === 'city' ? setCities : setInterests)(data.data ?? []);
    setBusy('');
  };

  const generateCopy = async () => {
    if (!productTitle.trim()) {
      toast.error('Informe o título do produto ou serviço.');
      return;
    }
    setBusy('ai');
    const { data, error } = await supabase.functions.invoke('gerar-conteudo-ia', {
      body: {
        productTitle,
        productPrice,
        productRating,
        productLink,
        platform: 'facebook',
      },
    });
    if (error || typeof data?.content !== 'string') toast.error(functionError(error, data));
    else {
      setMessage(data.content);
      if (!name) setName(productTitle.slice(0, 120));
      toast.success('Texto gerado. Revise e edite antes de continuar.');
    }
    setBusy('');
  };

  const draftBody = () => ({
    name: name.trim(),
    message: message.trim(),
    mediaUrl: media?.midia_url || '',
    mediaType: media?.tipo === 'video' ? 'video' : 'image',
    dailyBudget: Number(dailyBudget),
    maxSpend: Number(maxSpend),
    cityKeys: selectedCities.map((item) => item.key!),
    interestIds: selectedInterests.map((item) => item.id!),
    minAge: Number(minAge),
    maxAge: Number(maxAge),
  });

  const createDraft = async () => {
    setBusy('draft');
    const { data, error } = await supabase.functions.invoke('meta-ads-draft', { body: draftBody() });
    setBusy('');
    if (error || !data?.success || !data?.campaign?.id) {
      toast.error(functionError(error, data));
      return null;
    }
    setDraftId(data.campaign.id);
    await loadCampaigns();
    toast.success('Rascunho salvo.');
    return String(data.campaign.id);
  };

  const createPreview = async () => {
    const id = draftId || await createDraft();
    if (!id) return;
    setBusy('preview');
    const { data, error } = await supabase.functions.invoke('meta-ads-preview', { body: { campaign_id: id } });
    setBusy('');
    if (error || !data?.success) toast.error(functionError(error, data));
    else {
      setPreviews(data.previews ?? []);
      toast.success('Prévia oficial gerada pela Meta.');
    }
  };

  const publish = async () => {
    if (!draftId || previews.length === 0) {
      toast.error('Salve e gere a prévia oficial antes de publicar.');
      return;
    }
    if (!window.confirm(`Confirmar publicação com gasto máximo de R$ ${Number(maxSpend).toFixed(2)}?`)) return;
    setBusy('publish');
    const { data, error } = await supabase.functions.invoke('meta-ads-publish', {
      body: { campaign_id: draftId, confirmed: true },
    });
    setBusy('');
    const result = data?.campaign;
    const complete = result?.campaign_id && result?.adset_id && result?.creative_id && result?.ad_id;
    if (error || !data?.success || !complete) {
      toast.error(error || !data?.success ? functionError(error, data) : 'A Meta não confirmou todos os IDs. Verifique o status antes de tentar novamente.');
      return;
    }
    setPublishedIds(result);
    toast.success('Campanha publicada e confirmada pela Meta.');
    await loadCampaigns();
    await loadInsights();
  };

  const campaignAction = async (campaignId: string, action: 'pause' | 'activate' | 'status') => {
    setBusy(`${action}-${campaignId}`);
    const { data, error } = await supabase.functions.invoke('meta-ads-campaign-action', {
      body: { campaign_id: campaignId, action },
    });
    setBusy('');
    if (error || !data?.success) toast.error(functionError(error, data));
    else {
      toast.success(action === 'status' ? 'Status atualizado pela Meta.' : action === 'pause' ? 'Campanha pausada.' : 'Campanha ativada.');
      await loadCampaigns();
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => navigate('/configuracoes')}><ArrowLeft className="h-4 w-4" /></Button>
            <div><h1 className="text-3xl font-bold">Anúncios Meta</h1><p className="text-muted-foreground">Resultados e criação segura de campanhas para WhatsApp.</p></div>
          </div>
          <Badge variant={connected ? 'default' : 'secondary'}>{connected ? 'Meta Ads conectado' : 'Meta Ads não conectado'}</Badge>
        </div>

        {!connected && connected !== null && (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <span>Conecte uma conta de anúncios em Configurações para usar este painel.</span>
              <Button onClick={() => navigate('/configuracoes')}>Configurar Meta Ads</Button>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="results">
          <TabsList><TabsTrigger value="results"><BarChart3 className="mr-2 h-4 w-4" />Resultados</TabsTrigger><TabsTrigger value="create"><Megaphone className="mr-2 h-4 w-4" />Criar anúncio</TabsTrigger></TabsList>
          <TabsContent value="results" className="space-y-5">
            <div className="flex justify-end gap-2">
              <select className="rounded-md border bg-background px-3 text-sm" value={period} onChange={(event) => setPeriod(event.target.value)}>
                <option value="last_7d">Últimos 7 dias</option><option value="last_30d">Últimos 30 dias</option><option value="this_month">Este mês</option><option value="last_month">Mês passado</option>
              </select>
              <Button variant="outline" onClick={loadInsights} disabled={!connected || busy === 'insights'}><RefreshCw className={`mr-2 h-4 w-4 ${busy === 'insights' ? 'animate-spin' : ''}`} />Atualizar</Button>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              {[['Impressões', totals.impressions.toLocaleString('pt-BR')], ['Alcance', totals.reach.toLocaleString('pt-BR')], ['Cliques', totals.clicks.toLocaleString('pt-BR')], ['Investimento', new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(totals.spend)]].map(([label, value]) => <Card key={label}><CardContent className="p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></CardContent></Card>)}
            </div>
            <Card><CardHeader><CardTitle>Desempenho por campanha</CardTitle></CardHeader><CardContent className="space-y-3">
              {insights.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum resultado no período.</p> : insights.map((item, index) => (
                <div key={`${item.campaign_id}-${index}`} className="grid gap-2 rounded-md border p-3 text-sm md:grid-cols-5">
                  <strong>{item.campaign_name || 'Campanha'}</strong><span>{Number(item.impressions || 0).toLocaleString('pt-BR')} impressões</span><span>{Number(item.clicks || 0).toLocaleString('pt-BR')} cliques</span><span>CTR {Number(item.ctr || 0).toFixed(2)}%</span><span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(Number(item.spend || 0))}</span>
                </div>
              ))}
            </CardContent></Card>
            <Card><CardHeader><CardTitle>Campanhas criadas aqui</CardTitle><CardDescription>Pausar e ativar sempre consulta a função oficial da Meta.</CardDescription></CardHeader><CardContent className="space-y-2">
              {campaigns.map((campaign) => (
                <div key={campaign.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                  <div><strong>{campaign.nome}</strong><div className="text-xs text-muted-foreground">{campaign.status} · limite R$ {Number(campaign.gasto_maximo).toFixed(2)}</div></div>
                  {campaign.campaign_id && <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => campaignAction(campaign.id, 'status')} disabled={busy.endsWith(campaign.id)}><RefreshCw className="mr-1 h-3 w-3" />Status</Button>
                    {campaign.status === 'pausado' ? <Button size="sm" onClick={() => campaignAction(campaign.id, 'activate')} disabled={busy.endsWith(campaign.id)}><Play className="mr-1 h-3 w-3" />Ativar</Button> : <Button size="sm" variant="destructive" onClick={() => campaignAction(campaign.id, 'pause')} disabled={busy.endsWith(campaign.id)}><Pause className="mr-1 h-3 w-3" />Pausar</Button>}
                  </div>}
                </div>
              ))}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="create">
            <Card>
              <CardHeader><div className="flex flex-wrap gap-2">{steps.map((label, index) => <Badge key={label} variant={step === index ? 'default' : 'outline'}>{index + 1}. {label}</Badge>)}</div></CardHeader>
              <CardContent className="space-y-6">
                {step === 0 && <div className="space-y-5">
                  <div className="rounded-md border bg-muted/40 p-4"><strong>Objetivo: receber conversas no WhatsApp</strong><p className="text-sm text-muted-foreground">Esta fase usa Engajamento/Conversas, o objetivo seguro suportado pelo backend.</p></div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div><Label>Título do produto ou serviço *</Label><Input value={productTitle} onChange={(e) => setProductTitle(e.target.value)} placeholder="Ex.: Consultoria financeira" /></div>
                    <div><Label>Preço</Label><Input value={productPrice} onChange={(e) => setProductPrice(e.target.value)} placeholder="Ex.: R$ 99,90" /></div>
                    <div><Label>Avaliação</Label><Input value={productRating} onChange={(e) => setProductRating(e.target.value)} placeholder="Ex.: 4,8" /></div>
                    <div><Label>Link do produto/serviço</Label><Input value={productLink} onChange={(e) => setProductLink(e.target.value)} placeholder="https://…" /></div>
                  </div>
                  <Button onClick={generateCopy} disabled={busy === 'ai'}><Sparkles className="mr-2 h-4 w-4" />{busy === 'ai' ? 'Gerando…' : 'Gerar texto com IA'}</Button>
                </div>}
                {step === 1 && <div className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2"><div><Label>Idade mínima</Label><Input type="number" min={18} max={65} value={minAge} onChange={(e) => setMinAge(Number(e.target.value))} /></div><div><Label>Idade máxima</Label><Input type="number" min={18} max={65} value={maxAge} onChange={(e) => setMaxAge(Number(e.target.value))} /></div></div>
                  {(['city', 'interest'] as const).map((type) => {
                    const query = type === 'city' ? cityQuery : interestQuery;
                    const setQuery = type === 'city' ? setCityQuery : setInterestQuery;
                    const results = type === 'city' ? cities : interests;
                    const selected = type === 'city' ? selectedCities : selectedInterests;
                    const setSelected = type === 'city' ? setSelectedCities : setSelectedInterests;
                    return <div key={type} className="space-y-2"><Label>{type === 'city' ? 'Cidades (opcional; padrão: Brasil)' : 'Interesses (opcional)'}</Label><div className="flex gap-2"><Input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchTarget(type)} /><Button type="button" variant="outline" onClick={() => searchTarget(type)}><Search className="h-4 w-4" /></Button></div><div className="flex flex-wrap gap-2">{results.map((item) => <button type="button" className="rounded-full border px-3 py-1 text-xs hover:bg-muted" key={item.key || item.id} onClick={() => !selected.some((value) => (value.key || value.id) === (item.key || item.id)) && setSelected([...selected, item])}>{item.name}{item.region ? `, ${item.region}` : ''} +</button>)}</div><div className="flex flex-wrap gap-2">{selected.map((item) => <Badge key={item.key || item.id} className="cursor-pointer" onClick={() => setSelected(selected.filter((value) => (value.key || value.id) !== (item.key || item.id)))}>{item.name} ×</Badge>)}</div></div>;
                  })}
                </div>}
                {step === 2 && <div className="grid gap-4 md:grid-cols-2">
                  <div><Label>Orçamento diário (R$)</Label><Input type="number" min={1} step="0.01" value={dailyBudget} onChange={(e) => setDailyBudget(Number(e.target.value))} /></div>
                  <div><Label>Gasto máximo da campanha (R$)</Label><Input type="number" min={dailyBudget} step="0.01" value={maxSpend} onChange={(e) => setMaxSpend(Number(e.target.value))} /><p className="mt-1 text-xs text-muted-foreground">Também sujeito ao limite mensal configurado.</p></div>
                </div>}
                {step === 3 && <div className="space-y-5">
                  <div><Label>Título da campanha *</Label><Input maxLength={120} value={name} onChange={(e) => { setName(e.target.value); setDraftId(null); setPreviews([]); }} /></div>
                  <div><Label>Texto principal *</Label><Textarea rows={7} maxLength={2200} value={message} onChange={(e) => { setMessage(e.target.value); setDraftId(null); setPreviews([]); }} /><p className="text-right text-xs text-muted-foreground">{message.length}/2200</p></div>
                  <MediaPicker value={media} onChange={(value) => { setMedia(value); setDraftId(null); setPreviews([]); }} />
                  <div className="rounded-md border p-4 text-sm">
                    <strong>Antes de publicar</strong>
                    <div className="mt-2 flex flex-wrap gap-3">
                      <a className="text-primary underline" href="https://business.facebook.com/billing_hub" target="_blank" rel="noreferrer">Forma de pagamento</a>
                      <button className="text-primary underline" onClick={() => navigate('/configuracoes')}>Página do Facebook</button>
                      <button className="text-primary underline" onClick={() => navigate('/configuracoes-whatsapp')}>WhatsApp ativo</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={createDraft} disabled={Boolean(busy)}>{busy === 'draft' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar rascunho</Button><Button variant="outline" onClick={createPreview} disabled={Boolean(busy)}>{busy === 'preview' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Gerar prévia oficial</Button><Button onClick={publish} disabled={Boolean(busy) || !draftId || previews.length === 0}>{busy === 'publish' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar e publicar</Button></div>
                  {previews.length > 0 && <div className="grid gap-3 md:grid-cols-2">{previews.map((preview) => <div key={preview.format} className="rounded-md border p-3"><p className="mb-2 text-xs font-semibold">{preview.format}</p>{preview.body ? <iframe title={preview.format} srcDoc={preview.body} sandbox="" className="h-96 w-full border-0" /> : <p className="text-sm text-muted-foreground">Formato indisponível.</p>}</div>)}</div>}
                  {publishedIds && <div className="rounded-md border border-green-300 bg-green-50 p-4 text-sm text-green-900"><strong>Publicação confirmada.</strong><p>Campanha, conjunto, criativo e anúncio retornaram IDs válidos.</p></div>}
                </div>}
                <div className="flex justify-between border-t pt-4"><Button variant="outline" disabled={step === 0} onClick={() => setStep((value) => value - 1)}>Voltar</Button>{step < 3 && <Button onClick={() => setStep((value) => value + 1)}>Continuar</Button>}</div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
