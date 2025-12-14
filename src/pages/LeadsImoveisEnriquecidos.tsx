import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  Linkedin, 
  Instagram, 
  Facebook, 
  MessageCircle, 
  RefreshCw,
  Home,
  ArrowLeft,
  Settings,
  ChevronDown,
  ChevronUp,
  Search,
  MapPin,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle
} from "lucide-react";
import { ESTADOS_BRASIL } from "@/constants/estados";

interface LeadImovel {
  id: string;
  nome: string;
  foto_url: string | null;
  google_profile_url: string | null;
  corretoras_visitadas: any[] | null;
  total_corretoras: number;
  ultima_visita_dias: number | null;
  tipo_imovel_desejado: string | null;
  quartos_desejado: number | null;
  localizacao_desejada: string | null;
  orcamento_min: number | null;
  orcamento_max: number | null;
  objecoes: string[] | null;
  linkedin_url: string | null;
  linkedin_foto: string | null;
  cargo: string | null;
  empresa: string | null;
  linkedin_connections: string | null;
  linkedin_encontrado: boolean;
  instagram_username: string | null;
  instagram_url: string | null;
  instagram_foto: string | null;
  instagram_followers: number | null;
  instagram_interesses: string[] | null;
  instagram_encontrado: boolean;
  facebook_url: string | null;
  facebook_clubes: string[] | null;
  facebook_encontrado: boolean;
  score_total: number;
  qualificacao: string;
  renda_estimada: number | null;
  probabilidade_compra: number | null;
  dados_completos: boolean;
  status: string;
  telefone: string | null;
  // Novos campos de validação multi-fonte
  fontes_encontradas: string[] | null;
  confianca_dados: number | null;
  status_validacao: string | null;
  log_validacao: any[] | null;
  data_validacao: string | null;
  olx_anuncios_ativos: number | null;
  olx_telefone_confirmado: boolean | null;
}

const TIPOS_IMOVEL = ['apartamento', 'cobertura', 'casa', 'terreno', 'sala comercial'];

const formatarValor = (valor: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);
};

const formatarNumero = (num: number) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

