import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Search, TrendingUp, Users, MessageSquare, Download, AlertCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function Prospects() {
  const [loading, setLoading] = useState(false);
  const [cnpj, setCnpj] = useState('');
  const [prospects, setProspects] = useState<any[]>([]);
  const [selectedProspect, setSelectedProspect] = useState<any>(null);
  const { toast } = useToast();

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
      const { data, error } = await supabase.functions.invoke('discovery-cnpj', {
        body: {
          cnpj,
          concessionaria_id: 'default', // Substituir por ID real
        },
      });

      if (error) throw error;

      toast({
        title: 'Sucesso!',
        description: `Empresa encontrada: ${data.empresa.razao_social}. ${data.socios.length} sócios adicionados à fila de enriquecimento.`,
      });

      setCnpj('');
      loadProspects();
    } catch (error: any) {
      toast({
        title: 'Erro ao buscar CNPJ',
        description: error.message,
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
            empresa:empresas(*),
            enrichment:socios_enriquecidos(*)
          )
        `)
        .order('score', { ascending: false });

      if (error) throw error;
      setProspects(data || []);
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

      loadProspects();
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
        <div>
          <h1 className="text-3xl font-bold">Dashboard de Prospects</h1>
          <p className="text-muted-foreground">Sistema inteligente de qualificação e abordagem de leads premium</p>
        </div>
        <Button onClick={handleExportZAPI} disabled={loading}>
          <Download className="mr-2 h-4 w-4" />
          Exportar para ZAPI
        </Button>
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
            <CardContent>
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

              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  O processamento completo (enriquecimento + qualificação) leva de 2-5 minutos por sócio.
                  Você será notificado quando estiver pronto.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Prospects */}
        <TabsContent value="prospects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Prospects Qualificados</CardTitle>
              <CardDescription>
                Lista de todos os prospects analisados pela IA, ordenados por score
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : prospects.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    Nenhum prospect encontrado. Use a aba "Descobrir CNPJ" para começar.
                  </AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Score</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Patrimônio Est.</TableHead>
                      <TableHead>Recomendação</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prospects.map((prospect) => (
                      <TableRow key={prospect.id}>
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
    </div>
  );
}
