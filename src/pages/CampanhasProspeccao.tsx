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
import { Plus, Play, Pause, TrendingUp, Users, MessageSquare, Rocket, ArrowLeft, Eye, Loader2, Trash2 } from "lucide-react";

export default function CampanhasProspeccao() {
  const navigate = useNavigate();
  const [campanhas, setCampanhas] = useState<any[]>([]);
  const [icps, setIcps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [criandoCampanha, setCriandoCampanha] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  
  // Filtros
  const [statusFilter, setStatusFilter] = useState<string>('todas');
  const [tipoFilter, setTipoFilter] = useState<string>('todos');

  // Form state
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [icpId, setIcpId] = useState("");
  const [metaTotal, setMetaTotal] = useState("");

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
      const { data: icpsData, error: icpsError } = await supabase
        .from('icp_configs')
        .select('*')
        .eq('user_id', user.id)
        .eq('ativo', true);

      if (icpsError) throw icpsError;
      setIcps(icpsData || []);

      // Carregar campanhas
      const { data: campanhasData, error: campanhasError } = await supabase
        .from('campanhas_prospeccao')
        .select('*, icp_configs(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (campanhasError) throw campanhasError;
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
          meta_leads_total: metaTotal ? parseInt(metaTotal) : null,
          status: 'rascunho'
        });

      if (error) throw error;

      toast.success("Campanha criada com sucesso!");
      setNome("");
      setDescricao("");
      setIcpId("");
      setMetaTotal("");
      loadData();

    } catch (error: any) {
      console.error("Erro ao criar campanha:", error);
      toast.error(error.message);
    } finally {
      setCriandoCampanha(false);
    }
  };

  const handleIniciarCampanha = async (campanhaId: string) => {
    try {
      const campanha = campanhas.find(c => c.id === campanhaId);
      if (!campanha) return;

      setProcessing(campanhaId);
      
      toast.info("🚀 Campanha iniciada - Buscando leads...");

      // 1. Atualizar status da campanha
      const { error: updateError } = await supabase
        .from('campanhas_prospeccao')
        .update({
          status: 'ativa',
          iniciada_em: new Date().toISOString()
        })
        .eq('id', campanhaId);

      if (updateError) {
        console.error("❌ Erro ao atualizar status:", updateError);
        throw updateError;
      }

      // 2. Chamar edge function
      const funcao = campanha.tipo === 'b2b' ? 'generate-leads-b2b' : 'generate-leads-b2c';
      
      console.log(`🔍 Chamando ${funcao} para campanha ${campanhaId}`);

      const { data, error } = await supabase.functions.invoke(funcao, {
        body: {
          campanha_id: campanhaId,
          icp_config_id: campanha.icp_config_id,
          limite: campanha.meta_leads_total || 50
        }
      });

      if (error) {
        console.error("❌ Erro na edge function:", error);
        throw new Error(`Edge function error: ${error.message}`);
      }

      console.log("✅ Resultado edge function:", data);

      // 3. Polling para atualizar stats em tempo real
      let pollCount = 0;
      const maxPolls = 40; // 40 x 3s = 2 minutos
      
      const pollInterval = setInterval(async () => {
        pollCount++;
        
        const { data: campanhaAtualizada } = await supabase
          .from('campanhas_prospeccao')
          .select('stats, status')
          .eq('id', campanhaId)
          .single();

        if (campanhaAtualizada) {
          console.log(`📊 Poll ${pollCount}: Stats atualizados`, campanhaAtualizada.stats);
          
          // Atualizar UI
          setCampanhas(prev => prev.map(c => 
            c.id === campanhaId 
              ? { ...c, stats: campanhaAtualizada.stats, status: campanhaAtualizada.status }
              : c
          ));

          const stats = (campanhaAtualizada.stats || {}) as any;
          const descobertos = stats.descobertos || 0;

          // Se terminou descoberta, parar polling
          if (descobertos > 0 || pollCount >= maxPolls) {
            clearInterval(pollInterval);
            setProcessing(null);
            
            if (descobertos > 0) {
              toast.success(`✅ Busca concluída! ${descobertos} leads encontrados`);
              
              // Iniciar enriquecimento (opcional)
              try {
                const { error: enrichError } = await supabase.functions.invoke('enrich-lead-bulk', {
                  body: { campanha_id: campanhaId, limite: 10 }
                });
                if (enrichError) {
                  console.warn('Enriquecimento não executado:', enrichError);
                }
              } catch (err) {
                console.warn('Enriquecimento será implementado futuramente');
              }
            } else {
              toast.error("❌ Nenhum lead encontrado. Verifique a configuração do ICP.");
            }
          }
        }
      }, 3000); // Poll a cada 3 segundos

    } catch (error: any) {
      console.error("❌ Erro ao iniciar campanha:", error);
      setProcessing(null);
      
      // Reverter status em caso de erro
      await supabase
        .from('campanhas_prospeccao')
        .update({ status: 'rascunho' })
        .eq('id', campanhaId);
        
      toast.error(`Erro: ${error.message}`);
    }
  };

  const handlePausarCampanha = async (campanhaId: string) => {
    try {
      const { error } = await supabase
        .from('campanhas_prospeccao')
        .update({ status: 'pausada' })
        .eq('id', campanhaId);

      if (error) throw error;

      toast.success("⏸️ Campanha pausada");
      loadData();
    } catch (error: any) {
      toast.error(`Erro ao pausar: ${error.message}`);
    }
  };

  const handleDeletarCampanha = async (campanhaId: string) => {
    if (!confirm('Tem certeza? Isso deletará todos os leads desta campanha.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('campanhas_prospeccao')
        .delete()
        .eq('id', campanhaId);

      if (error) throw error;

      toast.success("🗑️ Campanha deletada");
      loadData();
    } catch (error: any) {
      toast.error(`Erro ao deletar: ${error.message}`);
    }
  };

  const handleCriarLeadsTeste = async (campanhaId: string) => {
    try {
      const campanha = campanhas.find(c => c.id === campanhaId);
      if (!campanha) return;

      toast.info("🧪 Criando +5 leads de teste...");

      // Buscar stats atuais
      const statsAtuais = campanha.stats || {
        descobertos: 0,
        enriquecidos: 0,
        qualificados: 0,
        mensagens_geradas: 0,
        mensagens_enviadas: 0,
        respostas: 0,
        conversoes: 0
      };

      // Buscar user_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const leadsMockados = [
        {
          campanha_id: campanhaId,
          user_id: user.id,
          tipo: 'b2c',
          nome_profissional: `Dr. Teste ${Date.now()}`,
          profissao: 'Médico',
          especialidade: 'Cardiologista',
          cidade: 'Rio de Janeiro',
          estado: 'RJ',
          fonte: 'teste_mockado',
          status: 'descoberto'
        },
        {
          campanha_id: campanhaId,
          user_id: user.id,
          tipo: 'b2c',
          nome_profissional: `Dra. Teste ${Date.now() + 1}`,
          profissao: 'Médico',
          especialidade: 'Ortopedista',
          cidade: 'Rio de Janeiro',
          estado: 'RJ',
          fonte: 'teste_mockado',
          status: 'descoberto'
        },
        {
          campanha_id: campanhaId,
          user_id: user.id,
          tipo: 'b2c',
          nome_profissional: `Dr. Teste ${Date.now() + 2}`,
          profissao: 'Médico',
          especialidade: 'Dermatologista',
          cidade: 'Rio de Janeiro',
          estado: 'RJ',
          fonte: 'teste_mockado',
          status: 'descoberto'
        },
        {
          campanha_id: campanhaId,
          user_id: user.id,
          tipo: 'b2c',
          nome_profissional: `Dra. Teste ${Date.now() + 3}`,
          profissao: 'Médico',
          especialidade: 'Pediatra',
          cidade: 'Rio de Janeiro',
          estado: 'RJ',
          fonte: 'teste_mockado',
          status: 'descoberto'
        },
        {
          campanha_id: campanhaId,
          user_id: user.id,
          tipo: 'b2c',
          nome_profissional: `Dr. Teste ${Date.now() + 4}`,
          profissao: 'Médico',
          especialidade: 'Oftalmologista',
          cidade: 'Rio de Janeiro',
          estado: 'RJ',
          fonte: 'teste_mockado',
          status: 'descoberto'
        }
      ];

      const { error: insertError } = await supabase
        .from('leads_descobertos')
        .insert(leadsMockados);

      if (insertError) throw insertError;

      // Atualizar stats SOMANDO aos existentes
      const novoTotal = statsAtuais.descobertos + leadsMockados.length;

      const { error: updateError } = await supabase
        .from('campanhas_prospeccao')
        .update({
          stats: {
            ...statsAtuais,
            descobertos: novoTotal
          },
          // Só mudar para ativa se ainda não estiver
          ...(campanha.status === 'rascunho' && { status: 'ativa' })
        })
        .eq('id', campanhaId);

      if (updateError) throw updateError;

      await loadData();

      toast.success(`✅ Leads criados! (+5, total: ${novoTotal})`);
    } catch (error: any) {
      console.error("Erro ao criar leads teste:", error);
      toast.error(`Erro: ${error.message}`);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      rascunho: { variant: "secondary", label: "Rascunho" },
      ativa: { variant: "default", label: "Ativa" },
      pausada: { variant: "outline", label: "Pausada" },
      concluida: { variant: "secondary", label: "Concluída" }
    };
    const config = variants[status] || variants.rascunho;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const filteredCampanhas = campanhas.filter(campanha => {
    if (statusFilter !== 'todas' && campanha.status !== statusFilter) return false;
    if (tipoFilter !== 'todos' && campanha.tipo !== tipoFilter) return false;
    return true;
  });

  const campanhasAtivas = filteredCampanhas.filter(c => c.status === 'ativa');
  const campanhasPausadas = filteredCampanhas.filter(c => c.status === 'pausada');
  const campanhasRascunho = filteredCampanhas.filter(c => c.status === 'rascunho');

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>
        
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Campanhas de Prospecção</h1>
            <p className="text-muted-foreground mt-2">Geração automática de leads B2B e B2C</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/configurar-icp')}>
              <Plus className="mr-2 h-4 w-4" />
              Novo ICP
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Rocket className="mr-2 h-4 w-4" />
                  Nova Campanha
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Nova Campanha</DialogTitle>
                  <DialogDescription>Configure uma campanha de prospecção automática</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="nome">Nome da Campanha</Label>
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
                      placeholder="Descreva a campanha..."
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Perfil Cliente Ideal (ICP)</Label>
                    <Select value={icpId} onValueChange={setIcpId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um ICP" />
                      </SelectTrigger>
                      <SelectContent>
                        {icps.map(icp => (
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
                      placeholder="500"
                      value={metaTotal}
                      onChange={(e) => setMetaTotal(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline">Cancelar</Button>
                    <Button onClick={handleCriarCampanha} disabled={criandoCampanha}>
                      {criandoCampanha ? "Criando..." : "Criar Campanha"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {icps.length === 0 && (
          <Card className="mb-6 border-dashed">
            <CardContent className="py-12 text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum ICP configurado</h3>
              <p className="text-muted-foreground mb-4">
                Configure seu Perfil de Cliente Ideal antes de criar campanhas
              </p>
              <Button onClick={() => navigate('/configurar-icp')}>
                <Plus className="mr-2 h-4 w-4" />
                Criar Primeiro ICP
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Filtros */}
        {campanhas.length > 0 && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={statusFilter === 'todas' ? 'default' : 'outline'}
                  onClick={() => setStatusFilter('todas')}
                >
                  Todas ({campanhas.length})
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === 'ativa' ? 'default' : 'outline'}
                  onClick={() => setStatusFilter('ativa')}
                >
                  Ativas ({campanhas.filter(c => c.status === 'ativa').length})
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === 'pausada' ? 'default' : 'outline'}
                  onClick={() => setStatusFilter('pausada')}
                >
                  Pausadas ({campanhas.filter(c => c.status === 'pausada').length})
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === 'concluida' ? 'default' : 'outline'}
                  onClick={() => setStatusFilter('concluida')}
                >
                  Concluídas ({campanhas.filter(c => c.status === 'concluida').length})
                </Button>
                <div className="w-px h-8 bg-border mx-2" />
                <Button
                  size="sm"
                  variant={tipoFilter === 'todos' ? 'default' : 'outline'}
                  onClick={() => setTipoFilter('todos')}
                >
                  Todos
                </Button>
                <Button
                  size="sm"
                  variant={tipoFilter === 'b2b' ? 'default' : 'outline'}
                  onClick={() => setTipoFilter('b2b')}
                >
                  B2B ({campanhas.filter(c => c.tipo === 'b2b').length})
                </Button>
                <Button
                  size="sm"
                  variant={tipoFilter === 'b2c' ? 'default' : 'outline'}
                  onClick={() => setTipoFilter('b2c')}
                >
                  B2C ({campanhas.filter(c => c.tipo === 'b2c').length})
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Campanhas Ativas */}
        {campanhasAtivas.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">CAMPANHAS ATIVAS ({campanhasAtivas.length})</h2>
            <div className="grid gap-6">
              {campanhasAtivas.map((campanha) => {
                const stats = campanha.stats || {};
                return (
                  <Card key={campanha.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle>{campanha.nome}</CardTitle>
                            {getStatusBadge(campanha.status)}
                            <Badge variant="outline">{campanha.tipo.toUpperCase()}</Badge>
                          </div>
                          <CardDescription className="mt-2">{campanha.descricao}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-4 mb-4">
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Descobertos</p>
                          <p className="text-2xl font-bold">{stats.descobertos || 0}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Enriquecidos</p>
                          <p className="text-2xl font-bold">{stats.enriquecidos || 0}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Qualificados</p>
                          <p className="text-2xl font-bold">{stats.qualificados || 0}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Mensagens</p>
                          <p className="text-2xl font-bold">{stats.mensagens_geradas || 0}</p>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-4 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePausarCampanha(campanha.id)}
                          disabled={processing === campanha.id}
                        >
                          <Pause className="mr-2 h-4 w-4" />
                          Pausar
                        </Button>

                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleCriarLeadsTeste(campanha.id)}
                          title="Adicionar mais 5 leads de teste"
                        >
                          🧪 +5 Leads
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/campanhas/${campanha.id}`)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Ver Detalhes
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Campanhas Pausadas */}
        {campanhasPausadas.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">CAMPANHAS PAUSADAS ({campanhasPausadas.length})</h2>
            <div className="grid gap-6">
              {campanhasPausadas.map((campanha) => {
                const stats = campanha.stats || {};
                return (
                  <Card key={campanha.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle>{campanha.nome}</CardTitle>
                            {getStatusBadge(campanha.status)}
                            <Badge variant="outline">{campanha.tipo.toUpperCase()}</Badge>
                          </div>
                          <CardDescription className="mt-2">{campanha.descricao}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-4 mb-4">
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Descobertos</p>
                          <p className="text-2xl font-bold">{stats.descobertos || 0}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Enriquecidos</p>
                          <p className="text-2xl font-bold">{stats.enriquecidos || 0}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Qualificados</p>
                          <p className="text-2xl font-bold">{stats.qualificados || 0}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Mensagens</p>
                          <p className="text-2xl font-bold">{stats.mensagens_geradas || 0}</p>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-4 border-t">
                        <Button
                          size="sm"
                          onClick={() => handleIniciarCampanha(campanha.id)}
                          disabled={processing === campanha.id}
                        >
                          {processing === campanha.id ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Iniciando...
                            </>
                          ) : (
                            <>
                              <Play className="mr-2 h-4 w-4" />
                              Retomar
                            </>
                          )}
                        </Button>

                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleCriarLeadsTeste(campanha.id)}
                          title="Adicionar mais 5 leads de teste"
                        >
                          🧪 +5 Leads
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/campanhas/${campanha.id}`)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Ver Detalhes
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeletarCampanha(campanha.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Campanhas Rascunho */}
        {campanhasRascunho.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">RASCUNHOS ({campanhasRascunho.length})</h2>
            <div className="grid gap-6">
              {campanhasRascunho.map((campanha) => {
            const stats = campanha.stats || {};
            return (
              <Card key={campanha.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle>{campanha.nome}</CardTitle>
                        {getStatusBadge(campanha.status)}
                        <Badge variant="outline">{campanha.tipo.toUpperCase()}</Badge>
                      </div>
                      <CardDescription className="mt-2">{campanha.descricao}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Descobertos</p>
                      <p className="text-2xl font-bold">{stats.descobertos || 0}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Enriquecidos</p>
                      <p className="text-2xl font-bold">{stats.enriquecidos || 0}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Qualificados</p>
                      <p className="text-2xl font-bold">{stats.qualificados || 0}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Mensagens</p>
                      <p className="text-2xl font-bold">{stats.mensagens_geradas || 0}</p>
                    </div>
                  </div>

                  {/* Botões de ação */}
                  <div className="flex gap-2 pt-4 border-t">
                    {campanha.status === 'ativa' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePausarCampanha(campanha.id)}
                        disabled={processing === campanha.id}
                      >
                        <Pause className="mr-2 h-4 w-4" />
                        Pausar
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleIniciarCampanha(campanha.id)}
                        disabled={processing === campanha.id}
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

                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleCriarLeadsTeste(campanha.id)}
                      title="Adicionar mais 5 leads de teste"
                    >
                      🧪 +5 Leads
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/campanhas/${campanha.id}`)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Ver Detalhes
                    </Button>

                    {(campanha.status === 'rascunho' || campanha.status === 'pausada') && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeletarCampanha(campanha.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {campanhas.length === 0 && icps.length > 0 && (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma campanha criada</h3>
              <p className="text-muted-foreground mb-4">
                Crie sua primeira campanha de prospecção automática
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
