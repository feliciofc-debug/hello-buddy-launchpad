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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Play, Pause, Users, Eye, Loader2, Trash2, ArrowLeft, Sparkles, Target, RotateCcw } from "lucide-react";

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
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      // Carregar ICPs
      const { data: icpsData } = await supabase
        .from('icp_configs')
        .select('*')
        .eq('user_id', user.id)
        .eq('ativo', true);

      setIcps(icpsData || []);

      // Carregar campanhas
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

      // Atualizar status
      await supabase
        .from('campanhas_prospeccao')
        .update({
          status: 'ativa',
          iniciada_em: new Date().toISOString()
        })
        .eq('id', campanhaId);

      // Chamar edge function search-leads com SerpAPI
      const { data, error } = await supabase.functions.invoke('search-leads', {
        body: {
          campanha_id: campanhaId,
          icp_config_id: campanha.icp_config_id
        }
      });

      if (error) throw error;

      toast.success(`✅ ${data?.total_encontrados || 0} leads descobertos!`, { id: 'descoberta' });
      loadData();

    } catch (error: any) {
      console.error("Erro ao iniciar campanha:", error);
      toast.error(`❌ Erro: ${error.message}`, { id: 'descoberta' });
      
      // Reverter status
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

  const handleDeletarCampanha = async (campanhaId: string) => {
    if (!confirm('⚠️ Isso deletará todos os leads desta campanha. Continuar?')) {
      return;
    }

    try {
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
    if (!confirm('⚠️ ATENÇÃO: Isso deletará TODAS as campanhas e TODOS os leads. Esta ação não pode ser desfeita. Continuar?')) {
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      toast.loading("🗑️ Zerrando tudo...", { id: 'zerar' });

      // 1. Resetar stats das campanhas
      await supabase
        .from('campanhas_prospeccao')
        .update({
          stats: {
            descobertos: 0,
            enriquecidos: 0,
            qualificados: 0,
            mensagens_geradas: 0,
            mensagens_enviadas: 0,
            respostas: 0,
            conversoes: 0
          }
        })
        .eq('user_id', user.id);

      // 2. Deletar execuções de campanhas
      const { data: execucoes } = await supabase
        .from('campanha_execucoes')
        .select('id, campanha_id')
        .in('campanha_id', campanhas.map(c => c.id));

      if (execucoes && execucoes.length > 0) {
        await supabase
          .from('campanha_execucoes')
          .delete()
          .in('id', execucoes.map(e => e.id));
      }

      // 3. Deletar leads descobertos
      await supabase
        .from('leads_descobertos')
        .delete()
        .eq('user_id', user.id);

      // 4. Deletar leads B2B
      await supabase
        .from('leads_b2b')
        .delete()
        .eq('user_id', user.id);

      // 5. Deletar leads B2C
      await supabase
        .from('leads_b2c')
        .delete()
        .eq('user_id', user.id);

      toast.success("✅ Tudo zerado!", { id: 'zerar' });
      loadData();
    } catch (error: any) {
      console.error("Erro ao zerar:", error);
      toast.error(`❌ Erro: ${error.message}`, { id: 'zerar' });
    }
  };

  const executarCampanha = async (icp: any) => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      toast.info("🚀 Criando e executando campanha...");

      // 1. Criar campanha
      const { data: novaCampanha, error: campanhaError } = await supabase
        .from('campanhas_prospeccao')
        .insert({
          user_id: user.id,
          nome: `Campanha: ${icp.nome}`,
          icp_config_id: icp.id,
          tipo: icp.tipo,
          status: 'executando',
          meta_leads_total: 100
        })
        .select()
        .single();

      if (campanhaError) throw campanhaError;

      // 2. Executar campanha
      const { data: resultado, error: execError } = await supabase.functions.invoke('executar-campanha-completa', {
        body: { campanhaId: novaCampanha.id }
      });

      if (execError) throw execError;

      toast.success(`✅ ${resultado.message}`);
      
      // Recarregar
      loadData();

    } catch (error: any) {
      toast.error("Erro: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const CampanhaCard = ({ campanha }: { campanha: any }) => {
    const stats = campanha.stats || {
      descobertos: 0,
      enriquecidos: 0,
      qualificados: 0
    };

    return (
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <CardTitle className="text-xl">{campanha.nome}</CardTitle>
                <Badge variant={campanha.tipo === 'b2c' ? 'default' : 'secondary'}>
                  {campanha.tipo?.toUpperCase()}
                </Badge>
                <Badge variant={
                  campanha.status === 'ativa' ? 'default' :
                  campanha.status === 'pausada' ? 'outline' :
                  'secondary'
                }>
                  {campanha.status}
                </Badge>
              </div>
              <CardDescription className="line-clamp-2">
                {campanha.descricao || 'Sem descrição'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* ICP Info */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Target className="h-4 w-4" />
            <span>{campanha.icp_configs?.nome || 'ICP não configurado'}</span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{stats.descobertos || 0}</div>
              <div className="text-xs text-muted-foreground">Descobertos</div>
            </div>
            <div className="text-center p-3 bg-blue-500/10 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.enriquecidos || 0}</div>
              <div className="text-xs text-muted-foreground">Enriquecidos</div>
            </div>
            <div className="text-center p-3 bg-green-500/10 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.qualificados || 0}</div>
              <div className="text-xs text-muted-foreground">Qualificados</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t">
            {campanha.status === 'rascunho' && (
              <Button 
                size="sm" 
                onClick={() => handleIniciarCampanha(campanha.id)}
                disabled={processing === campanha.id}
                className="flex-1"
              >
                {processing === campanha.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Iniciando...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Iniciar
                  </>
                )}
              </Button>
            )}

            {campanha.status === 'ativa' && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handlePausarCampanha(campanha.id)}
                className="flex-1"
              >
                <Pause className="mr-2 h-4 w-4" />
                Pausar
              </Button>
            )}

            {campanha.status === 'pausada' && (
              <Button 
                size="sm"
                onClick={() => handleIniciarCampanha(campanha.id)}
                className="flex-1"
              >
                <Play className="mr-2 h-4 w-4" />
                Retomar
              </Button>
            )}

            <Button 
              size="sm" 
              variant="outline"
              onClick={() => navigate(`/campanhas/${campanha.id}/leads`)}
            >
              <Eye className="mr-2 h-4 w-4" />
              Ver Leads
            </Button>

            <Button 
              size="sm" 
              variant="ghost"
              onClick={() => handleDeletarCampanha(campanha.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const ativas = campanhas.filter(c => c.status === 'ativa');
  const pausadas = campanhas.filter(c => c.status === 'pausada');
  const rascunhos = campanhas.filter(c => c.status === 'rascunho');

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
              <Button variant="destructive" onClick={handleZerarTudo}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Zerar Tudo
              </Button>
            )}
            {icps.length === 0 ? (
              <Button onClick={() => navigate('/configurar-icp')}>
                <Target className="mr-2 h-4 w-4" />
                Criar Primeiro ICP
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => navigate('/configurar-icp')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo ICP
                </Button>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Nova Campanha
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
                        <p className="text-xs text-muted-foreground mt-1">
                          Quantidade de leads que deseja descobrir
                        </p>
                      </div>
                      <div className="flex justify-end gap-2 pt-4">
                        <Button 
                          variant="outline" 
                          onClick={() => setDialogOpen(false)}
                        >
                          Cancelar
                        </Button>
                        <Button 
                          onClick={handleCriarCampanha}
                          disabled={criandoCampanha}
                        >
                          {criandoCampanha ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Criando...
                            </>
                          ) : (
                            'Criar Campanha'
                          )}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        </div>

        {/* ICPs Configurados */}
        {icps.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>ICPs Configurados</CardTitle>
              <CardDescription>
                Perfis de Cliente Ideal prontos para prospecção
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {icps.map((icp) => (
                  <div key={icp.id} className="border rounded-lg p-4 hover:bg-muted/50 transition">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-2">{icp.nome}</h3>
                        <div className="flex flex-wrap gap-2 mb-3">
                          <Badge variant="secondary">{icp.tipo === 'b2c' ? '👤 B2C' : '🏢 B2B'}</Badge>
                          {icp.profissoes?.map((prof: string) => (
                            <Badge key={prof} variant="outline">{prof}</Badge>
                          ))}
                          {icp.estados?.map((estado: string) => (
                            <Badge key={estado} className="bg-blue-500/10 text-blue-700">{estado}</Badge>
                          ))}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <p>• {icp.fontes_habilitadas?.length || 0} fontes habilitadas</p>
                          {icp.especialidades && icp.especialidades.length > 0 && (
                            <p>• Especialidades: {icp.especialidades.join(', ')}</p>
                          )}
                        </div>
                      </div>
                      <Button size="sm" onClick={() => executarCampanha(icp)} disabled={loading}>
                        <Play className="mr-2 h-4 w-4" />
                        {loading ? 'Executando...' : 'Executar'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
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
          <Tabs defaultValue="ativas" className="w-full">
            <TabsList>
              <TabsTrigger value="ativas">
                <Play className="mr-2 h-4 w-4" />
                Ativas ({ativas.length})
              </TabsTrigger>
              <TabsTrigger value="pausadas">
                <Pause className="mr-2 h-4 w-4" />
                Pausadas ({pausadas.length})
              </TabsTrigger>
              <TabsTrigger value="rascunhos">
                <Users className="mr-2 h-4 w-4" />
                Rascunhos ({rascunhos.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ativas" className="mt-6">
              {ativas.length === 0 ? (
                <Card className="py-8">
                  <CardContent className="text-center text-muted-foreground">
                    Nenhuma campanha ativa
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ativas.map((campanha) => (
                    <CampanhaCard key={campanha.id} campanha={campanha} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="pausadas" className="mt-6">
              {pausadas.length === 0 ? (
                <Card className="py-8">
                  <CardContent className="text-center text-muted-foreground">
                    Nenhuma campanha pausada
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pausadas.map((campanha) => (
                    <CampanhaCard key={campanha.id} campanha={campanha} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="rascunhos" className="mt-6">
              {rascunhos.length === 0 ? (
                <Card className="py-8">
                  <CardContent className="text-center text-muted-foreground">
                    Nenhum rascunho
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rascunhos.map((campanha) => (
                    <CampanhaCard key={campanha.id} campanha={campanha} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
