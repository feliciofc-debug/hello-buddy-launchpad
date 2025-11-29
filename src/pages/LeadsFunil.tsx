import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Phone, Mail, MessageSquare, TrendingUp, ArrowLeft, Calendar, ExternalLink, History, Plus, FileText, Circle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';

const PIPELINE_STAGES = [
  { id: 'descoberto', label: 'Descoberto', color: 'bg-gray-500' },
  { id: 'enriquecido', label: 'Enriquecido', color: 'bg-blue-500' },
  { id: 'qualificado', label: 'Qualificado', color: 'bg-purple-500' },
  { id: 'mensagem_gerada', label: 'Mensagem Gerada', color: 'bg-yellow-500' },
  { id: 'enviado', label: 'Enviado', color: 'bg-orange-500' },
  { id: 'respondeu', label: 'Respondeu', color: 'bg-green-500' },
  { id: 'convertido', label: 'Convertido', color: 'bg-emerald-600' }
];

interface Lead {
  id: string;
  nome_completo?: string;
  razao_social?: string;
  nome_fantasia?: string;
  profissao?: string;
  setor?: string;
  telefone?: string;
  email?: string;
  whatsapp?: string;
  cidade?: string;
  estado?: string;
  score?: number;
  pipeline_status: string;
  product_id?: string;
  tipo?: 'b2c' | 'b2b';
}

interface Produto {
  id: string;
  nome: string;
  imagem_url?: string;
}

interface Interacao {
  id: string;
  lead_id: string;
  lead_tipo: string;
  tipo: string;
  titulo?: string;
  descricao?: string;
  resultado?: string;
  duracao_segundos?: number;
  created_at: string;
}