export default function LeadsImoveisEnriquecidos() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<LeadImovel[]>([]);
  const [loading, setLoading] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [mostrarConfig, setMostrarConfig] = useState(true);

  // Filtros da lista
  const [filtroQualificacao, setFiltroQualificacao] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroDados, setFiltroDados] = useState("todos");

  // Configuração ICP
  const [estadosSelecionados, setEstadosSelecionados] = useState<string[]>(['RJ']);
  const [cidadesInput, setCidadesInput] = useState('Rio de Janeiro, Barra da Tijuca');
  const [orcamentoMin, setOrcamentoMin] = useState(1000000);
  const [orcamentoMax, setOrcamentoMax] = useState(5000000);
  const [tiposImovel, setTiposImovel] = useState<string[]>(['apartamento', 'cobertura']);
  const [quartosMin, setQuartosMin] = useState(3);
  const [maxLeads, setMaxLeads] = useState(50);

  useEffect(() => {
    carregarLeads();
  }, []);

  const carregarLeads = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      const { data, error } = await supabase
        .from('leads_imoveis_enriquecidos')
        .select('*')
        .eq('user_id', user.id)
        .order('score_total', { ascending: false });

      if (error) throw error;
      setLeads((data || []).map((d: any) => ({
        ...d,
        corretoras_visitadas: Array.isArray(d.corretoras_visitadas) ? d.corretoras_visitadas : []
      })));
    } catch (error) {
      console.error('Erro ao carregar leads:', error);
      toast.error('Erro ao carregar leads');
    } finally {
      setLoading(false);
    }
  };

  // Função para limpar todos os leads
  const confirmarLimparLeads = () => {
    const confirmar = window.confirm(
      `⚠️ TEM CERTEZA?\n\nIsso vai deletar TODOS os ${leads.length} leads da tela.\n\nEssa ação NÃO pode ser desfeita!`
    );
    
    if (confirmar) {
      limparLeads();
    }
  };

  const limparLeads = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('leads_imoveis_enriquecidos')
        .delete()
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      setLeads([]);
      toast.success('✅ Todos os leads foram removidos!');
      
    } catch (error: any) {
      toast.error('❌ Erro ao limpar: ' + error.message);
    }
  };

  const toggleEstado = (sigla: string) => {
    setEstadosSelecionados(prev => 
      prev.includes(sigla) 
        ? prev.filter(e => e !== sigla)
        : [...prev, sigla]
    );
  };

  const toggleTipoImovel = (tipo: string) => {
    setTiposImovel(prev => 
      prev.includes(tipo) 
        ? prev.filter(t => t !== tipo)
        : [...prev, tipo]
    );
  };

  const executarBusca = async () => {
    if (estadosSelecionados.length === 0) {
      toast.error('Selecione pelo menos um estado');
      return;
    }

    setBuscando(true);
    
    try {
      const cidades = cidadesInput
        .split(',')
        .map(c => c.trim())
        .filter(c => c.length > 0);

      const { data, error } = await supabase.functions.invoke('buscar-leads-enriquecidos', {
        body: {
          estados: estadosSelecionados,
          cidades: cidades,
          orcamento_min: orcamentoMin,
          orcamento_max: orcamentoMax,
          tipos_imovel: tiposImovel,
          quartos_min: quartosMin,
          max_leads: maxLeads
        }
      });

      if (error) throw error;

      console.log('Resposta da busca:', data);

      if (data?.leads && data.leads.length > 0) {
        console.log('📊 Total leads recebidos:', data.leads.length);
        console.log('📊 Leads salvos no banco:', data.stats?.salvos_banco || 0);
        
        const quentes = data.leads.filter((l: any) => l.qualificacao === 'quente').length;
        const mornos = data.leads.filter((l: any) => l.qualificacao === 'morno').length;
        toast.success(`✅ ${data.leads.length} leads encontrados! (${quentes} quentes, ${mornos} mornos)`);
        
        // IMPORTANTE: Recarregar do banco para ter os UUIDs corretos
        await carregarLeadsDoBanco();
        setMostrarConfig(false);
      } else {
        toast.info('Nenhum lead encontrado com esses critérios. Tente ajustar os filtros.');
      }
    } catch (error: any) {
      console.error('Erro na busca:', error);
      toast.error(error.message || 'Erro ao buscar leads');
    } finally {
      setBuscando(false);
    }
  };

  // Função para carregar leads do banco de dados
  const carregarLeadsDoBanco = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('leads_imoveis_enriquecidos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const leadsFormatados = (data || []).map((lead: any) => ({
        id: lead.id,
        nome: lead.nome || 'Nome não disponível',
        foto_url: lead.foto_url || null,
        google_profile_url: lead.google_profile_url || null,
        corretoras_visitadas: Array.isArray(lead.corretoras_visitadas) ? lead.corretoras_visitadas : [],
        total_corretoras: lead.total_corretoras || 0,
        ultima_visita_dias: lead.ultima_visita_dias || null,
        tipo_imovel_desejado: lead.tipo_imovel_desejado || null,
        quartos_desejado: lead.quartos_desejado || null,
        localizacao_desejada: lead.localizacao_desejada || null,
        orcamento_min: lead.orcamento_min || null,
        orcamento_max: lead.orcamento_max || null,
        objecoes: lead.objecoes || null,
        linkedin_url: lead.linkedin_url || null,
        linkedin_foto: lead.linkedin_foto || null,
        cargo: lead.cargo || null,
        empresa: lead.empresa || null,
        linkedin_connections: lead.linkedin_connections || null,
        linkedin_encontrado: !!lead.linkedin_url,
        instagram_username: lead.instagram_username || null,
        instagram_url: lead.instagram_url || null,
        instagram_foto: lead.instagram_foto || null,
        instagram_followers: lead.instagram_followers || null,
        instagram_interesses: lead.instagram_interesses || null,
        instagram_encontrado: !!lead.instagram_url,
        facebook_url: lead.facebook_url || null,
        facebook_clubes: lead.facebook_clubes || null,
        facebook_encontrado: !!lead.facebook_url,
        score_total: lead.score_total || 0,
        qualificacao: lead.qualificacao || 'morno',
        renda_estimada: lead.renda_estimada || null,
        probabilidade_compra: lead.probabilidade_compra || null,
        dados_completos: lead.dados_completos || false,
        status: lead.status || 'novo',
        telefone: lead.telefone || null,
        fontes_encontradas: lead.fontes_encontradas || null,
        confianca_dados: lead.confianca_dados || null,
        status_validacao: lead.status_validacao || null,
        log_validacao: lead.log_validacao || null,
        data_validacao: lead.data_validacao || null,
        olx_anuncios_ativos: lead.olx_anuncios_ativos || null,
        olx_telefone_confirmado: lead.olx_telefone_confirmado || null
      }));

      console.log('✅ Leads carregados do banco:', leadsFormatados.length);
      setLeads(leadsFormatados);
      setLoading(false);
    } catch (error) {
      console.error('Erro ao carregar leads do banco:', error);
    }
  };

  const atualizarStatus = async (leadId: string, novoStatus: string) => {
    try {
      const { error } = await supabase
        .from('leads_imoveis_enriquecidos')
        .update({ status: novoStatus, data_contato: new Date().toISOString() })
        .eq('id', leadId);

      if (error) throw error;
      
      setLeads(leads.map(l => l.id === leadId ? { ...l, status: novoStatus } : l));
      toast.success('Status atualizado!');
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const [validandoLead, setValidandoLead] = useState<string | null>(null);
  const [buscandoLinkedin, setBuscandoLinkedin] = useState<string | null>(null);

  // BUSCAR LINKEDIN DIRETO - usando SerpAPI via validar-lead-multifonte
  const buscarLinkedIn = async (lead: LeadImovel) => {
    setBuscandoLinkedin(lead.id);
    
    try {
      toast.info(`🔍 Buscando LinkedIn de ${lead.nome} via SerpAPI...`);
      
      // Chamar validar-lead-multifonte que usa SerpAPI (código que funciona!)
      const { data, error } = await supabase.functions.invoke('validar-lead-multifonte', {
        body: { leadId: lead.id }
      });

      if (error) throw error;

      console.log('🧪 VALIDAÇÃO RESULTADO:', data);

      if (data?.success && data?.linkedinUrl) {
        // Buscar dados atualizados do lead
        const { data: leadAtualizado } = await supabase
          .from('leads_imoveis_enriquecidos')
          .select('*')
          .eq('id', lead.id)
          .single();
        
        if (leadAtualizado) {
          setLeads(prevLeads => prevLeads.map(l => 
            l.id === lead.id 
              ? { 
                  ...l, 
                  linkedin_url: leadAtualizado.linkedin_url,
                  linkedin_encontrado: true,
                  confianca_dados: leadAtualizado.confianca_dados,
                  dados_completos: leadAtualizado.dados_completos
                } 
              : l
          ));
        }
        
        toast.success(`✅ LinkedIn encontrado: ${data.linkedinUrl}`);
      } else if (data?.success) {
        toast.warning(`⚠️ LinkedIn não encontrado para ${lead.nome}`);
      } else {
        throw new Error(data?.error || 'Erro desconhecido');
      }
    } catch (error: any) {
      console.error('Erro ao buscar LinkedIn:', error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setBuscandoLinkedin(null);
    }
  };

  const validarLeadMultifonte = async (leadId: string) => {
    setValidandoLead(leadId);
    
    try {
      toast.info('🔍 Buscando LinkedIn, Instagram e dados de contato...');
      
      const { data, error } = await supabase.functions.invoke('validar-lead-multifonte', {
        body: { leadId }
      });

      if (error) throw error;

      if (data?.success) {
        const fontesEncontradas = data.fontes?.join(', ') || 'nenhuma';
        toast.success(`✅ Validação concluída! Confiança: ${data.confianca}% | Fontes: ${fontesEncontradas}`);
        
        // Buscar dados atualizados do lead no banco
        const { data: leadAtualizado } = await supabase
          .from('leads_imoveis_enriquecidos')
          .select('*')
          .eq('id', leadId)
          .single();
        
        if (leadAtualizado) {
          // Atualizar lead na lista local com dados mapeados
          setLeads(prevLeads => prevLeads.map(l => 
            l.id === leadId 
              ? { 
                  ...l, 
                  confianca_dados: leadAtualizado.confianca_dados,
                  status_validacao: leadAtualizado.status_validacao,
                  fontes_encontradas: leadAtualizado.fontes_encontradas as string[] | null,
                  linkedin_url: leadAtualizado.linkedin_url,
                  linkedin_foto: leadAtualizado.linkedin_foto,
                  cargo: leadAtualizado.cargo,
                  empresa: leadAtualizado.empresa,
                  linkedin_encontrado: !!leadAtualizado.linkedin_url,
                  instagram_url: leadAtualizado.instagram_url,
                  instagram_username: leadAtualizado.instagram_username,
                  instagram_foto: leadAtualizado.instagram_foto,
                  instagram_followers: leadAtualizado.instagram_followers,
                  instagram_encontrado: !!leadAtualizado.instagram_url,
                  facebook_url: leadAtualizado.facebook_url,
                  facebook_encontrado: !!leadAtualizado.facebook_url,
                  telefone: leadAtualizado.telefone,
                  dados_completos: leadAtualizado.dados_completos || false
                } 
              : l
          ));
        }
      } else {
        throw new Error(data?.error || 'Erro desconhecido');
      }
    } catch (error: any) {
      console.error('Erro na validação:', error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setValidandoLead(null);
    }
  };

  const leadsFiltrados = leads.filter(lead => {
    if (filtroQualificacao !== "todos" && lead.qualificacao !== filtroQualificacao) return false;
    if (filtroStatus !== "todos" && lead.status !== filtroStatus) return false;
    if (filtroDados === "completos" && !lead.dados_completos) return false;
    if (filtroDados === "parciais" && lead.dados_completos) return false;
    return true;
  });

  const getQualificacaoBadge = (qualificacao: string) => {
    switch (qualificacao) {
      case 'SUPER QUENTE':
        return <Badge className="bg-red-600 text-white">🔥🔥🔥 SUPER QUENTE</Badge>;
      case 'QUENTE':
        return <Badge className="bg-orange-600 text-white">🔥 QUENTE</Badge>;
      default:
        return <Badge className="bg-yellow-600 text-white">😐 MORNO</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* SIDEBAR AMZ IMÓVEIS */}
      <aside className="w-64 bg-card border-r border-border p-4 space-y-4 shrink-0">
        <div className="flex items-center gap-2 mb-6">
          <Building2 className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold">AMZ Imóveis</span>
        </div>
        
        <nav className="space-y-1">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            onClick={() => navigate('/dashboard')}
          >
            <Home className="h-4 w-4" />
            Dashboard
          </Button>
          
          <Button
            variant="secondary"
            className="w-full justify-start gap-2 bg-primary/10"
            onClick={() => navigate('/imoveis/leads-enriquecidos')}
          >
            <Building2 className="h-4 w-4" />
            Leads Enriquecidos
          </Button>
          
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            onClick={() => navigate('/imoveis/seguidores-concorrentes')}
          >
            <Instagram className="h-4 w-4" />
            Seguidores Concorrentes
          </Button>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 p-6 max-w-[1600px]">
        {/* HEADER */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Building2 className="h-8 w-8 text-primary" />
              Leads Enriquecidos
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure ICP → Busca Google → Enriquece Redes Sociais
            </p>
          </div>
        <div className="flex gap-2 items-center">
          {/* BOTÃO LIMPAR LEADS */}
          {leads.length > 0 && (
            <Button
              variant="destructive"
              onClick={confirmarLimparLeads}
              className="gap-2"
            >
              🗑️ Limpar Leads ({leads.length})
            </Button>
          )}
          {/* BOTÃO DE TESTE LINKEDIN */}
          <Button 
            onClick={async () => {
              toast.info('🧪 Testando busca LinkedIn...');
              try {
                const { data, error } = await supabase.functions.invoke('teste-linkedin', {
                  body: { nome: 'Luana Kimilly', empresa: 'Lucrum Imobiliária' }
                });
                
                console.log('🧪 TESTE LINKEDIN RESULTADO:', data);
                
                if (error) {
                  toast.error(`Erro: ${error.message}`);
                  return;
                }
                
                const resultado = data?.resultados || {};
                const googleOk = resultado.teste_google?.sucesso;
                const serpapiOk = resultado.teste_serpapi?.sucesso;
                
                if (googleOk || serpapiOk) {
                  const perfis = googleOk 
                    ? resultado.teste_google.perfis 
                    : resultado.teste_serpapi.perfis;
                  
                  toast.success(`✅ ${perfis?.length || 0} perfis LinkedIn encontrados!`);
                  
                  if (perfis?.[0]?.link) {
                    window.open(perfis[0].link, '_blank');
                  }
                } else {
                  toast.error('❌ Nenhuma API funcionou. Verifique GOOGLE_API_KEY, GOOGLE_CX e SERPAPI_KEY');
                }
              } catch (e: any) {
                console.error('Erro teste:', e);
                toast.error(`Erro: ${e.message}`);
              }
            }}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            🧪 Testar LinkedIn (Luana Kimilly)
          </Button>
          
          <Button 
            onClick={() => setMostrarConfig(!mostrarConfig)} 
            variant="outline"
          >
            <Settings className="h-4 w-4 mr-2" />
            {mostrarConfig ? 'Esconder Config' : 'Mostrar Config'}
            {mostrarConfig ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
          </Button>
          <Button onClick={() => navigate('/dashboard')} variant="outline">
            <Home className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
        </div>
      </div>

      {/* SEÇÃO 1: CONFIGURAÇÃO ICP */}
      <Collapsible open={mostrarConfig} onOpenChange={setMostrarConfig}>
        <CollapsibleContent>
          <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-2 border-blue-300 dark:border-blue-700 p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuração de Busca (ICP - Ideal Customer Profile)
            </h2>

            <div className="bg-card rounded-lg p-4 mb-4">
              <div className="text-sm text-muted-foreground mb-4">
                Configure o perfil do cliente ideal. O sistema vai buscar pessoas que visitaram 
                corretoras recentemente e enriquecer com dados de LinkedIn, Instagram e Facebook.
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* COLUNA 1: LOCALIZAÇÃO */}
                <div className="space-y-4">
                  <h3 className="font-bold border-b pb-2 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Localização
                  </h3>

                  {/* Estados */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Estados ({estadosSelecionados.length} selecionados):
                    </label>
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-muted/30 rounded-lg">
                      {ESTADOS_BRASIL.map(estado => (
                        <button
                          key={estado.sigla}
                          onClick={() => toggleEstado(estado.sigla)}
                          className={`
                            px-2 py-1 rounded border text-xs font-medium transition-colors
                            ${estadosSelecionados.includes(estado.sigla)
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background border-border hover:border-primary'}
                          `}
                        >
                          {estado.sigla}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cidades */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Cidades específicas (opcional):
                    </label>
                    <Input
                      placeholder="Rio de Janeiro, Barra da Tijuca, Recreio..."
                      value={cidadesInput}
                      onChange={e => setCidadesInput(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Separe por vírgula. Deixe vazio para buscar em todas as cidades dos estados selecionados.
                    </p>
                  </div>
                </div>

                {/* COLUNA 2: PERFIL DO IMÓVEL */}
                <div className="space-y-4">
                  <h3 className="font-bold border-b pb-2 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Perfil do Imóvel Desejado
                  </h3>

                  {/* Tipo */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Tipo de Imóvel:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {TIPOS_IMOVEL.map(tipo => (
                        <button
                          key={tipo}
                          onClick={() => toggleTipoImovel(tipo)}
                          className={`
                            px-3 py-1.5 rounded border text-sm capitalize transition-colors
                            ${tiposImovel.includes(tipo)
                              ? 'bg-green-600 text-white border-green-600'
                              : 'bg-background border-border hover:border-green-600'}
                          `}
                        >
                          {tipo}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Orçamento */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Orçamento:
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground">Mínimo:</label>
                        <Input
                          type="number"
                          value={orcamentoMin}
                          onChange={e => setOrcamentoMin(Number(e.target.value))}
                          placeholder="1000000"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Máximo:</label>
                        <Input
                          type="number"
                          value={orcamentoMax}
                          onChange={e => setOrcamentoMax(Number(e.target.value))}
                          placeholder="5000000"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Faixa: {formatarValor(orcamentoMin)} - {formatarValor(orcamentoMax)}
                    </p>
                  </div>

                  {/* Quartos */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Mínimo de Quartos:
                    </label>
                    <Select value={quartosMin.toString()} onValueChange={v => setQuartosMin(Number(v))}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1+ quartos</SelectItem>
                        <SelectItem value="2">2+ quartos</SelectItem>
                        <SelectItem value="3">3+ quartos</SelectItem>
                        <SelectItem value="4">4+ quartos</SelectItem>
                        <SelectItem value="5">5+ quartos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Limite de Leads */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      ⚡ Quantidade Máxima de Leads:
                    </label>
                    <Select value={maxLeads.toString()} onValueChange={v => setMaxLeads(Number(v))}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="50">50 leads (⚡ Rápido - ~30s)</SelectItem>
                        <SelectItem value="100">100 leads (⚡⚡ Médio - ~1min)</SelectItem>
                        <SelectItem value="150">150 leads (⚡⚡⚡ Lento - ~2min)</SelectItem>
                        <SelectItem value="200">200 leads (⚡⚡⚡⚡ Muito Lento - ~3min)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Quanto mais leads, mais tempo demora. Recomendado: 50-100.
                    </p>
                  </div>
                </div>
              </div>

              {/* BOTÃO BUSCAR */}
              <div className="mt-6 flex items-center gap-4">
                <Button
                  onClick={executarBusca}
                  disabled={buscando || estadosSelecionados.length === 0}
                  size="lg"
                  className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                >
                  {buscando ? (
                    <>
                      <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                      Buscando e Enriquecendo...
                    </>
                  ) : (
                    <>
                      <Search className="h-5 w-5 mr-2" />
                      Buscar Leads Qualificados
                    </>
                  )}
                </Button>

                {buscando && (
                  <div className="text-sm text-muted-foreground bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-300 dark:border-yellow-700 rounded-lg p-3">
                    <div className="font-medium text-yellow-800 dark:text-yellow-200">⏳ Processando e enriquecendo leads...</div>
                    <div className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                      1. Buscando corretoras → 2. Analisando reviews → 3. Enriquecendo LinkedIn → 4. Enriquecendo Instagram
                    </div>
                    <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-2 font-medium">
                      ⚠️ Pode levar 2-5 minutos para {maxLeads} leads. Por favor, aguarde!
                    </div>
                  </div>
                )}
              </div>

              {/* PREVIEW DA BUSCA */}
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded">
                <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                  📋 Preview da Busca:
                </div>
                <div className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                  <div>• Estados: {estadosSelecionados.length > 0 ? estadosSelecionados.join(', ') : 'Nenhum selecionado'}</div>
                  {cidadesInput.trim() && (
                    <div>• Cidades: {cidadesInput}</div>
                  )}
                  <div>• Procurando quem visitou corretoras nos últimos 30 dias</div>
                  <div>• Interesse em: {tiposImovel.length > 0 ? tiposImovel.join(', ') : 'Todos os tipos'} com {quartosMin}+ quartos</div>
                  <div>• Orçamento: {formatarValor(orcamentoMin)} - {formatarValor(orcamentoMax)}</div>
                  <div>• Máximo de leads: <strong>{maxLeads}</strong></div>
                  <div>• Tempo estimado: {maxLeads <= 50 ? '~30 segundos' : maxLeads <= 100 ? '~1 minuto' : maxLeads <= 150 ? '~2 minutos' : '~3 minutos'}</div>
                  <div>• Vai enriquecer com: LinkedIn (cargo/empresa) + Instagram (lifestyle) + Facebook (clubes)</div>
                </div>
              </div>
            </div>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* MÉTRICAS */}
      {leads.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card className="bg-red-50 dark:bg-red-950 border-2 border-red-300 dark:border-red-700 p-4">
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">
              {leads.filter(l => l.qualificacao === 'SUPER QUENTE').length}
            </div>
            <div className="text-sm text-red-700 dark:text-red-300">🔥🔥🔥 Super Quentes</div>
          </Card>
          
          <Card className="bg-orange-50 dark:bg-orange-950 border-2 border-orange-300 dark:border-orange-700 p-4">
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
              {leads.filter(l => l.qualificacao === 'QUENTE').length}
            </div>
            <div className="text-sm text-orange-700 dark:text-orange-300">🔥 Quentes</div>
          </Card>
          
          <Card className="bg-green-50 dark:bg-green-950 border-2 border-green-300 dark:border-green-700 p-4">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {leads.filter(l => (l.confianca_dados || 0) >= 60).length}
            </div>
            <div className="text-sm text-green-700 dark:text-green-300">✅ Validados 60%+</div>
          </Card>
          
          <Card className="bg-purple-50 dark:bg-purple-950 border-2 border-purple-300 dark:border-purple-700 p-4">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              {leads.filter(l => l.status_validacao === 'pendente' || !l.status_validacao).length}
            </div>
            <div className="text-sm text-purple-700 dark:text-purple-300">⏳ Pendentes</div>
          </Card>
          
          <Card className="bg-blue-50 dark:bg-blue-950 border-2 border-blue-300 dark:border-blue-700 p-4">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {leads.filter(l => l.status === 'novo').length}
            </div>
            <div className="text-sm text-blue-700 dark:text-blue-300">🆕 Não Contatados</div>
          </Card>
        </div>
      )}

      {/* FILTROS RÁPIDOS */}
      {leads.length > 0 && (
        <Card className="p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Qualificação:</label>
              <Select value={filtroQualificacao} onValueChange={setFiltroQualificacao}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="SUPER QUENTE">🔥🔥🔥 Super Quentes</SelectItem>
                  <SelectItem value="QUENTE">🔥 Quentes</SelectItem>
                  <SelectItem value="MORNO">😐 Mornos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Status:</label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="novo">🆕 Novos</SelectItem>
                  <SelectItem value="contatado">📞 Contatados</SelectItem>
                  <SelectItem value="agendado">📅 Agendados</SelectItem>
                  <SelectItem value="visitou">👀 Visitaram</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Dados:</label>
              <Select value={filtroDados} onValueChange={setFiltroDados}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="completos">✅ Completos</SelectItem>
                  <SelectItem value="parciais">⏳ Parciais</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex-1" />
            
            <div className="text-sm text-muted-foreground">
              Mostrando {leadsFiltrados.length} de {leads.length} leads
            </div>
          </div>
        </Card>
      )}

      {/* TABELA OU EMPTY STATE */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p>Carregando leads...</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="h-20 w-20 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-bold mb-2">Nenhum lead encontrado</h3>
            <p className="text-muted-foreground mb-4">
              Configure os filtros acima e clique em "Buscar Leads Qualificados"
            </p>
            <Button onClick={() => setMostrarConfig(true)} variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Configurar Busca
            </Button>
          </div>
        ) : leadsFiltrados.length === 0 ? (
          <div className="p-8 text-center">
            <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Nenhum lead com esses filtros</h3>
            <p className="text-muted-foreground">
              Tente ajustar os filtros de qualificação, status ou dados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="min-w-[200px]">Lead</TableHead>
                  <TableHead className="min-w-[180px]">Atividade Imobiliária</TableHead>
                  <TableHead className="min-w-[180px]">Perfil Profissional</TableHead>
                  <TableHead className="min-w-[180px]">Redes Sociais</TableHead>
                  <TableHead className="min-w-[150px]">Interesse</TableHead>
                  <TableHead className="text-center min-w-[100px]">Score</TableHead>
                  <TableHead className="text-center min-w-[150px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              
              <TableBody>
                {leadsFiltrados.map(lead => (
                  <TableRow 
                    key={lead.id}
                    className={`
                      ${lead.qualificacao === 'SUPER QUENTE' ? 'bg-red-50 dark:bg-red-950/30' : ''}
                      ${lead.qualificacao === 'QUENTE' ? 'bg-orange-50 dark:bg-orange-950/30' : ''}
                    `}
                  >
                    {/* COLUNA 1: LEAD */}
                    <TableCell>
                      <div className="flex items-start gap-3">
                        <img 
                          src={lead.foto_url || lead.linkedin_foto || lead.instagram_foto || '/placeholder.svg'}
                          alt={lead.nome}
                          className="w-14 h-14 rounded-full object-cover border-2 border-border"
                        />
                        <div>
                          <div className="font-bold">{lead.nome}</div>
                          {lead.google_profile_url && (
                            <a 
                              href={lead.google_profile_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              📍 Perfil Google
                            </a>
                          )}
                          <div className="mt-1">
                            {getQualificacaoBadge(lead.qualificacao)}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    
                    {/* COLUNA 2: ATIVIDADE IMOBILIÁRIA */}
                    <TableCell>
                      <div className="text-sm space-y-1">
                        <div className="font-bold text-red-600 dark:text-red-400">
                          🏢 {lead.total_corretoras} corretoras visitadas
                        </div>
                        {lead.ultima_visita_dias !== null && (
                          <div className="text-xs text-muted-foreground">
                            Última: há {lead.ultima_visita_dias} dias
                          </div>
                        )}
                        {lead.corretoras_visitadas?.slice(0, 2).map((corr: any, idx: number) => (
                          <div key={idx} className="bg-muted rounded p-2 text-xs">
                            <div className="font-medium">{corr.nome}</div>
                            <div className="text-muted-foreground">{corr.data}</div>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    
                    {/* COLUNA 3: PERFIL PROFISSIONAL */}
                    <TableCell>
                      {lead.linkedin_encontrado ? (
                        <div className="text-sm space-y-1">
                          <a 
                            href={lead.linkedin_url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 font-bold text-blue-700 hover:underline"
                          >
                            <Linkedin className="h-4 w-4" />
                            LinkedIn →
                          </a>
                          {lead.cargo && (
                            <div className="text-muted-foreground">
                              💼 {lead.cargo}
                            </div>
                          )}
                          {lead.empresa && (
                            <div className="text-muted-foreground">
                              🏢 {lead.empresa}
                            </div>
                          )}
                          {lead.linkedin_connections && (
                            <div className="text-xs text-muted-foreground">
                              👥 {lead.linkedin_connections} conexões
                            </div>
                          )}
                          {lead.renda_estimada && (
                            <div className="text-green-700 dark:text-green-400 font-bold mt-1">
                              💰 ~{formatarValor(lead.renda_estimada)}/mês
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-muted-foreground text-sm italic">
                          LinkedIn não encontrado
                        </div>
                      )}
                    </TableCell>
                    
                    {/* COLUNA 4: REDES SOCIAIS */}
                    <TableCell>
                      <div className="space-y-2 text-sm">
                        {lead.instagram_encontrado ? (
                          <div>
                            <a 
                              href={lead.instagram_url || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-pink-600 hover:underline font-medium"
                            >
                              <Instagram className="h-4 w-4" />
                              @{lead.instagram_username}
                            </a>
                            {lead.instagram_followers && (
                              <span className="text-xs text-muted-foreground">
                                ({formatarNumero(lead.instagram_followers)} seguidores)
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">Instagram: não encontrado</div>
                        )}
                        
                        {lead.instagram_interesses && lead.instagram_interesses.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {lead.instagram_interesses.slice(0, 3).map((interesse, idx) => (
                              <span 
                                key={idx}
                                className="px-2 py-0.5 bg-pink-100 dark:bg-pink-900 text-pink-800 dark:text-pink-200 rounded text-xs"
                              >
                                #{interesse}
                              </span>
                            ))}
                          </div>
                        )}
                        
                        {lead.facebook_encontrado ? (
                          <a 
                            href={lead.facebook_url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-600 hover:underline"
                          >
                            <Facebook className="h-4 w-4" />
                            Facebook →
                          </a>
                        ) : (
                          <div className="text-xs text-muted-foreground">Facebook: não encontrado</div>
                        )}
                        
                        {lead.facebook_clubes && lead.facebook_clubes.length > 0 && (
                          <div className="text-xs">
                            <div className="font-medium">Clubes:</div>
                            {lead.facebook_clubes.slice(0, 2).map((clube, idx) => (
                              <div key={idx} className="text-muted-foreground">⭐ {clube}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    
                    {/* COLUNA 5: INTERESSE */}
                    <TableCell>
                      <div className="text-sm space-y-1">
                        {lead.tipo_imovel_desejado && (
                          <div>
                            <span className="font-medium">Quer:</span>{' '}
                            {lead.tipo_imovel_desejado}
                            {lead.quartos_desejado && ` ${lead.quartos_desejado}q`}
                          </div>
                        )}
                        {lead.localizacao_desejada && (
                          <div>
                            <span className="font-medium">Onde:</span>{' '}
                            {lead.localizacao_desejada}
                          </div>
                        )}
                        {lead.orcamento_max && (
                          <div className="text-green-700 dark:text-green-400 font-bold">
                            até {formatarValor(lead.orcamento_max)}
                          </div>
                        )}
                        {lead.objecoes && lead.objecoes.length > 0 && (
                          <div className="mt-1">
                            <div className="text-xs font-medium text-red-600">Objeções:</div>
                            {lead.objecoes.slice(0, 2).map((obj, idx) => (
                              <div key={idx} className="text-xs text-red-500">❌ {obj}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    
                    {/* COLUNA 6: SCORE + CONFIANÇA */}
                    <TableCell className="text-center">
                      <div className="text-3xl font-bold">{lead.score_total}</div>
                      <div className="text-xs text-muted-foreground">/100</div>
                      
                      {/* BADGE DE CONFIANÇA */}
                      {lead.confianca_dados !== null && lead.confianca_dados !== undefined ? (
                        <div className="mt-2">
                          <div className={`
                            inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold
                            ${lead.confianca_dados >= 90 ? 'bg-green-600 text-white' : ''}
                            ${lead.confianca_dados >= 60 && lead.confianca_dados < 90 ? 'bg-yellow-600 text-white' : ''}
                            ${lead.confianca_dados < 60 ? 'bg-red-600 text-white' : ''}
                          `}>
                            {lead.confianca_dados >= 90 && <CheckCircle2 className="h-3 w-3" />}
                            {lead.confianca_dados >= 60 && lead.confianca_dados < 90 && <AlertTriangle className="h-3 w-3" />}
                            {lead.confianca_dados < 60 && <XCircle className="h-3 w-3" />}
                            {lead.confianca_dados}%
                          </div>
                          
                          <div className="text-xs text-muted-foreground mt-1">
                            {lead.status_validacao === 'validado' && '✅ Validado'}
                            {lead.status_validacao === 'provavel' && '⚠️ Provável'}
                            {lead.status_validacao === 'rejeitado' && '❌ Baixa conf.'}
                            {lead.status_validacao === 'validando' && '🔄 Validando...'}
                            {lead.status_validacao === 'pendente' && '⏳ Pendente'}
                          </div>
                          
                          {/* FONTES ENCONTRADAS */}
                          {lead.fontes_encontradas && lead.fontes_encontradas.length > 0 && (
                            <div className="flex flex-wrap justify-center gap-1 mt-1">
                              {lead.fontes_encontradas.map((fonte, idx) => (
                                <span 
                                  key={idx}
                                  className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-[10px]"
                                >
                                  ✓ {fonte}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Não validado
                        </div>
                      )}
                      
                      {lead.probabilidade_compra && (
                        <div className="mt-1 text-sm text-green-600 font-bold">
                          {lead.probabilidade_compra}% chance
                        </div>
                      )}
                    </TableCell>
                    
                    {/* COLUNA 7: AÇÕES */}
                    <TableCell>
                      <div className="flex flex-col gap-2">
                        {/* BOTÃO VALIDAR */}
                        <Button
                          size="sm"
                          variant={lead.status_validacao === 'validado' ? 'outline' : 'default'}
                          onClick={() => validarLeadMultifonte(lead.id)}
                          disabled={validandoLead === lead.id}
                          className="text-xs"
                        >
                          {validandoLead === lead.id ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Validando...
                            </>
                          ) : lead.status_validacao === 'validado' ? (
                            <>
                              <ShieldCheck className="h-3 w-3 mr-1" />
                              Revalidar
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="h-3 w-3 mr-1" />
                              Validar
                            </>
                          )}
                        </Button>
                        
                        {lead.telefone && (
                          <a 
                            href={`https://wa.me/55${lead.telefone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-green-600 text-white px-3 py-1.5 rounded text-sm text-center hover:bg-green-700 flex items-center justify-center gap-1"
                          >
                            <MessageCircle className="h-4 w-4" />
                            WhatsApp
                          </a>
                        )}
                        
                        {lead.instagram_url && (
                          <a 
                            href={lead.instagram_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-pink-600 text-white px-3 py-1.5 rounded text-sm text-center hover:bg-pink-700 flex items-center justify-center gap-1"
                          >
                            <Instagram className="h-4 w-4" />
                            Instagram
                          </a>
                        )}
                        
                        {/* BOTÃO BUSCAR LINKEDIN - sempre visível se não encontrado */}
                        {!lead.linkedin_encontrado && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => buscarLinkedIn(lead)}
                            disabled={buscandoLinkedin === lead.id}
                            className="text-xs bg-blue-50 hover:bg-blue-100 border-blue-300 text-blue-700"
                          >
                            {buscandoLinkedin === lead.id ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Buscando...
                              </>
                            ) : (
                              <>
                                <Linkedin className="h-3 w-3 mr-1" />
                                Buscar LinkedIn
                              </>
                            )}
                          </Button>
                        )}
                        
                        {lead.linkedin_url && (
                          <a 
                            href={lead.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-blue-700 text-white px-3 py-1.5 rounded text-sm text-center hover:bg-blue-800 flex items-center justify-center gap-1"
                          >
                            <Linkedin className="h-4 w-4" />
                            LinkedIn
                          </a>
                        )}
                        
                        <Select 
                          value={lead.status} 
                          onValueChange={(value) => atualizarStatus(lead.id, value)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="novo">🆕 Novo</SelectItem>
                            <SelectItem value="contatado">📞 Contatado</SelectItem>
                            <SelectItem value="agendado">📅 Agendado</SelectItem>
                            <SelectItem value="visitou">👀 Visitou</SelectItem>
                            <SelectItem value="negociando">💰 Negociando</SelectItem>
                            <SelectItem value="fechado">✅ Fechou</SelectItem>
                            <SelectItem value="perdido">❌ Perdido</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
      </div>
    </div>
  );
}
