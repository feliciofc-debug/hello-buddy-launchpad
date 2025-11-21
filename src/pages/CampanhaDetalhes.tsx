import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { ArrowLeft, Pause, Play, Loader2, TrendingUp, Users, MessageSquare, CheckCircle2, Clock, AlertCircle, Sparkles } from 'lucide-react';
import { VoiceCallDashboard } from '@/components/VoiceCallDashboard';

export default function CampanhaDetalhes() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campanha, setCampanha] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [qualifying, setQualifying] = useState(false);
  const [generatingMessages, setGeneratingMessages] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Atualizar a cada 5 segundos
    return () => clearInterval(interval);
  }, [id]);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      // Carregar campanha
      const { data: campanhaData, error: campanhaError } = await supabase
        .from('campanhas_prospeccao')
        .select('*, icp_configs(*)')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (campanhaError) throw campanhaError;
      setCampanha(campanhaData);

      // Carregar alguns leads (top qualificados) da tabela correta
      const tabela = campanhaData.tipo === 'b2c' ? 'leads_b2c' : 'leads_b2b';
      const { data: leadsData, error: leadsError } = await supabase
        .from(tabela)
        .select('*')
        .eq('campanha_id', id)
        .eq('pipeline_status', 'qualificado')
        .order('score', { ascending: false })
        .limit(5);

      if (leadsError) throw leadsError;
      setLeads(leadsData || []);

    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!campanha) return;
    
    setProcessing(true);
    try {
      const novoStatus = campanha.status === 'ativa' ? 'pausada' : 'ativa';
      
      const { error } = await supabase
        .from('campanhas_prospeccao')
        .update({ status: novoStatus })
        .eq('id', id);

      if (error) throw error;

      toast.success(novoStatus === 'ativa' ? '▶️ Campanha ativada' : '⏸️ Campanha pausada');
      loadData();
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleEnriquecerLeads = async () => {
    if (!id) return;
    
    setEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke('enrich-lead-bulk', {
        body: { campanha_id: id }
      });

      if (error) throw error;

      toast.success(`✨ ${data.processados} leads enriquecidos com sucesso!`);
      loadData();
    } catch (error: any) {
      console.error('Erro ao enriquecer leads:', error);
      toast.error('Erro ao enriquecer leads: ' + error.message);
    } finally {
      setEnriching(false);
    }
  };

  const handleQualificarLeads = async () => {
    if (!id) return;
    
    setQualifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('qualify-prospect', {
        body: { campanha_id: id }
      });

      if (error) throw error;

      toast.success(`🎯 ${data.processados || 0} leads qualificados!`);
      loadData();
    } catch (error: any) {
      console.error('Erro ao qualificar leads:', error);
      toast.error('Erro ao qualificar leads: ' + error.message);
    } finally {
      setQualifying(false);
    }
  };

  const handleGerarMensagens = async () => {
    if (!id) return;
    
    setGeneratingMessages(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-message', {
        body: { campanha_id: id }
      });

      if (error) throw error;

      toast.success(`💬 ${data.processados || 0} mensagens geradas!`);
      loadData();
    } catch (error: any) {
      console.error('Erro ao gerar mensagens:', error);
      toast.error('Erro ao gerar mensagens: ' + error.message);
    } finally {
      setGeneratingMessages(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      rascunho: { variant: 'secondary', label: 'Rascunho', icon: Clock },
      ativa: { variant: 'default', label: 'Ativa', icon: CheckCircle2 },
      pausada: { variant: 'outline', label: 'Pausada', icon: Pause },
      concluida: { variant: 'secondary', label: 'Concluída', icon: CheckCircle2 }
    };
    const config = variants[status] || variants.rascunho;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getPipelineStage = (stats: any) => {
    const descobertos = stats?.descobertos || 0;
    const enriquecidos = stats?.enriquecidos || 0;
    const qualificados = stats?.qualificados || 0;
    const mensagens = stats?.mensagens_geradas || 0;

    return [
      {
        label: 'Descoberta',
        value: descobertos,
        status: descobertos > 0 ? 'completed' : 'pending',
        icon: CheckCircle2
      },
      {
        label: 'Enriquecimento',
        value: enriquecidos,
        total: descobertos,
        status: enriquecidos > 0 ? (enriquecidos === descobertos ? 'completed' : 'in-progress') : 'pending',
        icon: descobertos > 0 ? Loader2 : Clock
      },
      {
        label: 'Qualificação',
        value: qualificados,
        total: enriquecidos,
        status: qualificados > 0 ? (qualificados === enriquecidos ? 'completed' : 'in-progress') : 'pending',
        icon: enriquecidos > 0 ? Loader2 : Clock
      },
      {
        label: 'Mensagens',
        value: mensagens,
        total: qualificados,
        status: mensagens > 0 ? (mensagens === qualificados ? 'completed' : 'in-progress') : 'pending',
        icon: qualificados > 0 ? Loader2 : Clock
      }
    ];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!campanha) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Campanha não encontrada</h2>
        <Button onClick={() => navigate('/campanhas-prospeccao')}>Voltar</Button>
      </div>
    );
  }

  const stats = campanha.stats || {};
  const meta = campanha.meta_leads_total || 100;
  const descobertos = stats.descobertos || 0;
  const progresso = Math.min((descobertos / meta) * 100, 100);
  const pipeline = getPipelineStage(stats);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/campanhas-prospeccao')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-3xl font-bold">{campanha.nome}</h1>
                {getStatusBadge(campanha.status)}
                <Badge variant="outline">{campanha.tipo.toUpperCase()}</Badge>
              </div>
              <p className="text-muted-foreground">{campanha.descricao}</p>
            </div>
          </div>
          <Button 
            onClick={handleToggleStatus}
            disabled={processing}
            variant={campanha.status === 'ativa' ? 'outline' : 'default'}
          >
            {processing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : campanha.status === 'ativa' ? (
              <Pause className="mr-2 h-4 w-4" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            {campanha.status === 'ativa' ? 'Pausar' : 'Retomar'}
          </Button>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Descobertos</CardDescription>
              <CardTitle className="text-3xl">{stats.descobertos || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={(stats.descobertos / meta) * 100} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                {Math.round((stats.descobertos / meta) * 100)}% da meta
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Enriquecidos</CardDescription>
              <CardTitle className="text-3xl">{stats.enriquecidos || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <Progress 
                value={stats.descobertos > 0 ? (stats.enriquecidos / stats.descobertos) * 100 : 0} 
                className="h-2" 
              />
              <p className="text-xs text-muted-foreground mt-2">
                {stats.descobertos > 0 
                  ? Math.round((stats.enriquecidos / stats.descobertos) * 100)
                  : 0}% enriquecidos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Qualificados</CardDescription>
              <CardTitle className="text-3xl">{stats.qualificados || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <Progress 
                value={stats.enriquecidos > 0 ? (stats.qualificados / stats.enriquecidos) * 100 : 0} 
                className="h-2" 
              />
              <p className="text-xs text-muted-foreground mt-2">
                {stats.enriquecidos > 0 
                  ? Math.round((stats.qualificados / stats.enriquecidos) * 100)
                  : 0}% qualificados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Mensagens</CardDescription>
              <CardTitle className="text-3xl">{stats.mensagens_geradas || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <Progress 
                value={stats.qualificados > 0 ? (stats.mensagens_geradas / stats.qualificados) * 100 : 0} 
                className="h-2" 
              />
              <p className="text-xs text-muted-foreground mt-2">
                {stats.qualificados > 0 
                  ? Math.round((stats.mensagens_geradas / stats.qualificados) * 100)
                  : 0}% com mensagens
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Pipeline */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Pipeline de Processamento</CardTitle>
            <CardDescription>Acompanhe o progresso da campanha</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pipeline.map((stage, index) => {
                const Icon = stage.icon;
                const isInProgress = stage.status === 'in-progress';
                
                return (
                  <div key={index} className="flex items-center gap-4">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                      stage.status === 'completed' ? 'bg-primary text-primary-foreground' :
                      stage.status === 'in-progress' ? 'bg-secondary text-secondary-foreground' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      <Icon className={`h-5 w-5 ${isInProgress ? 'animate-spin' : ''}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium">{stage.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {stage.value} {stage.total ? `/ ${stage.total}` : 'leads'}
                        </p>
                      </div>
                      {stage.total && (
                        <Progress 
                          value={(stage.value / stage.total) * 100} 
                          className="h-2" 
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        stage.status === 'completed' ? 'default' :
                        stage.status === 'in-progress' ? 'secondary' :
                        'outline'
                      }>
                        {stage.status === 'completed' ? '✅ Concluído' :
                         stage.status === 'in-progress' ? '⏳ Em progresso' :
                         '⏸️ Aguardando'}
                      </Badge>
                      
                      {/* Botão de ação para cada estágio */}
                      {stage.label === 'Enriquecimento' && stage.total > stage.value && (
                        <Button 
                          size="sm" 
                          onClick={handleEnriquecerLeads}
                          disabled={enriching || stage.total === 0}
                          className="ml-2"
                        >
                          {enriching ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Sparkles className="mr-2 h-4 w-4" />
                              Enriquecer
                            </>
                          )}
                        </Button>
                      )}
                      
                      {stage.label === 'Qualificação' && stage.total > stage.value && (
                        <Button 
                          size="sm" 
                          onClick={handleQualificarLeads}
                          disabled={qualifying || stage.total === 0}
                          className="ml-2"
                        >
                          {qualifying ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Sparkles className="mr-2 h-4 w-4" />
                              Qualificar
                            </>
                          )}
                        </Button>
                      )}
                      
                      {stage.label === 'Mensagens' && stage.total > stage.value && (
                        <Button 
                          size="sm" 
                          onClick={handleGerarMensagens}
                          disabled={generatingMessages || stage.total === 0}
                          className="ml-2"
                        >
                          {generatingMessages ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Sparkles className="mr-2 h-4 w-4" />
                              Gerar
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="voice">📞 Chamadas de Voz</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Leads Overview */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Leads Descobertos</CardTitle>
                    <CardDescription>Top leads qualificados desta campanha</CardDescription>
                  </div>
                  <Button onClick={() => navigate(`/campanhas/${id}/leads`)}>
                    Ver todos →
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {leads.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhum lead qualificado</h3>
                    <p className="text-muted-foreground">
                      Aguarde o processamento da campanha
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {leads.map((lead) => (
                      <Card key={lead.id} className="border-l-4 border-l-primary">
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold text-lg">
                                  {lead.nome_profissional || lead.razao_social}
                                </h3>
                                {lead.score && (
                                  <Badge variant="default">Score: {lead.score}/100</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {lead.profissao && `${lead.profissao} • `}
                                {lead.especialidade && `${lead.especialidade} • `}
                                {lead.cidade}, {lead.estado}
                              </p>
                              {lead.telefone && (
                                <p className="text-sm">📱 {lead.telefone}</p>
                              )}
                              {lead.linkedin_url && (
                                <p className="text-sm">💼 LinkedIn conectado</p>
                              )}
                              {lead.instagram_username && (
                                <p className="text-sm">📸 @{lead.instagram_username}</p>
                              )}
                            </div>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => navigate(`/campanhas/${id}/leads`)}
                            >
                              Ver detalhes
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leads" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Todos os Leads</CardTitle>
                <CardDescription>Gerencie todos os leads desta campanha</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => navigate(`/campanhas/${id}/leads`)}>
                  Ver página completa de leads →
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="voice" className="space-y-6 mt-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold">Campanha de Voz com IA</h3>
                <p className="text-sm text-muted-foreground">
                  Sistema automatizado de cold calling com Inteligência Artificial
                </p>
              </div>
            </div>
            <VoiceCallDashboard campanhaId={id!} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