// Componente Timeline
const TimelineInteracoes = ({ leadId, leadTipo, refresh }: { leadId: string; leadTipo: string; refresh: number }) => {
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInteracoes();
  }, [leadId, refresh]);

  const loadInteracoes = async () => {
    // Buscar interações
    const { data: interacoesData } = await supabase
      .from('interacoes')
      .select('*')
      .eq('lead_id', leadId)
      .eq('lead_tipo', leadTipo)
      .order('created_at', { ascending: false });
    
    // Buscar voice_calls
    const { data: callsData } = await supabase
      .from('voice_calls')
      .select('*')
      .eq('lead_id', leadId)
      .eq('lead_type', leadTipo);

    // Converter voice_calls para formato de interação
    const callsAsInteracoes: Interacao[] = (callsData || []).map(call => ({
      id: call.id,
      lead_id: call.lead_id,
      lead_tipo: call.lead_type,
      tipo: 'call',
      titulo: `Ligação Twilio - ${call.status}`,
      descricao: call.transcription || 'Sem transcrição disponível',
      resultado: (call.ai_analysis as any)?.sentiment || call.status,
      duracao_segundos: call.duration,
      created_at: call.created_at
    }));

    // Mesclar e ordenar por data
    const todasInteracoes = [...(interacoesData || []), ...callsAsInteracoes]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    setInteracoes(todasInteracoes);
    setLoading(false);
  };

  const getTipoIcon = (tipo: string) => {
    const icons: Record<string, JSX.Element> = {
      'call': <Phone className="w-4 h-4 text-blue-500" />,
      'whatsapp': <MessageSquare className="w-4 h-4 text-green-500" />,
      'email': <Mail className="w-4 h-4 text-purple-500" />,
      'meeting': <Calendar className="w-4 h-4 text-orange-500" />,
      'note': <FileText className="w-4 h-4 text-gray-500" />,
      'status_change': <TrendingUp className="w-4 h-4 text-indigo-500" />
    };
    return icons[tipo] || <Circle className="w-4 h-4" />;
  };

  const formatTempo = (segundos?: number) => {
    if (!segundos) return null;
    const min = Math.floor(segundos / 60);
    const sec = segundos % 60;
    return `${min}m ${sec}s`;
  };

  if (loading) return <div className="text-center py-4 text-muted-foreground">Carregando...</div>;

  if (interacoes.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8 text-sm">
        Nenhuma interação registrada ainda
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {interacoes.map((interacao, idx) => (
        <div key={interacao.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="p-2 rounded-full bg-muted">
              {getTipoIcon(interacao.tipo)}
            </div>
            {idx < interacoes.length - 1 && (
              <div className="w-px h-full bg-border mt-2" />
            )}
          </div>

          <div className="flex-1 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-sm">
                  {interacao.titulo || interacao.tipo}
                </p>
                {interacao.descricao && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {interacao.descricao}
                  </p>
                )}
                {interacao.resultado && (
                  <Badge variant="outline" className="mt-2">
                    {interacao.resultado}
                  </Badge>
                )}
                {interacao.duracao_segundos && (
                  <p className="text-xs text-muted-foreground mt-1">
                    ⏱️ Duração: {formatTempo(interacao.duracao_segundos)}
                  </p>
                )}
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {new Date(interacao.created_at).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default function LeadsFunil() {
  const [leadsB2C, setLeadsB2C] = useState<Lead[]>([]);
  const [leadsB2B, setLeadsB2B] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [leadSelecionado, setLeadSelecionado] = useState<Lead | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [filtroProduct, setFiltroProduct] = useState<string>('all');
  const [showNovaInteracao, setShowNovaInteracao] = useState(false);
  const [novaInteracao, setNovaInteracao] = useState({ tipo: '', titulo: '', descricao: '', resultado: '' });
  const [refreshTimeline, setRefreshTimeline] = useState(0);
  const [chamandoLead, setChamandoLead] = useState(false);
  const [campanhaFiltro, setCampanhaFiltro] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Pegar filtro de campanha da URL
    const campanhaId = searchParams.get('campanha');
    setCampanhaFiltro(campanhaId);
    loadLeads(campanhaId);
    loadProdutos();
  }, [searchParams]);

  const loadProdutos = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('produtos')
      .select('id, nome, imagem_url')
      .eq('user_id', user.id)
      .eq('ativo', true);
    
    setProdutos(data || []);
  };

  const loadLeads = async (campanhaId?: string | null) => {
    let queryB2C = supabase.from('leads_b2c').select('*').order('created_at', { ascending: false });
    let queryB2B = supabase.from('leads_b2b').select('*').order('created_at', { ascending: false });

    // Filtrar por campanha se fornecido
    if (campanhaId) {
      queryB2C = queryB2C.eq('campanha_id', campanhaId);
      queryB2B = queryB2B.eq('campanha_id', campanhaId);
    }

    const [b2c, b2b] = await Promise.all([queryB2C, queryB2B]);
    
    setLeadsB2C(b2c.data || []);
    setLeadsB2B(b2b.data || []);
    setLoading(false);
  };

  const handleDragStart = (lead: Lead, tipo: 'b2c' | 'b2b') => {
    setDraggedLead({ ...lead, tipo });
  };

  const handleDrop = async (novoStatus: string) => {
    if (!draggedLead) return;

    const { data: { user } } = await supabase.auth.getUser();
    const tabela = draggedLead.tipo === 'b2c' ? 'leads_b2c' : 'leads_b2b';
    
    // Atualizar status do lead
    await supabase
      .from(tabela)
      .update({ pipeline_status: novoStatus })
      .eq('id', draggedLead.id);

    // Registrar interação automática
    if (user) {
      await supabase.from('interacoes').insert({
        lead_id: draggedLead.id,
        lead_tipo: draggedLead.tipo,
        tipo: 'status_change',
        titulo: 'Status alterado',
        descricao: `Movido para: ${novoStatus}`,
        created_by: user.id
      });
    }

    toast.success('Lead movido!');
    loadLeads(campanhaFiltro);
    setDraggedLead(null);
  };

  const handleVincularProduto = async (leadId: string, productId: string) => {
    if (!leadSelecionado) return;
    
    const tabela = leadSelecionado.tipo === 'b2c' ? 'leads_b2c' : 'leads_b2b';
    
    await supabase
      .from(tabela)
      .update({ product_id: productId })
      .eq('id', leadId);

    toast.success('Produto vinculado!');
    loadLeads(campanhaFiltro);
    setLeadSelecionado(null);
  };

  const handleSalvarInteracao = async () => {
    if (!leadSelecionado || !novaInteracao.tipo) {
      toast.error('Selecione o tipo da interação');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('interacoes').insert({
      lead_id: leadSelecionado.id,
      lead_tipo: leadSelecionado.tipo,
      tipo: novaInteracao.tipo,
      titulo: novaInteracao.titulo,
      descricao: novaInteracao.descricao,
      resultado: novaInteracao.resultado,
      created_by: user.id
    });

    toast.success('Interação registrada!');
    setShowNovaInteracao(false);
    setNovaInteracao({ tipo: '', titulo: '', descricao: '', resultado: '' });
    setRefreshTimeline(prev => prev + 1);
  };

  const handleAbrirWhatsApp = (numero: string) => {
    const cleanNumber = numero.replace(/\D/g, '');
    window.open(`https://wa.me/55${cleanNumber}`, '_blank');
  };

  const handleLigarSimples = (numero: string) => {
    window.open(`tel:${numero}`, '_blank');
  };

  const handleLigarSimulado = async () => {
    if (!leadSelecionado?.telefone) {
      toast.error('Lead sem telefone');
      return;
    }

    setChamandoLead(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const nomeCliente = leadSelecionado.nome_completo || leadSelecionado.razao_social || 'Cliente';

      // Registrar interação simulada
      await supabase.from('interacoes').insert({
        lead_id: leadSelecionado.id,
        lead_tipo: leadSelecionado.tipo,
        tipo: 'call',
        titulo: '📞 Ligação IA (Simulação)',
        descricao: `Ligação de teste para ${leadSelecionado.telefone}.\n\nIA disse: "Olá ${nomeCliente}, aqui é da AMZ Ofertas. Estou entrando em contato para apresentar nossa solução de automação de marketing..."\n\nCliente respondeu: "Interessante, pode me enviar mais informações."\n\nIA: "Claro! Vou enviar por WhatsApp agora mesmo. Posso agendar uma demonstração?"\n\nCliente: "Sim, pode agendar."`,
        resultado: 'positivo',
        duracao_segundos: 180,
        created_by: user?.id,
        metadata: {
          phone: leadSelecionado.telefone,
          simulated: true,
          sentiment: 'positivo',
          interesse: true
        }
      });

      // Salvar em voice_calls também
      await supabase.from('voice_calls').insert({
        lead_id: leadSelecionado.id,
        lead_type: leadSelecionado.tipo,
        campanha_id: leadSelecionado.product_id || '00000000-0000-0000-0000-000000000000',
        user_id: user?.id,
        call_sid: `sim_${Date.now()}`,
        to_number: leadSelecionado.telefone,
        status: 'completed',
        duration: 180,
        transcription: `Conversa simulada com ${nomeCliente}.\n\nCliente demonstrou interesse e solicitou mais informações.\n\nPróximos passos: Enviar material por WhatsApp e agendar demonstração.`,
        ai_analysis: {
          sentiment: 'positivo',
          interesse: true,
          resumo: 'Cliente interessado, quer demonstração',
          keywords: ['interessante', 'informações', 'agendar']
        },
        lead_qualified: true
      });

      toast.success('📞 Ligação simulada registrada! Veja na Timeline.');
      setRefreshTimeline(prev => prev + 1);
      
      setTimeout(() => {
        loadLeads(campanhaFiltro);
        setChamandoLead(false);
      }, 1500);

    } catch (error: any) {
      console.error('Erro ao registrar:', error);
      toast.error('Erro ao registrar: ' + error.message);
      setChamandoLead(false);
    }
  };

  const getLeadsPorStatus = (status: string): Lead[] => {
    let b2c = leadsB2C.filter(l => l.pipeline_status === status);
    let b2b = leadsB2B.filter(l => l.pipeline_status === status);

    if (filtroProduct && filtroProduct !== 'all') {
      b2c = b2c.filter(l => l.product_id === filtroProduct);
      b2b = b2b.filter(l => l.product_id === filtroProduct);
    }

    return [...b2c.map(l => ({ ...l, tipo: 'b2c' as const })), ...b2b.map(l => ({ ...l, tipo: 'b2b' as const }))];
  };

  const getTemperatura = (score: number) => {
    if (score >= 70) return { emoji: '🔥', label: 'Quente', color: 'text-red-500' };
    if (score >= 40) return { emoji: '🟡', label: 'Morno', color: 'text-yellow-500' };
    return { emoji: '❄️', label: 'Frio', color: 'text-blue-500' };
  };

  const getProdutoNome = (productId?: string) => {
    if (!productId) return null;
    const produto = produtos.find(p => p.id === productId);
    return produto?.nome || null;
  };

  const getTotalLeadsFiltrados = () => {
    if (filtroProduct === 'all') {
      return leadsB2C.length + leadsB2B.length;
    }
    return leadsB2C.filter(l => l.product_id === filtroProduct).length + 
           leadsB2B.filter(l => l.product_id === filtroProduct).length;
  };

  if (loading) return <div className="p-6">Carregando...</div>;

  return (
    <div className="p-6 h-screen overflow-hidden bg-background">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => campanhaFiltro ? navigate('/campanhas-prospeccao') : navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold">🎯 Funil de Leads</h1>
            <p className="text-muted-foreground">
              Pipeline visual de prospecção
              {campanhaFiltro && (
                <Badge variant="secondary" className="ml-2">
                  Filtrado por campanha
                </Badge>
              )}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <Select value={filtroProduct} onValueChange={setFiltroProduct}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Filtrar por produto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os produtos</SelectItem>
              {produtos.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span>B2C: {leadsB2C.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500"></div>
              <span>B2B: {leadsB2B.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">|</span>
              <span>Mostrando: {getTotalLeadsFiltrados()}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-180px)]">
        {PIPELINE_STAGES.map(stage => {
          const leads = getLeadsPorStatus(stage.id);
          
          return (
            <div 
              key={stage.id}
              className="flex-shrink-0 w-80"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(stage.id)}
            >
              <div className={`${stage.color} text-white p-3 rounded-t-lg`}>
                <h3 className="font-semibold">{stage.label}</h3>
                <p className="text-xs opacity-90">{leads.length} leads</p>
              </div>
              
              <div className="bg-muted/30 p-2 space-y-2 rounded-b-lg min-h-[200px] max-h-[calc(100vh-280px)] overflow-y-auto border border-t-0 border-border">
                {leads.map(lead => {
                  const temp = getTemperatura(lead.score || 0);
                  const nome = lead.nome_completo || lead.razao_social || lead.nome_fantasia;
                  const produtoNome = getProdutoNome(lead.product_id);
                  
                  return (
                    <Card
                      key={lead.id}
                      draggable
                      onDragStart={() => handleDragStart(lead, lead.tipo!)}
                      onClick={() => setLeadSelecionado(lead)}
                      className="p-3 cursor-pointer hover:shadow-lg transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-sm truncate">{nome}</p>
                          {lead.profissao && (
                            <p className="text-xs text-muted-foreground">{lead.profissao}</p>
                          )}
                          {lead.setor && (
                            <p className="text-xs text-muted-foreground">{lead.setor}</p>
                          )}
                        </div>
                        <Badge variant="outline" className={temp.color}>
                          {temp.emoji} {lead.score || 0}
                        </Badge>
                      </div>

                      {produtoNome && (
                        <div className="mb-2">
                          <Badge variant="secondary" className="text-xs">
                            📦 {produtoNome}
                          </Badge>
                        </div>
                      )}

                      <div className="flex gap-2 text-xs text-muted-foreground">
                        {lead.telefone && (
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {lead.telefone.slice(-4)}
                          </div>
                        )}
                        {lead.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            Email
                          </div>
                        )}
                        {lead.whatsapp && (
                          <div className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            WhatsApp
                          </div>
                        )}
                      </div>

                      {lead.tipo === 'b2c' && lead.cidade && (
                        <p className="text-xs text-muted-foreground mt-1">
                          📍 {lead.cidade}/{lead.estado}
                        </p>
                      )}

                      <div className="mt-2">
                        <Badge variant={lead.tipo === 'b2c' ? 'default' : 'secondary'} className="text-xs">
                          {lead.tipo?.toUpperCase()}
                        </Badge>
                      </div>
                    </Card>
                  );
                })}

                {leads.length === 0 && (
                  <div className="text-center text-muted-foreground text-sm py-8">
                    Nenhum lead nesta etapa
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Detalhes do Lead */}
      <Dialog open={!!leadSelecionado} onOpenChange={() => setLeadSelecionado(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {leadSelecionado?.nome_completo || leadSelecionado?.razao_social || leadSelecionado?.nome_fantasia}
            </DialogTitle>
          </DialogHeader>

          {leadSelecionado && (
            <div className="space-y-4">
              {/* Info Básica */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Score</label>
                  <p className="text-2xl font-bold">{leadSelecionado.score || 0}/100</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">
                    <Badge>{leadSelecionado.pipeline_status}</Badge>
                  </div>
                </div>
              </div>

              {/* Produto Vinculado */}
              <div>
                <label className="text-sm font-medium mb-2 block">Produto de Interesse</label>
                <Select 
                  value={leadSelecionado.product_id || ''} 
                  onValueChange={(productId) => handleVincularProduto(leadSelecionado.id, productId)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {produtos.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Contatos */}
              <div className="space-y-2">
                <h4 className="font-semibold">Contatos</h4>
                {leadSelecionado.telefone && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{leadSelecionado.telefone}</span>
                    <Button size="sm" variant="outline" onClick={() => handleLigarSimples(leadSelecionado.telefone!)}>
                      <Phone className="w-3 h-3 mr-1" />
                      Ligar
                    </Button>
                    <Button 
                      size="sm" 
                      variant="default"
                      onClick={handleLigarSimulado}
                      disabled={chamandoLead}
                    >
                      {chamandoLead ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Ligando...
                        </>
                      ) : (
                        <>
                          <Phone className="w-3 h-3 mr-1" />
                          🤖 Ligar IA
                        </>
                      )}
                    </Button>
                  </div>
                )}
                {leadSelecionado.whatsapp && (
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    <span>{leadSelecionado.whatsapp}</span>
                    <Button size="sm" variant="outline" onClick={() => handleAbrirWhatsApp(leadSelecionado.whatsapp!)}>
                      <MessageSquare className="w-3 h-3 mr-1" />
                      WhatsApp
                    </Button>
                  </div>
                )}
                {leadSelecionado.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{leadSelecionado.email}</span>
                    <Button size="sm" variant="outline" asChild>
                      <a href={`mailto:${leadSelecionado.email}`}>
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Email
                      </a>
                    </Button>
                  </div>
                )}
              </div>

              {/* Localização */}
              {leadSelecionado.cidade && (
                <div>
                  <h4 className="font-semibold mb-1">Localização</h4>
                  <p className="text-muted-foreground">
                    📍 {leadSelecionado.cidade}/{leadSelecionado.estado}
                  </p>
                </div>
              )}

              {/* Timeline de Interações */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <History className="w-4 h-4" />
                    Timeline de Interações
                  </h4>
                  <Button size="sm" variant="outline" onClick={() => setShowNovaInteracao(true)}>
                    <Plus className="w-3 h-3 mr-1" />
                    Nova
                  </Button>
                </div>

                <div className="max-h-64 overflow-y-auto">
                  <TimelineInteracoes 
                    leadId={leadSelecionado.id} 
                    leadTipo={leadSelecionado.tipo!}
                    refresh={refreshTimeline}
                  />
                </div>
              </div>

              {/* Ações Rápidas */}
              <div className="flex gap-2 pt-4 border-t">
                <Button className="flex-1" onClick={() => {
                  toast.success('Lead qualificado!');
                  setLeadSelecionado(null);
                }}>
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Qualificar
                </Button>
                <Button className="flex-1" variant="outline" onClick={() => setShowNovaInteracao(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Interação
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Nova Interação */}
      <Dialog open={showNovaInteracao} onOpenChange={setShowNovaInteracao}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Interação</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Tipo</label>
              <Select value={novaInteracao.tipo} onValueChange={(v) => setNovaInteracao({...novaInteracao, tipo: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">📞 Ligação</SelectItem>
                  <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                  <SelectItem value="email">📧 Email</SelectItem>
                  <SelectItem value="meeting">🤝 Reunião</SelectItem>
                  <SelectItem value="note">📝 Anotação</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Título</label>
              <Input 
                placeholder="Ex: Ligação de apresentação"
                value={novaInteracao.titulo}
                onChange={(e) => setNovaInteracao({...novaInteracao, titulo: e.target.value})}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Descrição</label>
              <Textarea 
                placeholder="Descreva o que aconteceu..."
                value={novaInteracao.descricao}
                onChange={(e) => setNovaInteracao({...novaInteracao, descricao: e.target.value})}
                rows={4}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Resultado</label>
              <Select value={novaInteracao.resultado} onValueChange={(v) => setNovaInteracao({...novaInteracao, resultado: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Como foi?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="positivo">✅ Positivo</SelectItem>
                  <SelectItem value="neutro">➖ Neutro</SelectItem>
                  <SelectItem value="negativo">❌ Negativo</SelectItem>
                  <SelectItem value="agendado">📅 Agendado follow-up</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button className="w-full" onClick={handleSalvarInteracao}>
              Salvar Interação
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
