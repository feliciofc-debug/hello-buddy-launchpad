import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Phone, Mail, MessageSquare, TrendingUp, ArrowLeft, Calendar, ExternalLink, History, Plus, FileText, Circle, Loader2, Zap, Target } from 'lucide-react';
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

  // Simulação de ligação (Twilio desabilitado temporariamente)
  const handleLigarSimulado = async () => {
    if (!leadSelecionado?.telefone) {
      toast.error('Lead sem telefone');
      return;
    }

    setChamandoLead(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const nomeCliente = leadSelecionado.nome_completo || leadSelecionado.razao_social || 'Cliente';

      // 1. Salvar ligação simulada em voice_calls
      const { data: call, error: callError } = await supabase.from('voice_calls').insert({
        lead_id: leadSelecionado.id,
        lead_type: leadSelecionado.tipo,
        campanha_id: (leadSelecionado as any).campanha_id,
        call_sid: `sim_${Date.now()}`,
        to_number: leadSelecionado.telefone,
        status: 'completed',
        duration: 180,
        transcription: `[Simulação - Ligação IA]

IA: Olá, aqui é da AMZ Ofertas. Falo com ${nomeCliente}?

Cliente: Sim, sou eu.

IA: Estou entrando em contato porque identificamos que você tem potencial para nossa solução de automação de marketing. Tem interesse em conhecer?

Cliente: Sim, como funciona?

IA: Automatizamos WhatsApp, Google Ads e usamos IA para qualificar leads. Posso agendar uma demonstração?

Cliente: Pode sim, me envia mais informações.

IA: Perfeito! Envio por WhatsApp agora. Obrigado!`,
        ai_analysis: {
          sentiment: 'positivo',
          interesse: true,
          resumo: 'Cliente interessado',
          score_conversa: 85
        },
        user_id: user?.id || ''
      }).select().maybeSingle();

      if (callError) throw callError;

      // 2. Registrar interação
      await supabase.from('interacoes').insert({
        lead_id: leadSelecionado.id,
        lead_tipo: leadSelecionado.tipo,
        tipo: 'call',
        titulo: '📞 Ligação IA completada',
        descricao: 'Cliente demonstrou interesse',
        resultado: 'positivo',
        duracao_segundos: 180,
        created_by: user?.id
      });

      // 3. Aumentar score do lead
      const tabela = leadSelecionado.tipo === 'b2c' ? 'leads_b2c' : 'leads_b2b';
      await supabase
        .from(tabela)
        .update({ 
          score: Math.min((leadSelecionado.score || 0) + 15, 100),
          pipeline_status: 'qualificado'
        })
        .eq('id', leadSelecionado.id);

      toast.success('✅ Ligação concluída! Veja Timeline.');
      setRefreshTimeline(prev => prev + 1);
      
      setTimeout(() => {
        loadLeads(campanhaFiltro);
        setChamandoLead(false);
      }, 1500);

    } catch (error: any) {
      console.error('❌ Erro:', error);
      toast.error('Erro: ' + error.message);
      setChamandoLead(false);
    }
  };

  const [enviandoWhatsApp, setEnviandoWhatsApp] = useState(false);
  const [qualificandoLead, setQualificandoLead] = useState(false);
  const [qualificandoLote, setQualificandoLote] = useState(false);
  
  // Estados do modal de preview
  const [previewModal, setPreviewModal] = useState<{ step: 'select' | 'review' } | null>(null);
  const [leadsParaAbordar, setLeadsParaAbordar] = useState<Lead[]>([]);
  const [mensagensGeradas, setMensagensGeradas] = useState<Record<string, { texto: string; strategy?: any; aprovado: boolean; error?: boolean }>>({});
  const [processandoMensagens, setProcessandoMensagens] = useState(false);
  const [quantidadeLeads, setQuantidadeLeads] = useState(10);

  // QUALIFICAÇÃO ATIVA + ABORDAGEM WHATSAPP AUTOMÁTICA
  const handleQualificarEAbordar = async (lead: Lead) => {
    const telefone = lead.whatsapp || lead.telefone;
    if (!telefone) {
      toast.error('Lead sem telefone/WhatsApp');
      return;
    }

    setQualificandoLead(true);
    const toastId = 'qualify';

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // ETAPA 1: Enriquecer dados
      toast.loading('🔍 Enriquecendo dados do lead...', { id: toastId });
      
      const { data: enriched, error: enrichError } = await supabase.functions.invoke('enrich-lead', {
        body: { 
          lead_id: lead.id,
          lead_tipo: lead.tipo 
        }
      });

      if (enrichError) console.warn('Enriquecimento parcial:', enrichError);

      // ETAPA 2: IA cria estratégia de abordagem
      toast.loading('🤖 IA analisando perfil...', { id: toastId });
      
      const leadData = enriched?.lead || lead;
      const { data: strategy, error: strategyError } = await supabase.functions.invoke('create-approach-strategy', {
        body: {
          lead: leadData,
          produto: 'Soluções de Marketing Digital',
          objetivo: 'Agendar apresentação comercial'
        }
      });

      if (strategyError) {
        console.warn('Estratégia com fallback:', strategyError);
      }

      // ETAPA 3: Gerar mensagem WhatsApp ultra-personalizada
      toast.loading('💬 Gerando mensagem personalizada...', { id: toastId });
      
      const { data: messageData, error: msgError } = await supabase.functions.invoke('gerar-mensagem-ia', {
        body: {
          leadId: lead.id,
          leadTipo: lead.tipo,
          strategy: strategy,
          tipo_abordagem: 'ativa_comercial'
        }
      });

      if (msgError) throw msgError;

      const mensagem = messageData?.texto || messageData?.mensagem;
      if (!mensagem) throw new Error('Mensagem não gerada');

      // ETAPA 4: Enviar automaticamente pelo WhatsApp
      toast.loading('📱 Enviando pelo WhatsApp...', { id: toastId });
      
      const { data: sent, error: sendError } = await supabase.functions.invoke('send-whatsapp-prospeccao', {
        body: {
          phone: telefone,
          message: mensagem,
          leadId: lead.id,
          leadTipo: lead.tipo,
          strategy: strategy,
          userId: user.id
        }
      });

      if (sendError) throw sendError;

      // ETAPA 5: Registrar interação
      await supabase.from('interacoes').insert({
        lead_id: lead.id,
        lead_tipo: lead.tipo,
        tipo: 'whatsapp',
        titulo: '🎯 Abordagem ativa enviada',
        descricao: mensagem,
        resultado: 'aguardando_resposta',
        metadata: {
          strategy: strategy,
          auto_sent: true,
          objetivo: 'agendar_apresentacao'
        },
        created_by: user.id
      });

      // ETAPA 6: Atualizar lead
      const tabela = lead.tipo === 'b2c' ? 'leads_b2c' : 'leads_b2b';
      await supabase.from(tabela).update({
        pipeline_status: 'enviado',
        score: Math.min((lead.score || 0) + 20, 100),
        enviado_em: new Date().toISOString()
      }).eq('id', lead.id);

      toast.success('✅ Lead qualificado e abordado!', { id: toastId });
      
      setRefreshTimeline(prev => prev + 1);
      loadLeads(campanhaFiltro);
      setLeadSelecionado(null);

    } catch (error: any) {
      console.error('❌ Erro na qualificação:', error);
      toast.error('Erro: ' + error.message, { id: toastId });
    } finally {
      setQualificandoLead(false);
    }
  };

  // QUALIFICAÇÃO EM LOTE - ABRE MODAL DE SELEÇÃO
  const handleQualificarLote = async () => {
    const todosLeads = [...leadsB2C.map(l => ({ ...l, tipo: 'b2c' as const })), ...leadsB2B.map(l => ({ ...l, tipo: 'b2b' as const }))];
    
    const leadsQuentes = todosLeads.filter(l => 
      l.score && l.score >= 70 && 
      (l.pipeline_status === 'enriquecido' || l.pipeline_status === 'qualificado' || l.pipeline_status === 'descoberto') &&
      (l.whatsapp || l.telefone)
    );

    if (leadsQuentes.length === 0) {
      toast.error('Nenhum lead elegível (Score >= 70 + telefone)');
      return;
    }

    setLeadsParaAbordar(leadsQuentes.slice(0, 10));
    setQuantidadeLeads(Math.min(10, leadsQuentes.length));
    setMensagensGeradas({});
    setPreviewModal({ step: 'select' });
  };

  // Gerar mensagens para todos os leads selecionados
  const handleGerarMensagens = async () => {
    setProcessandoMensagens(true);
    const mensagens: Record<string, { texto: string; strategy?: any; aprovado: boolean; error?: boolean }> = {};

    for (const lead of leadsParaAbordar) {
      try {
        toast.loading(`Gerando mensagem ${Object.keys(mensagens).length + 1}/${leadsParaAbordar.length}...`, { id: 'gerar' });

        // Gerar estratégia
        const { data: strategy } = await supabase.functions.invoke('create-approach-strategy', {
          body: {
            lead,
            produto: 'Soluções de Marketing Digital',
            objetivo: 'Agendar apresentação comercial'
          }
        });

        // Gerar mensagem
        const { data: msg } = await supabase.functions.invoke('gerar-mensagem-ia', {
          body: {
            leadId: lead.id,
            leadTipo: lead.tipo,
            strategy,
            tipo_abordagem: 'ativa_comercial'
          }
        });

        mensagens[lead.id] = {
          texto: msg?.texto || msg?.mensagem || 'Erro ao gerar mensagem',
          strategy,
          aprovado: false,
          error: !msg?.texto && !msg?.mensagem
        };

        // Delay para não sobrecarregar
        await new Promise(r => setTimeout(r, 1000));

      } catch (error) {
        console.error('Erro ao gerar mensagem para lead:', lead.id, error);
        mensagens[lead.id] = {
          texto: 'Erro ao gerar mensagem',
          aprovado: false,
          error: true
        };
      }
    }

    toast.success(`${Object.keys(mensagens).length} mensagens geradas!`, { id: 'gerar' });
    setMensagensGeradas(mensagens);
    setPreviewModal({ step: 'review' });
    setProcessandoMensagens(false);
  };

  // Aprovar todas as mensagens
  const handleAprovarTodos = () => {
    setMensagensGeradas(prev => {
      const updated: typeof prev = {};
      Object.keys(prev).forEach(id => {
        if (!prev[id].error) {
          updated[id] = { ...prev[id], aprovado: true };
        } else {
          updated[id] = prev[id];
        }
      });
      return updated;
    });
  };

  // Enviar mensagens aprovadas
  const handleEnviarAprovados = async () => {
    const aprovados = Object.entries(mensagensGeradas).filter(([_, msg]) => msg.aprovado && !msg.error);

    if (aprovados.length === 0) {
      toast.error('Nenhuma mensagem aprovada');
      return;
    }

    setProcessandoMensagens(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    let enviados = 0;
    let erros = 0;

    for (const [leadId, msg] of aprovados) {
      const lead = leadsParaAbordar.find(l => l.id === leadId);
      if (!lead) continue;

      try {
        toast.loading(`Enviando ${enviados + 1}/${aprovados.length}...`, { id: 'enviar' });

        await supabase.functions.invoke('send-whatsapp-prospeccao', {
          body: {
            phone: lead.whatsapp || lead.telefone,
            message: msg.texto,
            leadId: lead.id,
            leadTipo: lead.tipo,
            strategy: msg.strategy,
            userId: user?.id
          }
        });

        // Registrar interação
        await supabase.from('interacoes').insert({
          lead_id: lead.id,
          lead_tipo: lead.tipo,
          tipo: 'whatsapp',
          titulo: '🎯 Abordagem ativa enviada',
          descricao: msg.texto,
          resultado: 'aguardando_resposta',
          created_by: user?.id
        });

        // Atualizar lead
        const tabela = lead.tipo === 'b2c' ? 'leads_b2c' : 'leads_b2b';
        await supabase.from(tabela).update({
          pipeline_status: 'enviado',
          enviado_em: new Date().toISOString()
        }).eq('id', lead.id);

        enviados++;
        
        // Aguardar 3s entre envios
        await new Promise(r => setTimeout(r, 3000));

      } catch (error) {
        console.error('Erro ao enviar:', error);
        erros++;
      }
    }

    setProcessandoMensagens(false);
    setPreviewModal(null);
    toast.success(`✅ ${enviados} enviados | ${erros > 0 ? `❌ ${erros} erros` : ''}`, { id: 'enviar' });
    
    loadLeads(campanhaFiltro);
  };

  // Atualizar quantidade de leads
  const handleAtualizarQuantidade = (num: number) => {
    const todosLeads = [...leadsB2C.map(l => ({ ...l, tipo: 'b2c' as const })), ...leadsB2B.map(l => ({ ...l, tipo: 'b2b' as const }))];
    const leadsQuentes = todosLeads.filter(l => 
      l.score && l.score >= 70 && 
      (l.pipeline_status === 'enriquecido' || l.pipeline_status === 'qualificado' || l.pipeline_status === 'descoberto') &&
      (l.whatsapp || l.telefone)
    );
    setQuantidadeLeads(num);
    setLeadsParaAbordar(leadsQuentes.slice(0, num));
  };

  const handleEnviarWhatsApp = async () => {
    if (!leadSelecionado?.telefone && !leadSelecionado?.whatsapp) {
      toast.error('Lead sem telefone/WhatsApp');
      return;
    }

    const numero = leadSelecionado.whatsapp || leadSelecionado.telefone;
    const nome = leadSelecionado.nome_completo || leadSelecionado.razao_social || 'Cliente';

    setEnviandoWhatsApp(true);
    
    try {
      console.log('📱 Enviando WhatsApp via Wuzapi...');
      
      const mensagem = `Olá ${nome}! 👋\n\nAqui é da AMZ Ofertas. Estamos entrando em contato porque identificamos que você pode ter interesse em nossas soluções de automação de marketing.\n\nPosso te apresentar como funciona?`;

      const { data, error } = await supabase.functions.invoke('send-wuzapi-message', {
        body: {
          phone: numero,
          message: mensagem
        }
      });

      if (error) throw error;

      console.log('✅ Resposta Wuzapi:', data);
      
      // Registrar interação
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('interacoes').insert({
        lead_id: leadSelecionado.id,
        lead_tipo: leadSelecionado.tipo,
        tipo: 'whatsapp',
        titulo: '📱 WhatsApp Enviado',
        descricao: mensagem,
        resultado: 'enviado',
        created_by: user?.id,
        metadata: { phone: numero, via: 'wuzapi' }
      });

      toast.success(`📱 WhatsApp enviado para ${nome}!`);
      setRefreshTimeline(prev => prev + 1);

    } catch (error: any) {
      console.error('❌ Erro ao enviar WhatsApp:', error);
      toast.error('Erro ao enviar: ' + error.message);
    } finally {
      setEnviandoWhatsApp(false);
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
          <Button 
            variant="secondary"
            onClick={handleQualificarLote}
            disabled={qualificandoLote}
          >
            {qualificandoLote ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 mr-2" />
            )}
            ⚡ Qualificar Lote (Score ≥70)
          </Button>

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
                  <div className="flex items-center gap-2 flex-wrap">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    <span>{leadSelecionado.whatsapp}</span>
                    <Button size="sm" variant="outline" onClick={() => handleAbrirWhatsApp(leadSelecionado.whatsapp!)}>
                      <MessageSquare className="w-3 h-3 mr-1" />
                      Abrir
                    </Button>
                    <Button 
                      size="sm" 
                      variant="default"
                      onClick={handleEnviarWhatsApp}
                      disabled={enviandoWhatsApp}
                    >
                      {enviandoWhatsApp ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <MessageSquare className="w-3 h-3 mr-1" />
                          📱 Enviar Msg
                        </>
                      )}
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
              <div className="flex gap-2 pt-4 border-t flex-wrap">
                <Button 
                  className="flex-1" 
                  onClick={() => handleQualificarEAbordar(leadSelecionado)}
                  disabled={qualificandoLead || (!leadSelecionado.whatsapp && !leadSelecionado.telefone)}
                >
                  {qualificandoLead ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Target className="w-4 h-4 mr-2" />
                      🎯 Qualificar + Abordar
                    </>
                  )}
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

      {/* Modal de Seleção de Leads para Abordagem em Lote */}
      <Dialog open={previewModal?.step === 'select'} onOpenChange={() => setPreviewModal(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>🎯 Selecionar Leads para Abordagem</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Seletor de quantidade */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Quantos leads processar?
              </label>
              <Input 
                type="number" 
                min="1" 
                max={leadsB2C.length + leadsB2B.length}
                value={quantidadeLeads}
                onChange={(e) => handleAtualizarQuantidade(parseInt(e.target.value) || 1)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {leadsParaAbordar.length} leads selecionados
              </p>
            </div>

            {/* Lista de leads selecionados */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {leadsParaAbordar.map((lead, idx) => (
                <Card key={lead.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium">
                        {idx + 1}. {lead.nome_completo || lead.razao_social}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {lead.profissao || lead.setor} • {lead.cidade}/{lead.estado} • Score: {lead.score}
                      </p>
                      <p className="text-xs">
                        📱 {lead.whatsapp || lead.telefone}
                      </p>
                    </div>
                    <Badge variant={lead.score && lead.score >= 80 ? 'default' : 'secondary'}>
                      {lead.score && lead.score >= 80 ? '🔥 Quente' : '🟡 Morno'}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setPreviewModal(null)}>
                Cancelar
              </Button>
              <Button 
                className="flex-1"
                onClick={handleGerarMensagens}
                disabled={processandoMensagens || leadsParaAbordar.length === 0}
              >
                {processandoMensagens ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Gerando mensagens...
                  </>
                ) : (
                  <>Gerar Mensagens ({leadsParaAbordar.length})</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Revisão das Mensagens */}
      <Dialog open={previewModal?.step === 'review'} onOpenChange={() => setPreviewModal(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>✏️ Revisar Mensagens Geradas</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {leadsParaAbordar.map((lead) => {
              const msg = mensagensGeradas[lead.id];
              if (!msg) return null;

              return (
                <Card key={lead.id} className={`p-4 ${msg.error ? 'border-red-500' : msg.aprovado ? 'border-green-500' : ''}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold">
                        {lead.nome_completo || lead.razao_social}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        📱 {lead.whatsapp || lead.telefone}
                      </p>
                    </div>
                    {!msg.error && (
                      <Button
                        size="sm"
                        variant={msg.aprovado ? 'default' : 'outline'}
                        onClick={() => {
                          setMensagensGeradas(prev => ({
                            ...prev,
                            [lead.id]: { ...prev[lead.id], aprovado: !prev[lead.id].aprovado }
                          }));
                        }}
                      >
                        {msg.aprovado ? '✅ Aprovado' : '⏸️ Aprovar'}
                      </Button>
                    )}
                    {msg.error && (
                      <Badge variant="destructive">Erro</Badge>
                    )}
                  </div>

                  <div className="bg-muted p-3 rounded-lg mb-2">
                    <Textarea
                      value={msg.texto}
                      onChange={(e) => {
                        setMensagensGeradas(prev => ({
                          ...prev,
                          [lead.id]: { ...prev[lead.id], texto: e.target.value }
                        }));
                      }}
                      rows={5}
                      className="resize-none"
                      disabled={msg.error}
                    />
                  </div>

                  {msg.strategy && (
                    <div className="text-xs text-muted-foreground">
                      <p><strong>Estratégia:</strong> {msg.strategy?.abordagem_recomendada}</p>
                      <p><strong>Tom:</strong> {msg.strategy?.tom_mensagem}</p>
                    </div>
                  )}
                </Card>
              );
            })}

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setPreviewModal({ step: 'select' })}>
                ← Voltar
              </Button>
              <Button 
                variant="secondary"
                onClick={handleAprovarTodos}
              >
                Aprovar Todos
              </Button>
              <Button 
                className="flex-1"
                onClick={handleEnviarAprovados}
                disabled={processandoMensagens || Object.values(mensagensGeradas).filter(m => m.aprovado && !m.error).length === 0}
              >
                {processandoMensagens ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    📱 Enviar Aprovados ({Object.values(mensagensGeradas).filter(m => m.aprovado && !m.error).length})
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
