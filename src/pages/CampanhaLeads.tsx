import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { ArrowLeft, Search, Loader2, Users, Copy, Send, Sparkles } from 'lucide-react';

export default function CampanhaLeads() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campanha, setCampanha] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [showMensagensModal, setShowMensagensModal] = useState(false);
  const [enriching, setEnriching] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
    filterLeads();
  }, [searchTerm, statusFilter, leads]);

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
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (campanhaError) throw campanhaError;
      setCampanha(campanhaData);

      // Carregar todos os leads
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads_descobertos')
        .select('*')
        .eq('campanha_id', id)
        .order('score', { ascending: false, nullsFirst: false });

      if (leadsError) throw leadsError;
      setLeads(leadsData || []);

    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const filterLeads = () => {
    let filtered = [...leads];

    // Filtro por status
    if (statusFilter !== 'todos') {
      filtered = filtered.filter(lead => lead.status === statusFilter);
    }

    // Filtro por busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(lead => 
        (lead.nome_profissional?.toLowerCase().includes(term)) ||
        (lead.razao_social?.toLowerCase().includes(term)) ||
        (lead.profissao?.toLowerCase().includes(term)) ||
        (lead.especialidade?.toLowerCase().includes(term)) ||
        (lead.cidade?.toLowerCase().includes(term))
      );
    }

    setFilteredLeads(filtered);
  };

  const handleVerMensagens = (lead: any) => {
    setSelectedLead(lead);
    setShowMensagensModal(true);
  };

  const handleCopyMensagem = (mensagem: string) => {
    navigator.clipboard.writeText(mensagem);
    toast.success('Mensagem copiada!');
  };

  const handleSendWhatsApp = (lead: any, mensagem: string) => {
    if (!lead.telefone) {
      toast.error('Lead não possui telefone cadastrado');
      return;
    }
    
    const phone = lead.telefone.replace(/\D/g, '');
    const url = `https://wa.me/55${phone}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
    toast.success('WhatsApp aberto!');
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      descoberto: { variant: 'secondary', label: 'Descoberto' },
      enriquecendo: { variant: 'outline', label: 'Enriquecendo...' },
      enriquecido: { variant: 'default', label: 'Enriquecido' },
      qualificado: { variant: 'default', label: 'Qualificado' },
    };
    const config = variants[status] || variants.descoberto;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-orange-500';
  };

  const handleEnriquecerLeads = async () => {
    if (!id) return;
    
    setEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke('enrich-lead-bulk', {
        body: { campanha_id: id, limite: 10 }
      });

      if (error) throw error;

      toast.success(`${data.processados} leads enriquecidos com sucesso!`);
      loadData(); // Recarregar dados
    } catch (error: any) {
      console.error('Erro ao enriquecer leads:', error);
      toast.error('Erro ao enriquecer leads: ' + error.message);
    } finally {
      setEnriching(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const stats = campanha?.stats || {};
  const todosCont = leads.length;
  const descobertosCont = leads.filter(l => l.status === 'descoberto').length;
  const qualificadosCont = leads.filter(l => l.status === 'qualificado').length;
  const mensagensCont = leads.filter(l => l.mensagens_geradas).length;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate(`/campanhas/${id}`)} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Leads - {campanha?.nome}</h1>
              <p className="text-muted-foreground">
                {filteredLeads.length} leads encontrados
              </p>
            </div>
            {descobertosCont > 0 && (
              <Button 
                onClick={handleEnriquecerLeads} 
                disabled={enriching}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                {enriching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enriquecendo...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Enriquecer Leads ({descobertosCont})
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Tabs de filtro */}
              <Tabs value={statusFilter} onValueChange={setStatusFilter} className="flex-1">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="todos">
                    Todos ({todosCont})
                  </TabsTrigger>
                  <TabsTrigger value="descoberto">
                    Descobertos ({descobertosCont})
                  </TabsTrigger>
                  <TabsTrigger value="qualificado">
                    Qualificados ({qualificadosCont})
                  </TabsTrigger>
                  <TabsTrigger value="mensagens">
                    Com Mensagens ({mensagensCont})
                  </TabsTrigger>
                  <TabsTrigger value="enviados">
                    Enviados (0)
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Busca */}
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar leads..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Leads */}
        <div className="space-y-4">
          {filteredLeads.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum lead encontrado</h3>
                <p className="text-muted-foreground">
                  {searchTerm ? 'Tente outro termo de busca' : 'Aguarde o processamento da campanha'}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredLeads.map((lead) => (
              <Card key={lead.id} className={`${
                lead.score >= 80 ? 'border-l-4 border-l-green-500' :
                lead.score >= 60 ? 'border-l-4 border-l-yellow-500' :
                lead.score >= 40 ? 'border-l-4 border-l-orange-500' : ''
              }`}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">
                          {lead.tipo === 'b2c' 
                            ? (lead.nome_profissional || 'Sem nome')
                            : (lead.razao_social || lead.nome_fantasia || 'Sem nome')}
                        </h3>
                        {lead.score && (
                          <Badge variant="default" className={getScoreColor(lead.score)}>
                            {lead.score}/100
                          </Badge>
                        )}
                        {getStatusBadge(lead.status)}
                      </div>

                      <p className="text-sm text-muted-foreground mb-3">
                        {lead.tipo === 'b2c' ? (
                          <>
                            {lead.profissao && `${lead.profissao}`}
                            {lead.especialidade && ` • ${lead.especialidade}`}
                            {lead.cidade && ` • ${lead.cidade}, ${lead.estado}`}
                          </>
                        ) : (
                          <>
                            {lead.cnpj && `CNPJ: ${lead.cnpj}`}
                            {lead.cidade && ` • ${lead.cidade}, ${lead.estado}`}
                          </>
                        )}
                      </p>

                      {/* Contatos */}
                      <div className="space-y-1 mb-3">
                        {lead.telefone && (
                          <p className="text-sm flex items-center gap-2">
                            📱 {lead.telefone}
                          </p>
                        )}
                        {lead.email && (
                          <p className="text-sm flex items-center gap-2">
                            📧 {lead.email}
                          </p>
                        )}
                        {lead.linkedin_url && (
                          <p className="text-sm flex items-center gap-2">
                            💼 <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                              LinkedIn
                            </a>
                          </p>
                        )}
                        {lead.instagram_username && (
                          <p className="text-sm flex items-center gap-2">
                            📸 @{lead.instagram_username}
                          </p>
                        )}
                      </div>

                      {/* Insights */}
                      {lead.insights && lead.insights.length > 0 && (
                        <div className="mb-3">
                          <p className="text-sm font-medium mb-1">Insights:</p>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            {lead.insights.slice(0, 3).map((insight: string, idx: number) => (
                              <li key={idx}>• {insight}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Justificativa */}
                      {lead.justificativa && (
                        <p className="text-sm text-muted-foreground italic">
                          "{lead.justificativa}"
                        </p>
                      )}
                    </div>

                    {/* Ações */}
                    <div className="flex flex-col gap-2 ml-4">
                      {lead.mensagens_geradas && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleVerMensagens(lead)}
                        >
                          ✉️ Mensagens
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Modal de Mensagens */}
        <Dialog open={showMensagensModal} onOpenChange={setShowMensagensModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                Mensagens para {selectedLead?.nome_profissional || selectedLead?.razao_social}
              </DialogTitle>
              <DialogDescription>
                {selectedLead?.score && (
                  <span className="flex items-center gap-2">
                    Score: <Badge variant="default">{selectedLead.score}/100</Badge>
                    {selectedLead.score >= 80 && <span>🔥 Lead Quente</span>}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            
            {selectedLead?.mensagens_geradas && (
              <Tabs defaultValue="profissional" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="profissional">Profissional</TabsTrigger>
                  <TabsTrigger value="amigavel">Amigável</TabsTrigger>
                  <TabsTrigger value="entusiasta">Entusiasta</TabsTrigger>
                </TabsList>
                
                {Object.entries(selectedLead.mensagens_geradas).map(([estilo, mensagem]) => (
                  <TabsContent key={estilo} value={estilo} className="space-y-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="bg-[#dcf8c6] p-4 rounded-lg mb-4 whitespace-pre-wrap text-sm">
                          {mensagem as string}
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCopyMensagem(mensagem as string)}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Copiar
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSendWhatsApp(selectedLead, mensagem as string)}
                            disabled={!selectedLead.telefone}
                          >
                            <Send className="mr-2 h-4 w-4" />
                            Enviar WhatsApp
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
