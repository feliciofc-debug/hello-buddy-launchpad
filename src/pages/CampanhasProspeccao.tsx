import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Play, Pause, Eye, Loader2, Trash2, ArrowLeft, Sparkles, Settings, RotateCcw, Linkedin, Instagram, CheckCircle2 } from "lucide-react";

interface CampanhaStats {
  descobertos: number;
  enriquecidos: number;
  qualificados: number;
}

export default function CampanhasProspeccao() {
  const navigate = useNavigate();
  const [campanhas, setCampanhas] = useState<any[]>([]);
  const [icps, setIcps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [criandoCampanha, setCriandoCampanha] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  // Form state
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [icpId, setIcpId] = useState("");
  const [metaTotal, setMetaTotal] = useState("50");
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    loadData();
    
    const campaignTemplate = localStorage.getItem('campaignMessageTemplate');
    if (campaignTemplate) {
      setDescricao(campaignTemplate);
      setDialogOpen(true);
      localStorage.removeItem('campaignMessageTemplate');
      toast.info("✨ Texto da IA Marketing carregado!");
    }
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      const { data: icpsData } = await supabase
        .from('icp_configs')
        .select('*')
        .eq('user_id', user.id)
        .eq('ativo', true);

      setIcps(icpsData || []);

      const { data: campanhasData } = await supabase
        .from('campanhas_prospeccao')
        .select('*, icp_configs(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setCampanhas(campanhasData || []);

    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCriarCampanha = async () => {
    if (!nome.trim() || !icpId) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setCriandoCampanha(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const icpSelecionado = icps.find(i => i.id === icpId);

      const { error } = await supabase
        .from('campanhas_prospeccao')
        .insert({
          user_id: user.id,
          icp_config_id: icpId,
          nome,
          descricao,
          tipo: icpSelecionado.tipo,
          meta_leads_total: metaTotal ? parseInt(metaTotal) : 50,
          status: 'rascunho',
          stats: {
            descobertos: 0,
            enriquecidos: 0,
            qualificados: 0,
            mensagens_geradas: 0,
            mensagens_enviadas: 0,
            respostas: 0,
            conversoes: 0
          }
        });

      if (error) throw error;

      toast.success("✅ Campanha criada com sucesso!");
      setNome("");
      setDescricao("");
      setIcpId("");
      setMetaTotal("50");
      setDialogOpen(false);
      loadData();

    } catch (error: any) {
      console.error("Erro ao criar campanha:", error);
      toast.error(error.message);
    } finally {
      setCriandoCampanha(false);
    }
  };

  const handleIniciarCampanha = async (campanhaId: string) => {
    const campanha = campanhas.find(c => c.id === campanhaId);
    if (!campanha) return;

    setProcessing(campanhaId);
    
    try {
      toast.loading("🚀 Iniciando descoberta de leads...", { id: 'descoberta' });

      await supabase
        .from('campanhas_prospeccao')
        .update({
          status: 'ativa',
          iniciada_em: new Date().toISOString()
        })
        .eq('id', campanhaId);

      console.log('━━━━━━━━━━━━━━━━━━━━━━')
      console.log('🚀 INICIANDO CAMPANHA')
      console.log('Campanha:', campanhaId)

      const { data, error } = await supabase.functions.invoke('search-leads', {
        body: {
          campanha_id: campanhaId,
          icp_config_id: campanha.icp_config_id
        }
      });

      if (error) throw error;

      console.log('📊 Resultado:', data)
      console.log('━━━━━━━━━━━━━━━━━━━━━━')

      const novos = data?.novos_encontrados || data?.total_encontrados || 0;
      const total = data?.total_campanha || 0;

      if (novos > 0) {
        toast.success(`✅ +${novos} leads descobertos! (Total: ${total})`, { id: 'descoberta' });
      } else if (total > 0) {
        toast.info(`ℹ️ Nenhum novo (duplicatas). Total: ${total}`, { id: 'descoberta' });
      } else {
        toast.warning(`⚠️ Nenhum lead encontrado. Verifique ICP.`, { id: 'descoberta' });
      }
      
      loadData();

    } catch (error: any) {
      console.error("❌ Erro ao iniciar campanha:", error);
      toast.error(`❌ Erro: ${error.message}`, { id: 'descoberta' });
      
      await supabase
        .from('campanhas_prospeccao')
        .update({ status: 'rascunho' })
        .eq('id', campanhaId);
        
    } finally {
      setProcessing(null);
    }
  };

  const handlePausarCampanha = async (campanhaId: string) => {
    try {
      await supabase
        .from('campanhas_prospeccao')
        .update({ status: 'pausada' })
        .eq('id', campanhaId);

      toast.success("⏸️ Campanha pausada");
      loadData();
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
    }
  };

  const handleContinuarCampanha = async (campanhaId: string) => {
    setProcessing(campanhaId);
    try {
      await supabase
        .from('campanhas_prospeccao')
        .update({ status: 'ativa' })
        .eq('id', campanhaId);

      toast.success("⏳ Campanha ativada! Buscando leads...");
      await executarBuscaLeads(campanhaId);
      loadData();
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
    } finally {
      setProcessing(null);
    }
  };

  const executarBuscaLeads = async (campanhaId: string) => {
    const campanha = campanhas.find(c => c.id === campanhaId);
    if (!campanha) return;

    setProcessing(campanhaId);
    
    try {
      toast.loading("🔍 Buscando leads...", { id: 'busca' });
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━')
      console.log('🔍 INÍCIO DA BUSCA')
      console.log('Campanha:', campanhaId)
      
      const { data, error } = await supabase.functions.invoke('search-leads', {
        body: {
          campanha_id: campanhaId,
          icp_config_id: campanha.icp_config_id
        }
      });

      if (error) throw error;

      console.log('📊 Resultado busca:', data)
      console.log('✅ Novos:', data?.novos_encontrados || 0)
      console.log('📊 TOTAL campanha:', data?.total_campanha || 0)
      console.log('━━━━━━━━━━━━━━━━━━━━━━')

      const novos = data?.novos_encontrados || data?.total_encontrados || 0;
      const total = data?.total_campanha || 0;

      if (novos > 0) {
        toast.success(`✅ +${novos} novos leads! (Total: ${total})`, { id: 'busca' });
      } else if (total > 0) {
        toast.info(`ℹ️ Nenhum novo lead (duplicatas filtradas). Total: ${total}`, { id: 'busca' });
      } else {
        toast.warning(`⚠️ Nenhum lead encontrado. Verifique o ICP.`, { id: 'busca' });
      }
      
      loadData();
    } catch (error: any) {
      console.error("❌ Erro na busca:", error);
      toast.error(`❌ Erro: ${error.message}`, { id: 'busca' });
    } finally {
      setProcessing(null);
    }
  };

  const handleDeletarCampanha = async (campanhaId: string) => {
    if (!confirm('⚠️ Isso deletará todos os leads desta campanha. Continuar?')) {
      return;
    }

    try {
      // Deletar leads associados primeiro
      await supabase.from('leads_b2c').delete().eq('campanha_id', campanhaId);
      await supabase.from('leads_b2b').delete().eq('campanha_id', campanhaId);
      
      await supabase
        .from('campanhas_prospeccao')
        .delete()
        .eq('id', campanhaId);

      toast.success("🗑️ Campanha deletada");
      loadData();
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
    }
  };

  const handleZerarTudo = async () => {
    if (!confirm('⚠️ ATENÇÃO: Isso deletará TODAS as campanhas e TODOS os leads. Continuar?')) {
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      toast.loading("🗑️ Zerando tudo...", { id: 'zerar' });

      await supabase.from('leads_descobertos').delete().eq('user_id', user.id);
      await supabase.from('leads_b2b').delete().eq('user_id', user.id);
      await supabase.from('leads_b2c').delete().eq('user_id', user.id);
      await supabase.from('campanhas_prospeccao').delete().eq('user_id', user.id);

      toast.success("✅ Tudo zerado!", { id: 'zerar' });
      loadData();
    } catch (error: any) {
      console.error("Erro ao zerar:", error);
      toast.error(`❌ Erro: ${error.message}`, { id: 'zerar' });
    }
  };

  // Componente do Card com métricas reais do banco
  const CampanhaCard = ({ campanha }: { campanha: any }) => {
    const [stats, setStats] = useState<CampanhaStats>({ descobertos: 0, enriquecidos: 0, qualificados: 0 });
    const [loadingStats, setLoadingStats] = useState(true);

    useEffect(() => {
      loadStats();
    }, [campanha.id]);

    const loadStats = async () => {
      try {
        const tabela = campanha.tipo === 'b2c' ? 'leads_b2c' : 'leads_b2b';
        
        // Total descobertos
        const { count: descobertos } = await supabase
          .from(tabela)
          .select('*', { count: 'exact', head: true })
          .eq('campanha_id', campanha.id);
        
        // Enriquecidos (todos que passaram do status descoberto)
        const { count: enriquecidos } = await supabase
          .from(tabela)
          .select('*', { count: 'exact', head: true })
          .eq('campanha_id', campanha.id)
          .in('pipeline_status', ['enriquecido', 'qualificado', 'mensagem_gerada', 'enviado', 'respondeu', 'convertido']);
        
        // Qualificados (todos que passaram do status enriquecido)
        const { count: qualificados } = await supabase
          .from(tabela)
          .select('*', { count: 'exact', head: true })
          .eq('campanha_id', campanha.id)
          .in('pipeline_status', ['qualificado', 'mensagem_gerada', 'enviado', 'respondeu', 'convertido']);
        
        setStats({ 
          descobertos: descobertos || 0, 
          enriquecidos: enriquecidos || 0, 
          qualificados: qualificados || 0 
        });
      } catch (error) {
        console.error('Erro ao carregar stats:', error);
      } finally {
        setLoadingStats(false);
      }
    };

    return (
      <Card className="hover:shadow-lg transition-shadow">
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold">{campanha.nome}</h3>
              <div className="flex gap-2 mt-2">
                <Badge variant={campanha.tipo === 'b2c' ? 'default' : 'secondary'}>
                  {campanha.tipo === 'b2c' ? '👤 B2C' : '🏢 B2B'}
                </Badge>
                <Badge variant={
                  campanha.status === 'ativa' ? 'default' :
                  campanha.status === 'pausada' ? 'outline' :
                  'secondary'
                }>
                  {campanha.status === 'ativa' ? '▶️ Ativa' : 
                   campanha.status === 'pausada' ? '⏸️ Pausada' : 
                   '📝 Rascunho'}
                </Badge>
              </div>
            </div>
            
            {/* Botão principal de ação */}
            {campanha.status === 'rascunho' && (
              <Button 
                onClick={() => handleIniciarCampanha(campanha.id)}
                disabled={processing === campanha.id}
              >
                {processing === campanha.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>▶️ Executar</>
                )}
              </Button>
            )}
            {campanha.status === 'ativa' && (
              <Button variant="outline" onClick={() => handlePausarCampanha(campanha.id)}>
                ⏸️ Pausar
              </Button>
            )}
            {campanha.status === 'pausada' && (
              <Button onClick={() => handleContinuarCampanha(campanha.id)}>
                ▶️ Continuar
              </Button>
            )}
          </div>

          {campanha.descricao && (
            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
              {campanha.descricao}
            </p>
          )}

          {/* Métricas */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-3xl font-bold">
                {loadingStats ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : stats.descobertos}
              </div>
              <div className="text-xs text-muted-foreground">Descobertos</div>
            </div>
            <div className="text-center p-3 bg-blue-500/10 rounded-lg">
              <div className="text-3xl font-bold text-blue-500">
                {loadingStats ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : stats.enriquecidos}
              </div>
              <div className="text-xs text-muted-foreground">Enriquecidos</div>
            </div>
            <div className="text-center p-3 bg-green-500/10 rounded-lg">
              <div className="text-3xl font-bold text-green-500">
                {loadingStats ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : stats.qualificados}
              </div>
              <div className="text-xs text-muted-foreground">Qualificados</div>
            </div>
          </div>

          {/* Métricas de Qualidade */}
          <div className="grid grid-cols-2 gap-2 mb-4 p-3 bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-lg">
            <div className="flex items-center gap-2 text-xs">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              <span className="text-muted-foreground">WhatsApp Verificados:</span>
              <span className="font-bold">{(campanha.stats as any)?.whatsapp_validos || 0}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Linkedin className="h-3 w-3 text-blue-500" />
              <span className="text-muted-foreground">LinkedIn:</span>
              <span className="font-bold">{(campanha.stats as any)?.linkedin_encontrados || 0}</span>
            </div>
          </div>

          {/* Ações */}
          <div className="flex flex-col gap-2 pt-4 border-t">
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => navigate(`/leads-funil?campanha=${campanha.id}`)}
              >
                👁️ Ver Leads
              </Button>
              <Button 
                variant="secondary"
                size="icon"
                onClick={() => executarBuscaLeads(campanha.id)}
                disabled={campanha.status !== 'ativa' || processing === campanha.id}
                title="Busca rápida (Google)"
              >
                {processing === campanha.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => navigate(`/configurar-icp?edit=${campanha.icp_config_id}`)}
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => handleDeletarCampanha(campanha.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Botão de Busca de Qualidade */}
            <Button 
              variant="default"
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              onClick={() => handleBuscaQualidade(campanha.id, campanha.icp_config_id)}
              disabled={processing === campanha.id}
            >
              {processing === campanha.id ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <>
                  <Linkedin className="h-4 w-4 mr-1" />
                  <Instagram className="h-4 w-4 mr-2" />
                </>
              )}
              🎯 Buscar Leads REAIS (LinkedIn + Instagram)
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const handleBuscaQualidade = async (campanhaId: string, icpConfigId: string) => {
    setProcessing(campanhaId);
    
    try {
      toast.loading("🎯 Buscando leads de QUALIDADE no LinkedIn e Instagram...", { id: 'qualidade' });

      // Atualizar status para ativa
      await supabase
        .from('campanhas_prospeccao')
        .update({
          status: 'ativa',
          iniciada_em: new Date().toISOString()
        })
        .eq('id', campanhaId);

      const { data, error } = await supabase.functions.invoke('generate-leads-quality', {
        body: {
          campanha_id: campanhaId,
          icp_config_id: icpConfigId,
          fontes: ['linkedin', 'instagram'],
          validarWhatsApp: true,
          scoreMinimo: 50
        }
      });

      if (error) throw error;

      const stats = data?.stats || {};
      
      toast.success(
        `✅ Busca concluída!\n` +
        `📊 LinkedIn: ${stats.linkedin_encontrados || 0}\n` +
        `📸 Instagram: ${stats.instagram_encontrados || 0}\n` +
        `✅ WhatsApp válidos: ${stats.whatsapp_validos || 0}\n` +
        `💾 Salvos: ${stats.salvos || 0}`,
        { id: 'qualidade', duration: 8000 }
      );
      
      loadData();

    } catch (error: any) {
      console.error("Erro na busca de qualidade:", error);
      toast.error(`❌ Erro: ${error.message}`, { id: 'qualidade' });
      
      await supabase
        .from('campanhas_prospeccao')
        .update({ status: 'pausada' })
        .eq('id', campanhaId);
        
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <h1 className="text-4xl font-bold">Campanhas de Prospecção</h1>
            <p className="text-muted-foreground mt-2">
              Geração automática e inteligente de leads B2B e B2C
            </p>
          </div>
          
          <div className="flex gap-2">
            {campanhas.length > 0 && (
              <Button variant="destructive" size="sm" onClick={handleZerarTudo}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Zerar Tudo
              </Button>
            )}
            {icps.length === 0 ? (
              <Button onClick={() => navigate('/configurar-icp')}>
                <Plus className="mr-2 h-4 w-4" />
                Criar Primeiro ICP
              </Button>
            ) : (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Sparkles className="mr-2 h-4 w-4" />
                    + Nova Campanha
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Nova Campanha</DialogTitle>
                    <DialogDescription>
                      Configure uma campanha de descoberta automática de leads
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div>
                      <Label htmlFor="nome">Nome da Campanha *</Label>
                      <Input
                        id="nome"
                        placeholder="Ex: Médicos RJ Q1 2025"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="descricao">Descrição</Label>
                      <Textarea
                        id="descricao"
                        placeholder="Descreva o objetivo da campanha..."
                        value={descricao}
                        onChange={(e) => setDescricao(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label>Perfil Cliente Ideal (ICP) *</Label>
                      <Select value={icpId} onValueChange={setIcpId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um ICP" />
                        </SelectTrigger>
                        <SelectContent>
                          {icps.map((icp) => (
                            <SelectItem key={icp.id} value={icp.id}>
                              {icp.nome} ({icp.tipo.toUpperCase()})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="meta">Meta de Leads</Label>
                      <Input
                        id="meta"
                        type="number"
                        placeholder="50"
                        value={metaTotal}
                        onChange={(e) => setMetaTotal(e.target.value)}
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                      <Button variant="outline" onClick={() => setDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleCriarCampanha} disabled={criandoCampanha}>
                        {criandoCampanha ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Criar Campanha
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Lista de Campanhas */}
        {campanhas.length === 0 ? (
          <Card className="py-12">
            <CardContent className="text-center">
              <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma campanha criada</h3>
              <p className="text-muted-foreground mb-4">
                {icps.length === 0 
                  ? 'Crie um ICP primeiro para começar a descobrir leads'
                  : 'Crie sua primeira campanha para descobrir leads automaticamente'}
              </p>
              <Button onClick={() => icps.length === 0 ? navigate('/configurar-icp') : setDialogOpen(true)}>
                {icps.length === 0 ? 'Criar ICP' : 'Criar Campanha'}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campanhas.map((campanha) => (
              <CampanhaCard key={campanha.id} campanha={campanha} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
