import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
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
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  Linkedin, 
  Instagram, 
  Facebook, 
  MessageCircle, 
  Eye,
  RefreshCw,
  Home,
  ArrowLeft
} from "lucide-react";

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
}

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
  const [filtroQualificacao, setFiltroQualificacao] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [buscando, setBuscando] = useState(false);

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

  const buscarNovosLeads = async () => {
    setBuscando(true);
    toast.info('Funcionalidade de busca automática em desenvolvimento');
    setTimeout(() => setBuscando(false), 2000);
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

  const leadsFiltrados = leads.filter(lead => {
    if (filtroQualificacao !== "todos" && lead.qualificacao !== filtroQualificacao) return false;
    if (filtroStatus !== "todos" && lead.status !== filtroStatus) return false;
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
    <div className="min-h-screen bg-background p-6">
      {/* HEADER */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Building2 className="h-8 w-8 text-primary" />
              AMZ Imóveis - Leads Enriquecidos
            </h1>
            <p className="text-muted-foreground mt-1">
              Leads qualificados com dados completos de redes sociais
            </p>
          </div>
        </div>
        <Button onClick={() => navigate('/dashboard')} variant="outline">
          <Home className="h-4 w-4 mr-2" />
          Dashboard
        </Button>
      </div>

      {/* MÉTRICAS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
            {leads.filter(l => l.dados_completos).length}
          </div>
          <div className="text-sm text-green-700 dark:text-green-300">✅ Dados Completos</div>
        </Card>
        
        <Card className="bg-blue-50 dark:bg-blue-950 border-2 border-blue-300 dark:border-blue-700 p-4">
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            {leads.filter(l => l.status === 'novo').length}
          </div>
          <div className="text-sm text-blue-700 dark:text-blue-300">🆕 Novos (não contatados)</div>
        </Card>
      </div>

      {/* FILTROS */}
      <Card className="p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Qualificação:</label>
            <Select value={filtroQualificacao} onValueChange={setFiltroQualificacao}>
              <SelectTrigger className="w-48">
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
              <SelectTrigger className="w-48">
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
          
          <div className="flex-1" />
          
          <Button onClick={buscarNovosLeads} disabled={buscando} className="bg-green-600 hover:bg-green-700">
            <RefreshCw className={`h-4 w-4 mr-2 ${buscando ? 'animate-spin' : ''}`} />
            {buscando ? 'Buscando...' : 'Buscar Novos Leads'}
          </Button>
        </div>
      </Card>

      {/* TABELA */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p>Carregando leads...</p>
          </div>
        ) : leadsFiltrados.length === 0 ? (
          <div className="p-8 text-center">
            <Building2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Nenhum lead encontrado</h3>
            <p className="text-muted-foreground mb-4">
              Clique em "Buscar Novos Leads" para começar a prospectar
            </p>
            <Button onClick={buscarNovosLeads}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Buscar Leads
            </Button>
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
                    
                    {/* COLUNA 6: SCORE */}
                    <TableCell className="text-center">
                      <div className="text-3xl font-bold">{lead.score_total}</div>
                      <div className="text-xs text-muted-foreground">/100</div>
                      {lead.probabilidade_compra && (
                        <div className="mt-1 text-sm text-green-600 font-bold">
                          {lead.probabilidade_compra}% chance
                        </div>
                      )}
                      <div className="mt-1 text-xs">
                        {lead.dados_completos ? (
                          <span className="text-green-600">✅ Completo</span>
                        ) : (
                          <span className="text-yellow-600">⏳ Parcial</span>
                        )}
                      </div>
                    </TableCell>
                    
                    {/* COLUNA 7: AÇÕES */}
                    <TableCell>
                      <div className="flex flex-col gap-2">
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
  );
}
