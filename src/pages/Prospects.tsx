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
import { Loader2, Search, TrendingUp, Users, MessageSquare, Download, AlertCircle, Clock, ArrowLeft, Filter, X, Target, Send, CheckCircle2, Briefcase, Heart, Zap, Sparkles, Save, Linkedin, Instagram, Globe, Copy, Check, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function Prospects() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [cnpj, setCnpj] = useState('');
  const [prospects, setProspects] = useState<any[]>([]);
  const [filteredProspects, setFilteredProspects] = useState<any[]>([]);
  const [selectedProspect, setSelectedProspect] = useState<any>(null);
  const [empresaEncontrada, setEmpresaEncontrada] = useState<any>(null);
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
  const [processingStage, setProcessingStage] = useState<string>('');
  
  // Estados para enriquecimento individual
  const [enrichingSocioId, setEnrichingSocioId] = useState<string | null>(null);
  const [enrichedSocios, setEnrichedSocios] = useState<Record<string, any>>({});
  
  // Estados para mensagens LinkedIn
  const [linkedinMessageDialogOpen, setLinkedinMessageDialogOpen] = useState(false);
  const [generatingLinkedinMessages, setGeneratingLinkedinMessages] = useState<string | null>(null);
  const [linkedinMessages, setLinkedinMessages] = useState<{
    socio: any;
    empresa: any;
    mensagens: { profissional: string; entusiasta: string; direto: string };
  } | null>(null);
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);
  const [linkedinSuggestionDialogOpen, setLinkedinSuggestionDialogOpen] = useState(false);
  const [linkedinCustomSuggestion, setLinkedinCustomSuggestion] = useState('');
  const [pendingLinkedinSocio, setPendingLinkedinSocio] = useState<any>(null);

  // ============================================
  // ENRIQUECER SÓCIO (LinkedIn, Instagram)
  // ============================================
  const handleEnrichSocio = async (socioId: string, socioNome: string) => {
    setEnrichingSocioId(socioId);
    
    try {
      toast({
        title: 'Enriquecendo dados...',
        description: `Buscando LinkedIn, Instagram e notícias de ${socioNome}`,
      });

      console.log('🔍 Enriquecendo sócio:', socioId, socioNome);
      
      const { data, error } = await supabase.functions.invoke('enrich-socio', {
        body: { socio_id: socioId },
      });

      if (error) throw error;

      console.log('✅ Dados enriquecidos:', data);
      
      // Salvar resultado no estado local (edge function retorna "enrichment")
      const enrichData = data.enrichment || data.enrichment_data || data;
      setEnrichedSocios(prev => ({
        ...prev,
        [socioId]: enrichData
      }));

      // Atualizar também o empresaEncontrada se existir
      if (empresaEncontrada) {
        setEmpresaEncontrada(prev => ({
          ...prev,
          socios: prev.socios.map((s: any) => 
            s.id === socioId 
              ? { ...s, enrichment_data: enrichData }
              : s
          )
        }));
      }

      toast({
        title: 'Enriquecimento concluído!',
        description: `Dados de ${socioNome} atualizados com redes sociais.`,
      });

    } catch (error: any) {
      console.error('❌ Erro no enriquecimento:', error);
      toast({
        title: 'Erro ao enriquecer',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setEnrichingSocioId(null);
    }
  };

  // ============================================
  // GERAR MENSAGENS LINKEDIN
  // ============================================
  const openLinkedinSuggestionDialog = (socio: any) => {
    setPendingLinkedinSocio(socio);
    setLinkedinCustomSuggestion('');
    setLinkedinSuggestionDialogOpen(true);
  };

  const handleGenerateLinkedinMessages = async (socio: any, customSuggestion?: string) => {
    setLinkedinSuggestionDialogOpen(false);
    setGeneratingLinkedinMessages(socio.id);
    
    try {
      toast({
        title: 'Gerando mensagens...',
        description: `Criando 3 variações de mensagem para ${socio.nome}`,
      });

      const { data, error } = await supabase.functions.invoke('gerar-mensagens-linkedin', {
        body: { 
          socio: {
            ...socio,
            enrichment_data: socio.enrichment_data || enrichedSocios[socio.id]
          },
          empresa: empresaEncontrada,
          contexto_adicional: customSuggestion || ''
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao gerar mensagens');

      console.log('✅ Mensagens LinkedIn geradas:', data.mensagens);
      
      setLinkedinMessages({
        socio,
        empresa: empresaEncontrada,
        mensagens: data.mensagens
      });
      setLinkedinMessageDialogOpen(true);

      toast({
        title: 'Mensagens geradas!',
        description: 'Escolha a melhor variação para enviar no LinkedIn.',
      });

    } catch (error: any) {
      console.error('❌ Erro ao gerar mensagens:', error);
      toast({
        title: 'Erro ao gerar mensagens',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setGeneratingLinkedinMessages(null);
      setPendingLinkedinSocio(null);
    }
  };

  const handleCopyMessage = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessage(type);
    setTimeout(() => setCopiedMessage(null), 2000);
    toast({
      title: 'Mensagem copiada!',
      description: 'Cole no LinkedIn para enviar.',
    });
  };

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
        body: { cnpj },
      });

      console.log('📥 Raw response:', JSON.stringify({ data, error }, null, 2));

      if (error) {
        console.error('Function error:', error);
        throw new Error(error.message || 'Erro ao buscar CNPJ');
      }

      if (!data) {
        console.error('No data returned');
        throw new Error('Nenhum dado retornado da função');
      }

      // Verificar se tem empresa na resposta
      if (!data.empresa) {
        console.error('Data structure:', Object.keys(data));
        console.error('Full data:', JSON.stringify(data, null, 2));
        throw new Error('Dados da empresa não encontrados na resposta. Estrutura: ' + Object.keys(data).join(', '));
      }

      // SEMPRE exibir os dados da empresa
      setEmpresaEncontrada({
        empresa: data.empresa,
        socios: data.socios || [],
        jaExistia: data.success === false
      });

      toast({
        title: data.success === false ? 'Empresa já cadastrada' : 'Empresa encontrada!',
        description: `${data.empresa.razao_social} - ${data.socios?.length || 0} sócios encontrados.`,
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
  // PROCESSAR PROSPECT COMPLETO (Pipeline)
  // ============================================
  const processarProspect = async (socioId: string, socioNome: string) => {
    setLoading(true);
    setProcessingStage('Iniciando...');
    
    try {
      toast({
        title: 'Iniciando processamento...',
        description: `Processando ${socioNome}. Isso pode levar 2-5 minutos.`,
      });

      // ETAPA 1: Enriquecer dados
      console.log('🔍 Etapa 1/3: Enriquecendo dados...');
      setProcessingStage('Etapa 1/3: Buscando LinkedIn, Instagram e notícias...');
      toast({
        title: 'Etapa 1/3',
        description: 'Buscando dados no LinkedIn, Instagram e notícias...',
      });

      const { data: enrichData, error: enrichError } = await supabase.functions.invoke(
        'enrich-socio',
        { body: { socio_id: socioId } }
      );

      if (enrichError) throw new Error(`Erro no enriquecimento: ${enrichError.message}`);

      await new Promise(resolve => setTimeout(resolve, 2000));

      // ETAPA 2: Qualificar com IA
      console.log('🤖 Etapa 2/3: Qualificando com IA...');
      setProcessingStage('Etapa 2/3: IA analisando perfil e calculando score...');
      toast({
        title: 'Etapa 2/3',
        description: 'IA analisando perfil e calculando score...',
      });

      const { data: qualifyData, error: qualifyError } = await supabase.functions.invoke(
        'qualify-prospect',
        { body: { socio_id: socioId } }
      );

      console.log('📦 Resposta qualify-prospect COMPLETA:', JSON.stringify(qualifyData, null, 2));

      if (qualifyError) {
        console.error('❌ Erro na qualificação:', qualifyError);
        throw new Error(`Erro na qualificação: ${qualifyError.message}`);
      }

      if (qualifyData && !qualifyData.success) {
        console.error('❌ qualify-prospect retornou success: false');
        throw new Error(`Qualificação falhou: ${qualifyData.error}`);
      }

      // Extrair prospectId e score
      const prospectId = qualifyData?.qualification?.id;
      const score = qualifyData?.qualification?.score || 0;

      console.log('✅ prospectId extraído:', prospectId);
      console.log('✅ score extraído:', score);

      if (!prospectId) {
        console.error('❌ prospectId está undefined!');
        console.error('qualifyData completo:', JSON.stringify(qualifyData, null, 2));
        
        // Fallback: buscar no banco
        console.warn('⚠️ Tentando buscar prospect_id no banco...');
        const { data: foundProspect } = await supabase
          .from('prospects_qualificados')
          .select('id')
          .eq('socio_id', socioId)
          .single();
        
        if (!foundProspect) {
          throw new Error('ID do prospect não foi retornado pela qualificação');
        }
        
        console.log('✅ prospect_id encontrado no banco:', foundProspect.id);
        const fallbackProspectId = foundProspect.id;

        await new Promise(resolve => setTimeout(resolve, 2000));

        // ETAPA 3: Gerar mensagem personalizada
        console.log('✍️ Etapa 3/3: Gerando mensagens personalizadas...');
        setProcessingStage('Etapa 3/3: IA criando 3 variações de mensagem...');
        toast({
          title: 'Etapa 3/3',
          description: 'IA criando 3 variações de mensagem...',
        });

        console.log('✍️ Chamando generate-message com prospect_id:', fallbackProspectId);
        const { data: messageData, error: messageError } = await supabase.functions.invoke(
          'generate-message',
          { body: { prospect_id: fallbackProspectId } }
        );

        console.log('📦 Resposta generate-message COMPLETA:', JSON.stringify(messageData, null, 2));

        if (messageError) {
          console.error('❌ Erro ao gerar mensagens:', messageError);
          throw new Error(`Erro ao gerar mensagens: ${messageError.message}`);
        }

        if (messageData && !messageData.success) {
          console.error('❌ generate-message retornou success: false');
          throw new Error(`Erro ao gerar mensagens: ${messageData.error}`);
        }

        if (messageData && messageData.success && messageData.messages) {
          console.log('✅ Mensagens recebidas com sucesso!');
          setProcessingStage('');
          toast({
            title: '🎉 Processamento Concluído!',
            description: `Score: ${score}/100 - 3 mensagens prontas!`,
          });

          setCurrentProspectMessages({
            prospectId: fallbackProspectId,
            socioId,
            messages: messageData.messages,
            score
          });
          setMessageDialogOpen(true);
          console.log('🎭 Modal aberto com dados (fallback)');
        } else {
          throw new Error('Mensagens não foram geradas corretamente');
        }
      } else {
        // prospectId existe
        await new Promise(resolve => setTimeout(resolve, 2000));

        // ETAPA 3: Gerar mensagem personalizada
        console.log('✍️ Etapa 3/3: Gerando mensagens personalizadas...');
        setProcessingStage('Etapa 3/3: IA criando 3 variações de mensagem...');
        toast({
          title: 'Etapa 3/3',
          description: 'IA criando 3 variações de mensagem...',
        });

        console.log('✍️ Chamando generate-message com prospect_id:', prospectId);
        const { data: messageData, error: messageError } = await supabase.functions.invoke(
          'generate-message',
          { body: { prospect_id: prospectId } }
        );

        console.log('📦 Resposta generate-message COMPLETA:', JSON.stringify(messageData, null, 2));

        if (messageError) {
          console.error('❌ Erro ao gerar mensagens:', messageError);
          throw new Error(`Erro ao gerar mensagens: ${messageError.message}`);
        }

        if (messageData && !messageData.success) {
          console.error('❌ generate-message retornou success: false');
          throw new Error(`Erro ao gerar mensagens: ${messageData.error}`);
        }

        if (messageData && messageData.success && messageData.messages) {
          console.log('✅ Mensagens recebidas com sucesso!');
          setProcessingStage('');
          toast({
            title: '🎉 Processamento Concluído!',
            description: `Score: ${score}/100 - 3 mensagens prontas!`,
          });

          setCurrentProspectMessages({
            prospectId,
            socioId,
            messages: messageData.messages,
            score
          });
          setMessageDialogOpen(true);
          console.log('🎭 Modal aberto com dados');
        } else {
          throw new Error('Mensagens não foram geradas corretamente');
        }
      }

      // Recarregar lista
      await loadProspects();

    } catch (error: any) {
      console.error('❌ Erro no processamento:', error);
      setProcessingStage('');
      toast({
        title: 'Erro no processamento',
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

            {/* DADOS DA EMPRESA ENCONTRADA */}
            {empresaEncontrada && (
              <Card className="bg-primary/5 border-primary/20">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {empresaEncontrada.jaExistia && (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                            Já Cadastrada
                          </Badge>
                        )}
                        {empresaEncontrada.empresa.razao_social}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {empresaEncontrada.empresa.nome_fantasia}
                      </CardDescription>
                      {processingStage && (
                        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {processingStage}
                        </div>
                      )}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => setEmpresaEncontrada(null)}
                      disabled={loading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Dados principais */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <Label className="text-muted-foreground">CNPJ</Label>
                      <p className="font-medium">{empresaEncontrada.empresa.cnpj}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Situação</Label>
                      <p className="font-medium">{empresaEncontrada.empresa.situacao_cadastral || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Porte</Label>
                      <p className="font-medium">{empresaEncontrada.empresa.porte || 'N/A'}</p>
                    </div>
                    {empresaEncontrada.empresa.capital_social && (
                      <div>
                        <Label className="text-muted-foreground">Capital Social</Label>
                        <p className="font-medium">
                          R$ {Number(empresaEncontrada.empresa.capital_social).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    )}
                    {empresaEncontrada.empresa.telefone && (
                      <div>
                        <Label className="text-muted-foreground">Telefone</Label>
                        <p className="font-medium">{empresaEncontrada.empresa.telefone}</p>
                      </div>
                    )}
                    {empresaEncontrada.empresa.email && (
                      <div>
                        <Label className="text-muted-foreground">Email</Label>
                        <p className="font-medium">{empresaEncontrada.empresa.email}</p>
                      </div>
                    )}
                  </div>

                  {/* Endereço */}
                  {empresaEncontrada.empresa.endereco && (
                    <div className="pt-2 border-t">
                      <Label className="text-muted-foreground">Endereço</Label>
                      <p className="text-sm">
                        {empresaEncontrada.empresa.endereco.logradouro}, 
                        {empresaEncontrada.empresa.endereco.numero} 
                        {empresaEncontrada.empresa.endereco.complemento && ` - ${empresaEncontrada.empresa.endereco.complemento}`}
                        <br />
                        {empresaEncontrada.empresa.endereco.bairro} - 
                        {empresaEncontrada.empresa.endereco.municipio}/{empresaEncontrada.empresa.endereco.uf}
                        <br />
                        CEP: {empresaEncontrada.empresa.endereco.cep}
                      </p>
                    </div>
                  )}

                  {/* Sócios */}
                  {empresaEncontrada.socios && empresaEncontrada.socios.length > 0 && (
                    <div className="pt-2 border-t">
                      <Label className="text-muted-foreground mb-2 block">
                        Sócios Decisores ({empresaEncontrada.socios.length})
                      </Label>
                      <div className="space-y-3">
                        {empresaEncontrada.socios.map((socio: any, idx: number) => {
                          const enrichData = socio.enrichment_data || enrichedSocios[socio.id];
                          const hasLinkedIn = enrichData?.linkedin_url || enrichData?.linkedin;
                          const hasInstagram = enrichData?.instagram_username || enrichData?.instagram;
                          const newsItems = enrichData?.noticias || enrichData?.news_mentions || [];
                          const hasNews = newsItems.length > 0;
                          
                          return (
                            <div key={idx} className="p-3 bg-background rounded-lg border space-y-2">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium">{socio.nome}</p>
                                  <p className="text-xs text-muted-foreground">{socio.qualificacao}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {socio.percentual_capital && (
                                    <Badge variant="secondary">
                                      {socio.percentual_capital}% do capital
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              
                              {/* Links de redes sociais encontrados */}
                              {enrichData && (
                                <div className="flex flex-wrap gap-2 pt-2 border-t">
                                  {hasLinkedIn && (
                                    <a 
                                      href={enrichData.linkedin_url || enrichData.linkedin} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                                    >
                                      <Linkedin className="h-3 w-3" />
                                      LinkedIn
                                    </a>
                                  )}
                                  {hasInstagram && (
                                    <a 
                                      href={`https://instagram.com/${enrichData.instagram_username || enrichData.instagram}`} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 text-xs text-pink-600 hover:underline"
                                    >
                                      <Instagram className="h-3 w-3" />
                                      @{enrichData.instagram_username || enrichData.instagram}
                                    </a>
                                  )}
                                  {hasNews && (
                                    <Badge variant="outline" className="text-xs">
                                      <Globe className="h-3 w-3 mr-1" />
                                      {newsItems.length} notícias
                                    </Badge>
                                  )}
                                  {!hasLinkedIn && !hasInstagram && !hasNews && (
                                    <span className="text-xs text-muted-foreground">Enriquecido (sem redes encontradas)</span>
                                  )}
                                </div>
                              )}
                              
                              {/* Botões de ação */}
                              <div className="flex flex-wrap items-center gap-2 pt-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEnrichSocio(socio.id, socio.nome)}
                                  disabled={loading || enrichingSocioId === socio.id}
                                >
                                  {enrichingSocioId === socio.id ? (
                                    <>
                                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                      Buscando...
                                    </>
                                  ) : (
                                    <>
                                      <Search className="mr-1 h-3 w-3" />
                                      Buscar Redes
                                    </>
                                  )}
                                </Button>
                                
                                {/* Botão Gerar Mensagens LinkedIn - só aparece se tem LinkedIn */}
                                {hasLinkedIn && (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="bg-blue-600 hover:bg-blue-700"
                                    onClick={() => openLinkedinSuggestionDialog(socio)}
                                    disabled={loading || generatingLinkedinMessages === socio.id}
                                  >
                                    {generatingLinkedinMessages === socio.id ? (
                                      <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                        Gerando...
                                      </>
                                    ) : (
                                      <>
                                        <MessageCircle className="mr-1 h-3 w-3" />
                                        Gerar Mensagens LinkedIn
                                      </>
                                    )}
                                  </Button>
                                )}
                                
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => processarProspect(socio.id, socio.nome)}
                                  disabled={loading}
                                >
                                  {loading && enrichingSocioId !== socio.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <Sparkles className="mr-1 h-3 w-3" />
                                      Processar Completo
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Modal com as 3 variações de mensagem */}
            <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Mensagens Personalizadas Geradas</DialogTitle>
                  <DialogDescription>
                    Escolha a melhor variação para {currentProspectMessages?.socioNome}
                  </DialogDescription>
                </DialogHeader>

                {currentProspectMessages && (
                  <div className="space-y-6">
                    {/* Score Badge */}
                    <div className="flex items-center justify-center gap-2">
                      <Badge variant="outline" className="text-lg px-4 py-2">
                        Score: <span className="font-bold ml-2">{currentProspectMessages.score}/100</span>
                      </Badge>
                      {currentProspectMessages.score >= 80 && (
                        <Badge className="bg-green-600">🔥 Lead Quente!</Badge>
                      )}
                      {currentProspectMessages.score >= 60 && currentProspectMessages.score < 80 && (
                        <Badge className="bg-yellow-600">⚡ Lead Morno</Badge>
                      )}
                    </div>

                    {/* 3 Variações lado a lado */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Variação 1: Professional */}
                      <Card 
                        className={`cursor-pointer transition-all ${
                          selectedMessageType === 'professional' 
                            ? 'ring-2 ring-blue-500 shadow-lg' 
                            : 'hover:shadow-md'
                        }`}
                        onClick={() => setSelectedMessageType('professional')}
                      >
                        <CardHeader>
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Briefcase className="h-4 w-4" />
                            Profissional
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="bg-slate-50 p-4 rounded-lg text-sm whitespace-pre-wrap min-h-[200px]">
                            {currentProspectMessages.messages.professional}
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {currentProspectMessages.messages.professional.length} caracteres
                          </div>
                        </CardContent>
                      </Card>

                      {/* Variação 2: Friendly */}
                      <Card 
                        className={`cursor-pointer transition-all ${
                          selectedMessageType === 'friendly' 
                            ? 'ring-2 ring-green-500 shadow-lg' 
                            : 'hover:shadow-md'
                        }`}
                        onClick={() => setSelectedMessageType('friendly')}
                      >
                        <CardHeader>
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Heart className="h-4 w-4" />
                            Amigável
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="bg-green-50 p-4 rounded-lg text-sm whitespace-pre-wrap min-h-[200px]">
                            {currentProspectMessages.messages.friendly}
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {currentProspectMessages.messages.friendly.length} caracteres
                          </div>
                        </CardContent>
                      </Card>

                      {/* Variação 3: Enthusiast */}
                      <Card 
                        className={`cursor-pointer transition-all ${
                          selectedMessageType === 'enthusiast' 
                            ? 'ring-2 ring-purple-500 shadow-lg' 
                            : 'hover:shadow-md'
                        }`}
                        onClick={() => setSelectedMessageType('enthusiast')}
                      >
                        <CardHeader>
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Zap className="h-4 w-4" />
                            Entusiasta
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="bg-purple-50 p-4 rounded-lg text-sm whitespace-pre-wrap min-h-[200px]">
                            {currentProspectMessages.messages.enthusiast}
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {currentProspectMessages.messages.enthusiast.length} caracteres
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Preview WhatsApp */}
                    <div className="border-t pt-4">
                      <Label className="text-sm font-medium mb-2 block">
                        Preview WhatsApp:
                      </Label>
                      <div className="bg-[#075e54] p-4 rounded-lg">
                        <div className="bg-white rounded-lg p-3 shadow-sm max-w-md">
                          <div className="text-sm text-gray-800 whitespace-pre-wrap">
                            {currentProspectMessages.messages[selectedMessageType]}
                          </div>
                          <div className="text-xs text-gray-400 mt-2 text-right">
                            {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Botões de ação */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setMessageDialogOpen(false)}
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={async () => {
                          await handleSaveSelectedMessage();
                          setMessageDialogOpen(false);
                          toast({
                            title: 'Mensagem salva!',
                            description: 'Mensagem pronta para envio via WhatsApp',
                          });
                        }}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Salvar e Preparar Envio
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>

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

      {/* MODAL COM AS 3 VARIAÇÕES DE MENSAGEM */}
      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMessageDialogOpen(false)}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <DialogTitle>Mensagens Personalizadas Geradas</DialogTitle>
              <DialogDescription>
                Escolha a melhor variação para enviar via WhatsApp
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

          {currentProspectMessages?.messages ? (
            <div className="space-y-6">
              {/* Score Badge */}
              <div className="flex items-center justify-center gap-2">
                <Badge variant="outline" className="text-lg px-4 py-2">
                  Score: <span className="font-bold ml-2">{currentProspectMessages.score || 0}/100</span>
                </Badge>
                {(currentProspectMessages.score || 0) >= 80 && (
                  <Badge className="bg-green-600">🔥 Lead Quente!</Badge>
                )}
              </div>

              {/* 3 Variações lado a lado */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Variação 1: Professional */}
                <Card 
                  className={`cursor-pointer transition-all ${
                    selectedMessageType === 'professional' 
                      ? 'ring-2 ring-blue-500 shadow-lg' 
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => setSelectedMessageType('professional')}
                >
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />
                      Profissional
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-slate-50 p-4 rounded-lg text-sm whitespace-pre-wrap min-h-[200px]">
                      {currentProspectMessages.messages.professional || 'Mensagem não disponível'}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {(currentProspectMessages.messages.professional || '').length} caracteres
                    </div>
                  </CardContent>
                </Card>

                {/* Variação 2: Friendly */}
                <Card 
                  className={`cursor-pointer transition-all ${
                    selectedMessageType === 'friendly' 
                      ? 'ring-2 ring-green-500 shadow-lg' 
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => setSelectedMessageType('friendly')}
                >
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Heart className="h-4 w-4" />
                      Amigável
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-green-50 p-4 rounded-lg text-sm whitespace-pre-wrap min-h-[200px]">
                      {currentProspectMessages.messages.friendly || 'Mensagem não disponível'}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {(currentProspectMessages.messages.friendly || '').length} caracteres
                    </div>
                  </CardContent>
                </Card>

                {/* Variação 3: Enthusiast */}
                <Card 
                  className={`cursor-pointer transition-all ${
                    selectedMessageType === 'enthusiast' 
                      ? 'ring-2 ring-purple-500 shadow-lg' 
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => setSelectedMessageType('enthusiast')}
                >
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Entusiasta
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-purple-50 p-4 rounded-lg text-sm whitespace-pre-wrap min-h-[200px]">
                      {currentProspectMessages.messages.enthusiast || 'Mensagem não disponível'}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {(currentProspectMessages.messages.enthusiast || '').length} caracteres
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Preview WhatsApp */}
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2">Preview WhatsApp:</p>
                <div className="bg-[#075e54] p-4 rounded-lg">
                  <div className="bg-white rounded-lg p-3 shadow-sm max-w-md">
                    <div className="text-sm text-gray-800 whitespace-pre-wrap">
                      {currentProspectMessages.messages[selectedMessageType] || 'Selecione uma mensagem'}
                    </div>
                    <div className="text-xs text-gray-400 mt-2 text-right">
                      {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Botões de ação */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setMessageDialogOpen(false)}
                  className="flex-1"
                >
                  Fechar
                </Button>
                <Button
                  onClick={async () => {
                    // Salvar mensagem selecionada
                    await supabase
                      .from('prospects_qualificados')
                      .update({ mensagem_selecionada: selectedMessageType })
                      .eq('id', currentProspectMessages.prospectId);

                    toast({
                      title: 'Mensagem salva!',
                      description: `Variação "${selectedMessageType}" selecionada.`,
                    });

                    setMessageDialogOpen(false);
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <Save className="mr-2 h-4 w-4" />
                  Salvar Escolha
                </Button>
                <Button
                  onClick={async () => {
                    // Enviar para WhatsApp (implementar depois)
                    toast({
                      title: 'Em breve!',
                      description: 'Integração WhatsApp em desenvolvimento',
                    });
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Enviar WhatsApp
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">Carregando mensagens...</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Mensagens LinkedIn */}
      <Dialog open={linkedinMessageDialogOpen} onOpenChange={setLinkedinMessageDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Linkedin className="h-5 w-5 text-blue-600" />
              Mensagens para LinkedIn
            </DialogTitle>
            <DialogDescription>
              {linkedinMessages && (
                <>Primeiro contato com <strong>{linkedinMessages.socio.nome}</strong> da {linkedinMessages.empresa?.razao_social || linkedinMessages.empresa?.nome_fantasia}</>
              )}
            </DialogDescription>
          </DialogHeader>

          {linkedinMessages && (
            <div className="space-y-6">
              {/* Info do contato */}
              <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                <div className="flex-1">
                  <p className="font-medium">{linkedinMessages.socio.nome}</p>
                  <p className="text-sm text-muted-foreground">{linkedinMessages.socio.qualificacao || 'Sócio'}</p>
                  {(linkedinMessages.socio.enrichment_data?.linkedin_url || enrichedSocios[linkedinMessages.socio.id]?.linkedin_url) && (
                    <a 
                      href={linkedinMessages.socio.enrichment_data?.linkedin_url || enrichedSocios[linkedinMessages.socio.id]?.linkedin_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1 mt-1"
                    >
                      <Linkedin className="h-3 w-3" />
                      Ver perfil no LinkedIn
                    </a>
                  )}
                </div>
              </div>

              {/* 3 Variações de Mensagem */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Profissional */}
                <Card className="border-2 border-blue-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-blue-600">
                      <Briefcase className="h-4 w-4" />
                      Profissional
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="bg-blue-50 p-3 rounded-lg text-sm whitespace-pre-wrap min-h-[120px]">
                      {linkedinMessages.mensagens.profissional}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {linkedinMessages.mensagens.profissional.length}/300 caracteres
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyMessage(linkedinMessages.mensagens.profissional, 'profissional')}
                      >
                        {copiedMessage === 'profissional' ? (
                          <><Check className="h-3 w-3 mr-1" /> Copiado!</>
                        ) : (
                          <><Copy className="h-3 w-3 mr-1" /> Copiar</>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Entusiasta */}
                <Card className="border-2 border-purple-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-purple-600">
                      <Zap className="h-4 w-4" />
                      Entusiasta
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="bg-purple-50 p-3 rounded-lg text-sm whitespace-pre-wrap min-h-[120px]">
                      {linkedinMessages.mensagens.entusiasta}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {linkedinMessages.mensagens.entusiasta.length}/300 caracteres
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyMessage(linkedinMessages.mensagens.entusiasta, 'entusiasta')}
                      >
                        {copiedMessage === 'entusiasta' ? (
                          <><Check className="h-3 w-3 mr-1" /> Copiado!</>
                        ) : (
                          <><Copy className="h-3 w-3 mr-1" /> Copiar</>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Direto */}
                <Card className="border-2 border-green-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-green-600">
                      <Target className="h-4 w-4" />
                      Direto
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="bg-green-50 p-3 rounded-lg text-sm whitespace-pre-wrap min-h-[120px]">
                      {linkedinMessages.mensagens.direto}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {linkedinMessages.mensagens.direto.length}/300 caracteres
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyMessage(linkedinMessages.mensagens.direto, 'direto')}
                      >
                        {copiedMessage === 'direto' ? (
                          <><Check className="h-3 w-3 mr-1" /> Copiado!</>
                        ) : (
                          <><Copy className="h-3 w-3 mr-1" /> Copiar</>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Dica */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Dica:</strong> Copie a mensagem e cole diretamente no convite de conexão do LinkedIn. 
                  Mensagens curtas e personalizadas têm maior taxa de aceitação.
                </AlertDescription>
              </Alert>

              {/* Botões de ação */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setLinkedinMessageDialogOpen(false)}
                  className="flex-1"
                >
                  Fechar
                </Button>
                {(linkedinMessages.socio.enrichment_data?.linkedin_url || enrichedSocios[linkedinMessages.socio.id]?.linkedin_url) && (
                  <Button
                    onClick={() => {
                      const url = linkedinMessages.socio.enrichment_data?.linkedin_url || enrichedSocios[linkedinMessages.socio.id]?.linkedin_url;
                      window.open(url, '_blank');
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    <Linkedin className="mr-2 h-4 w-4" />
                    Abrir LinkedIn do Contato
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Sugestão para LinkedIn */}
      <Dialog open={linkedinSuggestionDialogOpen} onOpenChange={setLinkedinSuggestionDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Personalizar Mensagens LinkedIn
            </DialogTitle>
            <DialogDescription>
              {pendingLinkedinSocio && (
                <>Mensagens para <strong>{pendingLinkedinSocio.nome}</strong></>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="linkedin-suggestion" className="text-sm font-medium">
                Sugestão para a IA (opcional)
              </Label>
              <Textarea
                id="linkedin-suggestion"
                placeholder="Ex: Mencionar que trabalhamos com automação de marketing, tom mais casual, focar em parcerias estratégicas..."
                value={linkedinCustomSuggestion}
                onChange={(e) => setLinkedinCustomSuggestion(e.target.value)}
                className="mt-2 min-h-[100px]"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Descreva como você quer que as mensagens sejam. A IA vai considerar suas sugestões.
              </p>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Canais disponíveis:</strong> LinkedIn, Instagram e Facebook. 
                Mensagens serão curtas (máx 300 caracteres) para convites de conexão.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setLinkedinSuggestionDialogOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => pendingLinkedinSocio && handleGenerateLinkedinMessages(pendingLinkedinSocio, linkedinCustomSuggestion)}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Gerar Mensagens
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
