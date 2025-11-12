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
import { Plus, Play, Pause, TrendingUp, Users, MessageSquare, Rocket, ArrowLeft, Eye } from "lucide-react";

export default function CampanhasProspeccao() {
  const navigate = useNavigate();
  const [campanhas, setCampanhas] = useState<any[]>([]);
  const [icps, setIcps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [criandoCampanha, setCriandoCampanha] = useState(false);

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

      // Atualizar status para "ativa"
      await supabase
        .from('campanhas_prospeccao')
        .update({
          status: 'ativa',
          iniciada_em: new Date().toISOString()
        })
        .eq('id', campanhaId);

      // Chamar função de descoberta
      const funcao = campanha.tipo === 'b2b' ? 'generate-leads-b2b' : 'generate-leads-b2c';
      
      toast.info(`Iniciando descoberta de leads ${campanha.tipo.toUpperCase()}...`);

      const { data, error } = await supabase.functions.invoke(funcao, {
        body: { campanha_id: campanhaId, limite: 50 }
      });

      if (error) throw error;

      toast.success(`${data.total_encontrados} leads descobertos! Iniciando enriquecimento...`);

      // Chamar função de enriquecimento
      await supabase.functions.invoke('enrich-lead-bulk', {
        body: { campanha_id: campanhaId, limite: 10 }
      });

      toast.success("Enriquecimento iniciado!");
      loadData();

    } catch (error: any) {
      console.error("Erro ao iniciar campanha:", error);
      toast.error(error.message);
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

        <div className="grid gap-6">
          {campanhas.map((campanha) => {
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
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Eye className="mr-2 h-4 w-4" />
                        Ver Detalhes
                      </Button>
                      {campanha.status === 'rascunho' && (
                        <Button
                          size="sm"
                          onClick={() => handleIniciarCampanha(campanha.id)}
                        >
                          <Play className="mr-2 h-4 w-4" />
                          Iniciar
                        </Button>
                      )}
                      {campanha.status === 'ativa' && (
                        <Button size="sm" variant="outline">
                          <Pause className="mr-2 h-4 w-4" />
                          Pausar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4">
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
