import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Search, TrendingUp, Users, MessageSquare, Download, AlertCircle, Clock, ArrowLeft, Filter, X, Target, Send, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function Prospects() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [cnpj, setCnpj] = useState('');
  const [prospects, setProspects] = useState<any[]>([]);
  const [filteredProspects, setFilteredProspects] = useState<any[]>([]);
  const [selectedProspect, setSelectedProspect] = useState<any>(null);
  const { toast } = useToast();

  // Filtros
  const [filters, setFilters] = useState({
    scoreMinimo: 0,
    setor: 'TODOS',
    estado: 'TODOS',
    patrimonio: 0,
    recomendacao: 'TODOS'
  });
  const [showFilters, setShowFilters] = useState(false);

  // Estados para mensagens WhatsApp
  const [selectedProspects, setSelectedProspects] = useState<string[]>([]);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [currentProspectMessages, setCurrentProspectMessages] = useState<any>(null);
  const [selectedMessageType, setSelectedMessageType] = useState<string>('professional');

  // ============================================
  // BUSCAR CNPJ (Discovery)
  // ============================================
  const handleDiscoverCNPJ = async () => {
    if (!cnpj) {
      toast({
        title: 'Erro',
        description: 'Digite um CNPJ válido',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      console.log('🔍 Calling discovery-cnpj with:', cnpj);
      
      const { data, error } = await supabase.functions.invoke('discovery-cnpj', {
        body: {
          cnpj,
          concessionaria_id: 'default',
        },
      });

      console.log('📥 Function response:', { data, error });

      if (error) {
        console.error('Function error:', error);
        throw new Error(error.message || 'Erro ao buscar CNPJ');
      }

      if (!data) {
        throw new Error('Nenhum dado retornado da função');
      }

      if (!data.empresa) {
        console.error('Data received but no empresa:', data);
        throw new Error('Dados da empresa não encontrados na resposta');
      }

      toast({
        title: 'Sucesso!',
        description: `Empresa: ${data.empresa.razao_social}. ${data.socios?.length || 0} sócios encontrados.`,
      });

      setCnpj('');
      await loadProspects();
    } catch (error: any) {
      console.error('Discovery error:', error);
      toast({
        title: 'Erro ao buscar CNPJ',
        description: error.message || 'Erro desconhecido. Verifique o CNPJ e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // CARREGAR PROSPECTS
  // ============================================
  const loadProspects = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('prospects_qualificados')
        .select(`
          *,
          socio:socios(
            *,
            empresa:empresas(*)
          )
        `)
        .order('score', { ascending: false });

      if (error) throw error;
      setProspects(data || []);
      setFilteredProspects(data || []);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar prospects',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // APLICAR FILTROS
  // ============================================
  useEffect(() => {
    if (!prospects.length) return;

    let filtered = [...prospects];

    // Filtro por score mínimo
    if (filters.scoreMinimo > 0) {
      filtered = filtered.filter(p => p.score >= filters.scoreMinimo);
    }

    // Filtro por setor
    if (filters.setor !== 'TODOS') {
      filtered = filtered.filter(p => p.socio?.empresa?.cnae?.includes(filters.setor));
    }

    // Filtro por estado
    if (filters.estado !== 'TODOS') {
      filtered = filtered.filter(p => p.socio?.empresa?.endereco?.uf === filters.estado);
    }

    // Filtro por patrimônio mínimo
    if (filters.patrimonio > 0) {
      filtered = filtered.filter(p => p.socio?.patrimonio_estimado >= filters.patrimonio);
    }

    // Filtro por recomendação
    if (filters.recomendacao !== 'TODOS') {
      filtered = filtered.filter(p => p.recomendacao === filters.recomendacao);
    }

    setFilteredProspects(filtered);
  }, [filters, prospects]);

  // Carregar na montagem
  useEffect(() => {
    loadProspects();
  }, []);

  // ============================================
  // GERAR MENSAGENS
  // ============================================
  const handleGenerateMessages = async (prospectId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-message', {
        body: { prospect_id: prospectId },
      });

      if (error) throw error;

      toast({
        title: 'Mensagens geradas!',
        description: '3 variações criadas com sucesso.',
      });

      // Atualizar lista de prospects
      await loadProspects();
      
      // Abrir dialog com as mensagens
      setCurrentProspectMessages({
        prospectId,
        messages: data.messages
      });
      setMessageDialogOpen(true);

    } catch (error: any) {
      toast({
        title: 'Erro ao gerar mensagens',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // ENVIAR PARA WHATSAPP BULK
  // ============================================
  const handleSendToWhatsApp = async () => {
    if (selectedProspects.length === 0) {
      toast({
        title: 'Nenhum prospect selecionado',
        description: 'Selecione pelo menos um prospect para enviar',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Preparar mensagens para envio
      const contactsToSend = [];

      for (const prospectId of selectedProspects) {
        const prospect = prospects.find(p => p.id === prospectId);
        if (!prospect) continue;

        const mensagens = prospect.mensagens_geradas;
        if (!mensagens) {
          toast({
            title: 'Mensagens não geradas',
            description: `Gere mensagens para ${prospect.socio.nome} primeiro`,
            variant: 'destructive',
          });
          continue;
        }

        // Pegar mensagem selecionada ou usar professional como default
        const messageType = prospect.mensagem_selecionada || 'professional';
        const message = mensagens[messageType];

        contactsToSend.push({
          phone: prospect.socio.empresa.telefone,
          name: prospect.socio.nome,
          message: message,
          customFields: {
            prospectId: prospect.id,
            score: prospect.score,
            empresa: prospect.socio.empresa.nome_fantasia
          }
        });
      }

      if (contactsToSend.length === 0) {
        throw new Error('Nenhum contato válido para envio');
      }

      // Enviar para função whatsapp-bulk-send
      const { data, error } = await supabase.functions.invoke('whatsapp-bulk-send', {
        body: { 
          campaignName: `Prospects - ${new Date().toLocaleDateString()}`,
          messageTemplate: 'Mensagem personalizada por prospect',
          contacts: contactsToSend 
        },
      });

      if (error) throw error;

      // Atualizar prospects como enviados
      for (const prospectId of selectedProspects) {
        await supabase
          .from('prospects_qualificados')
          .update({
            enviado_whatsapp: true,
            enviado_em: new Date().toISOString()
          })
          .eq('id', prospectId);
      }

      toast({
        title: 'Enviado com sucesso!',
        description: `${contactsToSend.length} mensagens adicionadas à campanha WhatsApp`,
      });

      setSelectedProspects([]);
      await loadProspects();

    } catch (error: any) {
      toast({
        title: 'Erro ao enviar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // SALVAR MENSAGEM SELECIONADA
  // ============================================
  const handleSaveSelectedMessage = async () => {
    if (!currentProspectMessages) return;

    try {
      const { error } = await supabase
        .from('prospects_qualificados')
        .update({
          mensagem_selecionada: selectedMessageType
        })
        .eq('id', currentProspectMessages.prospectId);

      if (error) throw error;

      toast({
        title: 'Mensagem salva!',
        description: 'A variação selecionada foi salva.',
      });

      setMessageDialogOpen(false);
      await loadProspects();

    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // ============================================
  // EXPORTAR PARA ZAPI
  // ============================================
  const handleExportZAPI = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-zapi', {
        body: { concessionaria_id: 'default' },
      });

      if (error) throw error;

      // Download CSV
      const blob = new Blob([data.csv_content], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zapi-export-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();

      toast({
        title: 'Exportado com sucesso!',
        description: `${data.total_messages} mensagens exportadas.`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao exportar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Dashboard de Prospects</h1>
            <p className="text-muted-foreground">Sistema inteligente de qualificação e abordagem de leads premium</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSendToWhatsApp} disabled={loading || selectedProspects.length === 0}>
            <Send className="mr-2 h-4 w-4" />
            Enviar Selecionados ({selectedProspects.length})
          </Button>
          <Button onClick={handleExportZAPI} disabled={loading} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exportar para ZAPI
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Prospects</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{prospects.length}</div>
            <p className="text-xs text-muted-foreground">Qualificados pela IA</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads Quentes</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {prospects.filter(p => p.score >= 80).length}
            </div>
            <p className="text-xs text-muted-foreground">Score 80+</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mensagens Geradas</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {prospects.filter(p => p.mensagens?.length > 0).length}
            </div>
            <p className="text-xs text-muted-foreground">Aguardando aprovação</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Score Médio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {prospects.length > 0 
                ? Math.round(prospects.reduce((sum, p) => sum + p.score, 0) / prospects.length)
                : 0}
            </div>
            <p className="text-xs text-muted-foreground">De 100 pontos</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="discovery" className="space-y-4">
        <TabsList>
          <TabsTrigger value="discovery">
            <Search className="mr-2 h-4 w-4" />
            Descobrir CNPJ
          </TabsTrigger>
          <TabsTrigger value="prospects">
            <Users className="mr-2 h-4 w-4" />
            Prospects Qualificados
          </TabsTrigger>
          <TabsTrigger value="messages">
            <MessageSquare className="mr-2 h-4 w-4" />
            Mensagens Personalizadas
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Discovery */}
        <TabsContent value="discovery" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Buscar Empresa por CNPJ</CardTitle>
              <CardDescription>
                Digite o CNPJ para descobrir a empresa e seus sócios. O sistema automaticamente:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Busca dados na Brasil API</li>
                  <li>Extrai sócios decisores (CEO, Diretores)</li>
                  <li>Adiciona à fila de enriquecimento (LinkedIn, Instagram, Notícias)</li>
                  <li>Qualifica com IA (score 0-100)</li>
                </ul>
              </CardDescription>
            </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="00.000.000/0000-00"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                className="max-w-xs"
              />
              <Button onClick={handleDiscoverCNPJ} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Buscar
                  </>
                )}
              </Button>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                O processamento completo (enriquecimento + qualificação) leva de 2-5 minutos por sócio.
                Você será notificado quando estiver pronto.
              </AlertDescription>
            </Alert>

            <div className="pt-4 border-t">
              <h4 className="font-semibold mb-3">Ou configure a busca automática:</h4>
              <div className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => navigate('/configuracoes-icp')}
                >
                  <Target className="mr-2 h-4 w-4" />
                  Configurar ICP e Automação
                </Button>
                <p className="text-sm text-muted-foreground">
                  Configure seu perfil de cliente ideal (ICP) e ative a busca automática de prospects que atendem seus critérios.
                </p>
              </div>
            </div>
          </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Prospects */}
        <TabsContent value="prospects" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Prospects Qualificados</CardTitle>
                  <CardDescription>
                    Lista de todos os prospects analisados pela IA, ordenados por score
                  </CardDescription>
                </div>
                <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
                  <Filter className="mr-2 h-4 w-4" />
                  {showFilters ? 'Ocultar Filtros' : 'Filtros'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filtros */}
              {showFilters && (
                <Card className="bg-muted/50">
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-semibold">Filtros de Busca</h4>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setFilters({
                          scoreMinimo: 0,
                          setor: 'TODOS',
                          estado: 'TODOS',
                          patrimonio: 0,
                          recomendacao: 'TODOS'
                        })}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Limpar Filtros
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                      <div className="space-y-2">
                        <Label>Score Mínimo</Label>
                        <Select 
                          value={filters.scoreMinimo.toString()} 
                          onValueChange={(v) => setFilters({...filters, scoreMinimo: Number(v)})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Todos</SelectItem>
                            <SelectItem value="60">60+</SelectItem>
                            <SelectItem value="70">70+</SelectItem>
                            <SelectItem value="80">80+</SelectItem>
                            <SelectItem value="90">90+ (Quentes)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Setor</Label>
                        <Select 
                          value={filters.setor} 
                          onValueChange={(v) => setFilters({...filters, setor: v})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="TODOS">Todos</SelectItem>
                            <SelectItem value="TECNOLOGIA">Tecnologia</SelectItem>
                            <SelectItem value="FINANCAS">Finanças</SelectItem>
                            <SelectItem value="SAUDE">Saúde</SelectItem>
                            <SelectItem value="VAREJO">Varejo</SelectItem>
                            <SelectItem value="INDUSTRIA">Indústria</SelectItem>
                            <SelectItem value="SERVICOS">Serviços</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Estado</Label>
                        <Select 
                          value={filters.estado} 
                          onValueChange={(v) => setFilters({...filters, estado: v})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="TODOS">Todos</SelectItem>
                            <SelectItem value="SP">São Paulo</SelectItem>
                            <SelectItem value="RJ">Rio de Janeiro</SelectItem>
                            <SelectItem value="MG">Minas Gerais</SelectItem>
                            <SelectItem value="RS">Rio Grande do Sul</SelectItem>
                            <SelectItem value="PR">Paraná</SelectItem>
                            <SelectItem value="SC">Santa Catarina</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Patrimônio Mínimo</Label>
                        <Select 
                          value={filters.patrimonio.toString()} 
                          onValueChange={(v) => setFilters({...filters, patrimonio: Number(v)})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Todos</SelectItem>
                            <SelectItem value="500000">R$ 500K+</SelectItem>
                            <SelectItem value="1000000">R$ 1M+</SelectItem>
                            <SelectItem value="5000000">R$ 5M+</SelectItem>
                            <SelectItem value="10000000">R$ 10M+</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Recomendação</Label>
                        <Select 
                          value={filters.recomendacao} 
                          onValueChange={(v) => setFilters({...filters, recomendacao: v})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="TODOS">Todos</SelectItem>
                            <SelectItem value="contatar_agora">Contatar Agora</SelectItem>
                            <SelectItem value="aguardar">Aguardar</SelectItem>
                            <SelectItem value="descartar">Descartar</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="mt-4 text-sm text-muted-foreground">
                      Mostrando {filteredProspects.length} de {prospects.length} prospects
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Tabela */}
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : filteredProspects.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    {prospects.length === 0 
                      ? 'Nenhum prospect encontrado. Use a aba "Descobrir CNPJ" para começar.'
                      : 'Nenhum prospect corresponde aos filtros selecionados. Ajuste os filtros acima.'}
                  </AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <input
                          type="checkbox"
                          checked={selectedProspects.length === filteredProspects.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedProspects(filteredProspects.map(p => p.id));
                            } else {
                              setSelectedProspects([]);
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                      </TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Patrimônio Est.</TableHead>
                      <TableHead>Recomendação</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProspects.map((prospect) => (
                      <TableRow key={prospect.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedProspects.includes(prospect.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedProspects([...selectedProspects, prospect.id]);
                              } else {
                                setSelectedProspects(selectedProspects.filter(id => id !== prospect.id));
                              }
                            }}
                            className="rounded border-gray-300"
                          />
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={prospect.score >= 80 ? 'default' : prospect.score >= 60 ? 'secondary' : 'outline'}
                            className={
                              prospect.score >= 80 ? 'bg-green-600' : 
                              prospect.score >= 60 ? 'bg-yellow-600' : ''
                            }
                          >
                            {prospect.score}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{prospect.socio?.nome}</TableCell>
                        <TableCell>{prospect.socio?.qualificacao}</TableCell>
                        <TableCell>{prospect.socio?.empresa?.nome_fantasia}</TableCell>
                        <TableCell>
                          R$ {prospect.socio?.patrimonio_estimado?.toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            prospect.recomendacao === 'contatar_agora' ? 'default' :
                            prospect.recomendacao === 'aguardar' ? 'secondary' : 'outline'
                          }>
                            {prospect.recomendacao === 'contatar_agora' ? 'Contatar Agora' :
                             prospect.recomendacao === 'aguardar' ? 'Aguardar' : 'Descartar'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {prospect.enviado_whatsapp ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Enviado
                            </Badge>
                          ) : prospect.mensagens_geradas ? (
                            <Badge variant="outline">Mensagens OK</Badge>
                          ) : (
                            <Badge variant="outline" className="text-gray-500">Pendente</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" onClick={() => setSelectedProspect(prospect)}>
                                Ver Detalhes
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl">
                              <DialogHeader>
                                <DialogTitle>{prospect.socio?.nome}</DialogTitle>
                                <DialogDescription>
                                  {prospect.socio?.qualificacao} - {prospect.socio?.empresa?.nome_fantasia}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                {/* Score Breakdown */}
                                <div>
                                  <h4 className="font-semibold mb-2">Análise de Score</h4>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="p-3 bg-slate-50 rounded">
                                      <div className="text-sm text-muted-foreground">Poder Aquisitivo</div>
                                      <div className="text-lg font-bold">{prospect.breakdown?.poder_aquisitivo}/25</div>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded">
                                      <div className="text-sm text-muted-foreground">Momento Certo</div>
                                      <div className="text-lg font-bold">{prospect.breakdown?.momento_certo}/25</div>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded">
                                      <div className="text-sm text-muted-foreground">Fit Produto</div>
                                      <div className="text-lg font-bold">{prospect.breakdown?.fit_produto}/25</div>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded">
                                      <div className="text-sm text-muted-foreground">Sinais de Compra</div>
                                      <div className="text-lg font-bold">{prospect.breakdown?.sinais_compra}/25</div>
                                    </div>
                                  </div>
                                </div>

                                {/* Justificativa */}
                                <div>
                                  <h4 className="font-semibold mb-2">Justificativa IA</h4>
                                  <p className="text-sm text-muted-foreground">{prospect.justificativa}</p>
                                </div>

                                {/* Insights */}
                                {prospect.insights && prospect.insights.length > 0 && (
                                  <div>
                                    <h4 className="font-semibold mb-2">Insights Chave</h4>
                                    <ul className="list-disc list-inside space-y-1">
                                      {prospect.insights.map((insight: string, i: number) => (
                                        <li key={i} className="text-sm text-muted-foreground">{insight}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Enriquecimento */}
                                {prospect.socio?.enrichment && (
                                  <div>
                                    <h4 className="font-semibold mb-2">Dados Enriquecidos</h4>
                                    <div className="space-y-2 text-sm">
                                      {prospect.socio.enrichment.linkedin_url && (
                                        <div>
                                          <span className="font-medium">LinkedIn:</span>{' '}
                                          <a 
                                            href={prospect.socio.enrichment.linkedin_url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline"
                                          >
                                            Ver perfil
                                          </a>
                                        </div>
                                      )}
                                      {prospect.socio.enrichment.instagram_username && (
                                        <div>
                                          <span className="font-medium">Instagram:</span> @{prospect.socio.enrichment.instagram_username}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                <Button 
                                  className="w-full" 
                                  onClick={() => handleGenerateMessages(prospect.id)}
                                  disabled={loading}
                                >
                                  {loading ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Gerando...
                                    </>
                                  ) : (
                                    <>
                                      <MessageSquare className="mr-2 h-4 w-4" />
                                      Gerar Mensagens Personalizadas
                                    </>
                                  )}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: Messages */}
        <TabsContent value="messages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mensagens Personalizadas</CardTitle>
              <CardDescription>
                Revise e aprove as mensagens geradas pela IA antes de exportar para o ZAPI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  Esta funcionalidade será implementada em breve. Por enquanto, gere mensagens na aba "Prospects Qualificados".
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de Mensagens Geradas */}
      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mensagens Geradas - 3 Variações</DialogTitle>
            <DialogDescription>
              Escolha a melhor abordagem para este prospect
            </DialogDescription>
          </DialogHeader>
          
          {currentProspectMessages && (
            <div className="space-y-4">
              <RadioGroup value={selectedMessageType} onValueChange={setSelectedMessageType}>
                {/* Professional */}
                <div className="space-y-2 p-4 border rounded-lg">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="professional" id="professional" />
                    <Label htmlFor="professional" className="font-semibold text-lg cursor-pointer">
                      🎯 Tom Profissional
                    </Label>
                  </div>
                  <Textarea 
                    value={currentProspectMessages.messages.professional}
                    readOnly
                    className="min-h-[120px] bg-slate-50"
                  />
                </div>

                {/* Friendly */}
                <div className="space-y-2 p-4 border rounded-lg">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="friendly" id="friendly" />
                    <Label htmlFor="friendly" className="font-semibold text-lg cursor-pointer">
                      😊 Tom Amigável
                    </Label>
                  </div>
                  <Textarea 
                    value={currentProspectMessages.messages.friendly}
                    readOnly
                    className="min-h-[120px] bg-slate-50"
                  />
                </div>

                {/* Enthusiast */}
                <div className="space-y-2 p-4 border rounded-lg">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="enthusiast" id="enthusiast" />
                    <Label htmlFor="enthusiast" className="font-semibold text-lg cursor-pointer">
                      🚀 Tom Entusiasta
                    </Label>
                  </div>
                  <Textarea 
                    value={currentProspectMessages.messages.enthusiast}
                    readOnly
                    className="min-h-[120px] bg-slate-50"
                  />
                </div>
              </RadioGroup>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSaveSelectedMessage} className="flex-1">
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Salvar Variação Selecionada
                </Button>
                <Button variant="outline" onClick={() => setMessageDialogOpen(false)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
