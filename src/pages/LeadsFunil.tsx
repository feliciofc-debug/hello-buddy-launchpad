import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Phone, Mail, MessageSquare, TrendingUp, ArrowLeft, Calendar, ExternalLink, History, Plus, FileText, Circle, Loader2, Zap, Target, Sparkles, RefreshCw, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';

const PIPELINE_STAGES = [
  { id: 'descoberto', label: 'Descoberto', color: 'bg-gray-500' },
  { id: 'enriquecido', label: 'Enriquecido', color: 'bg-blue-500' },
  { id: 'qualificado', label: 'Qualificado', color: 'bg-purple-500' },
  { id: 'mensagem_gerada', label: 'Mensagem Gerada', color: 'bg-yellow-500' },
  { id: 'enviado', label: 'Enviado', color: 'bg-orange-500' },
  { id: 'respondeu', label: 'Respondeu', color: 'bg-green-500' },
  { id: 'convertido', label: 'Convertido', color: 'bg-emerald-600' },
  { id: 'invalidado', label: '❌ Invalidados', color: 'bg-red-500' }
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
  linkedin_url?: string;
  instagram_username?: string;
  facebook_url?: string;
  twitter_url?: string;
  site_url?: string;
  especialidade?: string;
  whatsapp_status?: string;
  fonte?: string;
  campanha_id?: string;
  created_at?: string;
  validado_manualmente?: boolean;
  validado_em?: string;
  validado_por?: string;
  motivo_invalidacao?: string;
  enriched_at?: string;
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
  const [filtroValidacao, setFiltroValidacao] = useState('todos');
  const [vendedores, setVendedores] = useState<{ id: string; nome: string; especialidade?: string }[]>([]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Pegar filtro de campanha da URL
    const campanhaId = searchParams.get('campanha');
    setCampanhaFiltro(campanhaId);
    loadLeads(campanhaId);
    loadProdutos();
    loadVendedores();
  }, [searchParams]);

  const loadVendedores = async () => {
    const { data } = await supabase
      .from('vendedores')
      .select('id, nome, especialidade')
      .eq('ativo', true);
    setVendedores(data || []);
  };

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
  
  // NOVO: Modal de aprovação individual
  const [previewIndividual, setPreviewIndividual] = useState<{
    lead: Lead;
    mensagem: string;
    strategy: any;
    pesquisa: any;
  } | null>(null);
  const [enviandoMensagemAprovada, setEnviandoMensagemAprovada] = useState(false);
  const [mensagemEditada, setMensagemEditada] = useState('');
  const [leadsParaAbordar, setLeadsParaAbordar] = useState<Lead[]>([]);
  const [mensagensGeradas, setMensagensGeradas] = useState<Record<string, { texto: string; strategy?: any; aprovado: boolean; error?: boolean }>>({});
  const [processandoMensagens, setProcessandoMensagens] = useState(false);
  const [quantidadeLeads, setQuantidadeLeads] = useState(10);
  
  // NOVO: Estados para enriquecimento e posts IA
  const [enriquecendoLead, setEnriquecendoLead] = useState(false);
  const [enriquecendoLote, setEnriquecendoLote] = useState(false);
  const [gerandoPost, setGerandoPost] = useState(false);
  const [postGerado, setPostGerado] = useState<{ post: string; rede: string } | null>(null);
  const [redeSocialSelecionada, setRedeSocialSelecionada] = useState<string>('LinkedIn');
  const [objetivoPost, setObjetivoPost] = useState<string>('gerar_curiosidade');
  const [produtoDescricao, setProdutoDescricao] = useState('AMZ Ofertas - Sistema de Automação de Marketing');
  const [copiado, setCopiado] = useState(false);

  // QUALIFICAÇÃO ATIVA + ABORDAGEM WHATSAPP COM APROVAÇÃO
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

      // ETAPA 1: Pesquisar lead no Google/Redes Sociais
      toast.loading('🔍 Pesquisando lead no Google e redes sociais...', { id: toastId });
      
      const nomeCompleto = lead.nome_completo || lead.razao_social || '';
      const profissao = lead.profissao || lead.setor || '';
      const cidade = lead.cidade || '';
      
      let pesquisaResultado: any = {
        linkedin: null,
        instagram: null,
        noticias: [],
        resumo: 'Pesquisa não realizada'
      };

      // Tentar enriquecer via função
      try {
        const { data: enriched } = await supabase.functions.invoke('enrich-lead', {
          body: { 
            lead_id: lead.id,
            lead_tipo: lead.tipo,
            buscar_redes_sociais: true
          }
        });
        
        if (enriched?.pesquisa) {
          pesquisaResultado = enriched.pesquisa;
        }
        
        // Buscar dados atualizados do lead
        const tabela = lead.tipo === 'b2c' ? 'leads_b2c' : 'leads_b2b';
        const { data: leadAtualizado } = await supabase
          .from(tabela)
          .select('*')
          .eq('id', lead.id)
          .single();
          
        if (leadAtualizado) {
          lead = { ...lead, ...leadAtualizado };
        }
      } catch (e) {
        console.warn('Enriquecimento parcial:', e);
      }

      // ETAPA 2: IA cria estratégia de abordagem
      toast.loading('🤖 IA analisando perfil e criando estratégia...', { id: toastId });
      
      const { data: strategy, error: strategyError } = await supabase.functions.invoke('create-approach-strategy', {
        body: {
          lead: lead,
          produto: 'Soluções de Marketing Digital',
          objetivo: 'Agendar apresentação comercial',
          contexto_pesquisa: pesquisaResultado
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

      toast.dismiss(toastId);

      // ETAPA 4: MOSTRAR PREVIEW PARA APROVAÇÃO (não enviar direto!)
      setPreviewIndividual({
        lead,
        mensagem,
        strategy,
        pesquisa: pesquisaResultado
      });
      setMensagemEditada(mensagem);
      setQualificandoLead(false);

    } catch (error: any) {
      console.error('❌ Erro na qualificação:', error);
      toast.error('Erro: ' + error.message, { id: toastId });
      setQualificandoLead(false);
    }
  };

  // ENVIAR MENSAGEM APÓS APROVAÇÃO
  const handleEnviarMensagemAprovada = async () => {
    if (!previewIndividual) return;
    
    const { lead, strategy } = previewIndividual;
    const mensagem = mensagemEditada || previewIndividual.mensagem;
    const telefone = lead.whatsapp || lead.telefone;
    
    if (!telefone) {
      toast.error('Lead sem telefone');
      return;
    }

    setEnviandoMensagemAprovada(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Formatar telefone
      let phoneFormatted = telefone.replace(/\D/g, '');
      if (phoneFormatted.length === 11) phoneFormatted = `55${phoneFormatted}`;

      // 1. Enviar mensagem via Wuzapi
      toast.loading('📱 Enviando WhatsApp...', { id: 'send' });
      
      const { error: sendError } = await supabase.functions.invoke('send-whatsapp-prospeccao', {
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

      // 2. Criar/atualizar conversa em whatsapp_conversations para IA Conversas
      const { data: existingConv } = await supabase
        .from('whatsapp_conversations')
        .select('id')
        .eq('phone_number', phoneFormatted)
        .eq('user_id', user.id)
        .maybeSingle();

      let conversationId = existingConv?.id;

      if (!conversationId) {
        const { data: newConv } = await supabase
          .from('whatsapp_conversations')
          .insert({
            user_id: user.id,
            phone_number: phoneFormatted,
            contact_name: lead.nome_completo || lead.razao_social,
            lead_id: lead.id,
            tipo_contato: 'lead',
            origem: 'prospeccao',
            modo_atendimento: 'ia',
            last_message_at: new Date().toISOString(),
            metadata: {
              lead_tipo: lead.tipo,
              profissao: lead.profissao,
              especialidade: (lead as any).especialidade,
              setor: lead.setor,
              cidade: lead.cidade,
              estado: lead.estado,
              score: lead.score,
              campanha_id: (lead as any).campanha_id,
              strategy: strategy
            }
          })
          .select()
          .single();
        
        conversationId = newConv?.id;
      } else {
        await supabase
          .from('whatsapp_conversations')
          .update({
            lead_id: lead.id,
            contact_name: lead.nome_completo || lead.razao_social,
            origem: 'prospeccao',
            last_message_at: new Date().toISOString(),
            metadata: {
              lead_tipo: lead.tipo,
              strategy: strategy
            }
          })
          .eq('id', conversationId);
      }

      // 3. Salvar mensagem na conversa
      if (conversationId) {
        await supabase.from('whatsapp_conversation_messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: mensagem,
          metadata: {
            tipo: 'prospeccao_ativa',
            lead_id: lead.id,
            auto_sent: true,
            aprovado_por_usuario: true
          }
        });
      }

      // 4. Registrar interação
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
          aprovado_por_usuario: true,
          conversation_id: conversationId,
          phone: phoneFormatted
        },
        created_by: user.id
      });

      // 5. Atualizar lead
      const tabela = lead.tipo === 'b2c' ? 'leads_b2c' : 'leads_b2b';
      await supabase.from(tabela).update({
        pipeline_status: 'enviado',
        score: Math.min((lead.score || 0) + 20, 100),
        enviado_em: new Date().toISOString(),
        mensagem_selecionada: mensagem
      }).eq('id', lead.id);

      toast.success('✅ Mensagem enviada e conversa criada!', { id: 'send' });
      
      // Fechar modais e atualizar
      setPreviewIndividual(null);
      setLeadSelecionado(null);
      setRefreshTimeline(prev => prev + 1);
      loadLeads(campanhaFiltro);

    } catch (error: any) {
      console.error('❌ Erro ao enviar:', error);
      toast.error('Erro: ' + error.message, { id: 'send' });
    } finally {
      setEnviandoMensagemAprovada(false);
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

  // Enviar mensagens aprovadas - COM INTEGRAÇÃO IA CONVERSAS
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

      const telefone = lead.whatsapp || lead.telefone;
      if (!telefone) continue;

      // Formatar telefone
      let phoneFormatted = telefone.replace(/\D/g, '');
      if (phoneFormatted.length === 11) phoneFormatted = `55${phoneFormatted}`;

      try {
        toast.loading(`Enviando ${enviados + 1}/${aprovados.length}...`, { id: 'enviar' });

        // 1. Enviar mensagem via Wuzapi
        await supabase.functions.invoke('send-whatsapp-prospeccao', {
          body: {
            phone: telefone,
            message: msg.texto,
            leadId: lead.id,
            leadTipo: lead.tipo,
            strategy: msg.strategy,
            userId: user?.id
          }
        });

        // 2. Verificar se já existe conversa para este telefone
        const { data: existingConv } = await supabase
          .from('whatsapp_conversations')
          .select('id')
          .eq('phone_number', phoneFormatted)
          .eq('user_id', user?.id)
          .maybeSingle();

        let conversationId = existingConv?.id;

        // 3. Se não existe, criar conversa com dados do lead
        if (!conversationId) {
          const { data: newConv } = await supabase
            .from('whatsapp_conversations')
            .insert({
              user_id: user?.id,
              phone_number: phoneFormatted,
              contact_name: lead.nome_completo || lead.razao_social,
              lead_id: lead.id,
              tipo_contato: 'lead',
              origem: 'prospeccao',
              modo_atendimento: 'ia',
              last_message_at: new Date().toISOString(),
              metadata: {
                lead_tipo: lead.tipo,
                profissao: lead.profissao,
                especialidade: (lead as any).especialidade,
                setor: lead.setor,
                cidade: lead.cidade,
                estado: lead.estado,
                score: lead.score,
                campanha_id: (lead as any).campanha_id,
                strategy: msg.strategy
              }
            })
            .select()
            .single();
          
          conversationId = newConv?.id;
        } else {
          // Atualizar conversa existente com dados do lead
          await supabase
            .from('whatsapp_conversations')
            .update({
              lead_id: lead.id,
              contact_name: lead.nome_completo || lead.razao_social,
              origem: 'prospeccao',
              last_message_at: new Date().toISOString(),
              metadata: {
                lead_tipo: lead.tipo,
                profissao: lead.profissao,
                especialidade: (lead as any).especialidade,
                setor: lead.setor,
                cidade: lead.cidade,
                estado: lead.estado,
                score: lead.score,
                strategy: msg.strategy
              }
            })
            .eq('id', conversationId);
        }

        // 4. Salvar mensagem enviada na conversa
        if (conversationId) {
          await supabase.from('whatsapp_conversation_messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: msg.texto,
            metadata: {
              tipo: 'prospeccao_ativa',
              lead_id: lead.id,
              auto_sent: true
            }
          });
        }

        // 5. Registrar interação com referência à conversa
        await supabase.from('interacoes').insert({
          lead_id: lead.id,
          lead_tipo: lead.tipo,
          tipo: 'whatsapp',
          titulo: '🎯 Abordagem ativa enviada',
          descricao: msg.texto,
          resultado: 'aguardando_resposta',
          created_by: user?.id,
          metadata: {
            conversation_id: conversationId,
            phone: phoneFormatted
          }
        });

        // 6. Atualizar lead
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

  // ENRIQUECER LEAD INDIVIDUAL
  const handleEnriquecerLead = async (lead: Lead) => {
    setEnriquecendoLead(true);
    
    try {
      toast.loading('🔍 Enriquecendo lead...', { id: 'enrich' });
      
      const { data, error } = await supabase.functions.invoke('enrich-lead', {
        body: { 
          leadId: lead.id,
          leadTipo: lead.tipo
        }
      });

      if (error) throw error;

      toast.success(`✅ Lead enriquecido! Score: ${data.score_novo} (+${data.bonus_aplicado})`, { id: 'enrich' });
      
      loadLeads(campanhaFiltro);
      setLeadSelecionado(null);

    } catch (error: any) {
      console.error('❌ Erro ao enriquecer:', error);
      toast.error('Erro: ' + error.message, { id: 'enrich' });
    } finally {
      setEnriquecendoLead(false);
    }
  };

  // ENRIQUECER TODOS OS LEADS (LOTE)
  const handleEnriquecerLote = async () => {
    const todosLeads = [...leadsB2C.map(l => ({ ...l, tipo: 'b2c' as const })), ...leadsB2B.map(l => ({ ...l, tipo: 'b2b' as const }))];
    const leadsParaEnriquecer = todosLeads.filter(l => 
      l.pipeline_status === 'descoberto' && 
      !l.enriched_at
    ).slice(0, 20);

    if (leadsParaEnriquecer.length === 0) {
      toast.error('Nenhum lead para enriquecer');
      return;
    }

    setEnriquecendoLote(true);
    let sucesso = 0;
    let erros = 0;

    for (const lead of leadsParaEnriquecer) {
      try {
        toast.loading(`Enriquecendo ${sucesso + 1}/${leadsParaEnriquecer.length}...`, { id: 'enrich-lote' });
        
        await supabase.functions.invoke('enrich-lead', {
          body: { 
            leadId: lead.id,
            leadTipo: lead.tipo
          }
        });
        
        sucesso++;
        await new Promise(r => setTimeout(r, 2000)); // Delay entre requests

      } catch (error) {
        console.error('Erro ao enriquecer:', lead.id, error);
        erros++;
      }
    }

    toast.success(`✅ ${sucesso} enriquecidos | ${erros > 0 ? `❌ ${erros} erros` : ''}`, { id: 'enrich-lote' });
    setEnriquecendoLote(false);
    loadLeads(campanhaFiltro);
  };

  // GERAR POST PARA REDE SOCIAL COM IA
  const handleGerarPostIA = async () => {
    if (!leadSelecionado) return;
    
    setGerandoPost(true);
    setPostGerado(null);
    
    try {
      toast.loading(`🤖 Gerando post para ${redeSocialSelecionada}...`, { id: 'post' });
      
      const { data, error } = await supabase.functions.invoke('generate-social-post', {
        body: {
          lead: leadSelecionado,
          produto: produtoDescricao,
          objetivo: objetivoPost,
          redeSocial: redeSocialSelecionada
        }
      });

      if (error) throw error;

      setPostGerado({
        post: data.post,
        rede: data.rede
      });

      toast.success(`✅ Post gerado! ${data.caracteres} caracteres`, { id: 'post' });

    } catch (error: any) {
      console.error('❌ Erro ao gerar post:', error);
      toast.error('Erro: ' + error.message, { id: 'post' });
    } finally {
      setGerandoPost(false);
    }
  };

  // COPIAR POST
  const handleCopiarPost = () => {
    if (!postGerado?.post) return;
    navigator.clipboard.writeText(postGerado.post);
    setCopiado(true);
    toast.success('Post copiado!');
    setTimeout(() => setCopiado(false), 2000);
  };

  // VALIDAR/INVALIDAR LEAD MANUALMENTE
  const handleValidarLead = async (leadId: string, isValid: boolean) => {
    if (!leadSelecionado) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    const tabela = leadSelecionado.tipo === 'b2c' ? 'leads_b2c' : 'leads_b2b';

    if (isValid) {
      // Marcar como validado
      await supabase.from(tabela).update({
        validado_manualmente: true,
        validado_em: new Date().toISOString(),
        validado_por: user?.id,
        score: Math.min((leadSelecionado.score || 0) + 20, 100)
      }).eq('id', leadId);

      toast.success('✅ Lead validado! Score +20');
      
    } else {
      // Marcar como inválido
      const motivo = prompt('Por que este lead é falso?');
      
      await supabase.from(tabela).update({
        validado_manualmente: false,
        validado_em: new Date().toISOString(),
        validado_por: user?.id,
        motivo_invalidacao: motivo || 'Não especificado',
        pipeline_status: 'invalidado',
        score: 0
      }).eq('id', leadId);

      toast.error('❌ Lead marcado como falso e removido');
    }

    setLeadSelecionado(null);
    loadLeads(campanhaFiltro);
  };

  // Calcular estatísticas de qualidade
  const getQualityStats = () => {
    const todosLeads = [...leadsB2C, ...leadsB2B];
    return {
      total: todosLeads.length,
      validados: todosLeads.filter(l => l.validado_manualmente === true).length,
      comLinkedin: todosLeads.filter(l => l.linkedin_url).length,
      comInstagram: todosLeads.filter(l => l.instagram_username).length,
      whatsappOk: todosLeads.filter(l => l.whatsapp_status === 'valid' || l.whatsapp).length,
      invalidos: todosLeads.filter(l => l.pipeline_status === 'invalidado').length
    };
  };

  const getLeadsPorStatus = (status: string): Lead[] => {
    let b2c = leadsB2C.filter(l => l.pipeline_status === status);
    let b2b = leadsB2B.filter(l => l.pipeline_status === status);

    if (filtroProduct && filtroProduct !== 'all') {
      b2c = b2c.filter(l => l.product_id === filtroProduct);
      b2b = b2b.filter(l => l.product_id === filtroProduct);
    }

    // Aplicar filtro de validação
    if (filtroValidacao === 'validados') {
      b2c = b2c.filter(l => l.validado_manualmente === true);
      b2b = b2b.filter(l => l.validado_manualmente === true);
    } else if (filtroValidacao === 'nao_validados') {
      b2c = b2c.filter(l => !l.validado_manualmente && l.pipeline_status !== 'invalidado');
      b2b = b2b.filter(l => !l.validado_manualmente && l.pipeline_status !== 'invalidado');
    } else if (filtroValidacao === 'invalidados') {
      b2c = b2c.filter(l => l.pipeline_status === 'invalidado');
      b2b = b2b.filter(l => l.pipeline_status === 'invalidado');
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
    <div className="p-6 min-h-screen overflow-auto bg-background">
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
            variant="outline"
            onClick={handleEnriquecerLote}
            disabled={enriquecendoLote}
          >
            {enriquecendoLote ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            🔍 Enriquecer Lote
          </Button>
          
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
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar por produto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os produtos</SelectItem>
              {produtos.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filtroValidacao} onValueChange={setFiltroValidacao}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Validação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="validados">✅ Apenas Validados</SelectItem>
              <SelectItem value="nao_validados">⏳ Não Validados</SelectItem>
              <SelectItem value="invalidados">❌ Marcados como Falsos</SelectItem>
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

      {/* Relatório de Qualidade */}
      {(() => {
        const stats = getQualityStats();
        return (
          <Card className="p-4 mb-4">
            <h3 className="font-bold mb-3">📊 Relatório de Qualidade</h3>
            
            <div className="grid grid-cols-6 gap-4 text-sm">
              <div className="text-center">
                <p className="text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              
              <div className="text-center">
                <p className="text-muted-foreground">Validados</p>
                <p className="text-2xl font-bold text-green-500">{stats.validados}</p>
                <p className="text-xs text-muted-foreground">
                  {stats.total > 0 ? ((stats.validados/stats.total)*100).toFixed(1) : 0}%
                </p>
              </div>
              
              <div className="text-center">
                <p className="text-muted-foreground">Com LinkedIn</p>
                <p className="text-2xl font-bold text-blue-500">{stats.comLinkedin}</p>
                <p className="text-xs text-muted-foreground">
                  {stats.total > 0 ? ((stats.comLinkedin/stats.total)*100).toFixed(1) : 0}%
                </p>
              </div>
              
              <div className="text-center">
                <p className="text-muted-foreground">Com Instagram</p>
                <p className="text-2xl font-bold text-pink-500">{stats.comInstagram}</p>
                <p className="text-xs text-muted-foreground">
                  {stats.total > 0 ? ((stats.comInstagram/stats.total)*100).toFixed(1) : 0}%
                </p>
              </div>
              
              <div className="text-center">
                <p className="text-muted-foreground">WhatsApp OK</p>
                <p className="text-2xl font-bold text-green-500">{stats.whatsappOk}</p>
                <p className="text-xs text-muted-foreground">
                  {stats.total > 0 ? ((stats.whatsappOk/stats.total)*100).toFixed(1) : 0}%
                </p>
              </div>
              
              <div className="text-center">
                <p className="text-muted-foreground">Falsos</p>
                <p className="text-2xl font-bold text-red-500">{stats.invalidos}</p>
              </div>
            </div>
          </Card>
        );
      })()}

      <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-280px)]">
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
              
              <div className="bg-muted/30 p-2 space-y-2 rounded-b-lg min-h-[200px] max-h-[calc(100vh-380px)] overflow-y-auto border border-t-0 border-border">
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

                      {/* Badges de Validação e Redes Sociais */}
                      <div className="flex gap-1 mt-2 flex-wrap">
                        <Badge variant={lead.tipo === 'b2c' ? 'default' : 'secondary'} className="text-xs">
                          {lead.tipo?.toUpperCase()}
                        </Badge>
                        
                        {lead.validado_manualmente && (
                          <Badge variant="default" className="bg-green-500 text-xs">
                            ✓ Validado
                          </Badge>
                        )}
                        
                        {lead.linkedin_url && (
                          <Badge variant="outline" className="text-xs">
                            in
                          </Badge>
                        )}
                        
                        {lead.instagram_username && (
                          <Badge variant="outline" className="text-xs">
                            📷
                          </Badge>
                        )}
                        
                        {(lead.whatsapp_status === 'valid' || lead.whatsapp) && (
                          <Badge variant="outline" className="text-xs text-green-600">
                            ✓ WA
                          </Badge>
                        )}
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {leadSelecionado?.nome_completo || leadSelecionado?.razao_social || leadSelecionado?.nome_fantasia}
              {leadSelecionado?.validado_manualmente && (
                <Badge variant="default" className="bg-green-500">
                  ✓ Validado
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {leadSelecionado && (
            <div className="space-y-4">
              {/* SEÇÃO 1: PROVAS VISUAIS - REDES SOCIAIS */}
              <Card className="p-4 bg-blue-50 dark:bg-blue-950/30">
                <h3 className="font-bold mb-3 flex items-center gap-2">
                  🔗 Provas Visuais - Clique para Verificar
                </h3>

                <div className="space-y-3">
                  {/* LinkedIn */}
                  {leadSelecionado.linkedin_url ? (
                    <div className="flex items-center justify-between p-3 bg-background rounded">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded flex items-center justify-center">
                          <span className="text-white font-bold">in</span>
                        </div>
                        <div>
                          <p className="font-semibold">LinkedIn Verificado</p>
                          <p className="text-xs text-muted-foreground">
                            {leadSelecionado.profissao}
                          </p>
                        </div>
                      </div>
                      <Button 
                        size="sm"
                        onClick={() => window.open(leadSelecionado.linkedin_url!, '_blank')}
                      >
                        Ver Perfil →
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-3 bg-muted rounded opacity-50">
                      <div className="w-10 h-10 bg-muted-foreground/30 rounded flex items-center justify-center">
                        <span className="text-muted-foreground font-bold">in</span>
                      </div>
                      <p className="text-sm text-muted-foreground">LinkedIn não encontrado</p>
                    </div>
                  )}

                  {/* Instagram */}
                  {leadSelecionado.instagram_username ? (
                    <div className="flex items-center justify-between p-3 bg-background rounded">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded flex items-center justify-center">
                          <span className="text-white font-bold">📷</span>
                        </div>
                        <div>
                          <p className="font-semibold">Instagram Encontrado</p>
                          <p className="text-xs text-muted-foreground">
                            @{leadSelecionado.instagram_username}
                          </p>
                        </div>
                      </div>
                      <Button 
                        size="sm"
                        onClick={() => window.open(`https://instagram.com/${leadSelecionado.instagram_username}`, '_blank')}
                      >
                        Ver Perfil →
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-3 bg-muted rounded opacity-50">
                      <div className="w-10 h-10 bg-muted-foreground/30 rounded flex items-center justify-center">
                        <span className="text-muted-foreground font-bold">📷</span>
                      </div>
                      <p className="text-sm text-muted-foreground">Instagram não encontrado</p>
                    </div>
                  )}

                  {/* Facebook */}
                  {leadSelecionado.facebook_url && (
                    <div className="flex items-center justify-between p-3 bg-background rounded">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500 rounded flex items-center justify-center">
                          <span className="text-white font-bold">f</span>
                        </div>
                        <div>
                          <p className="font-semibold">Facebook Encontrado</p>
                          <p className="text-xs text-muted-foreground">Perfil verificado</p>
                        </div>
                      </div>
                      <Button 
                        size="sm"
                        onClick={() => window.open(leadSelecionado.facebook_url!, '_blank')}
                      >
                        Ver Perfil →
                      </Button>
                    </div>
                  )}

                  {/* Google Search */}
                  <div className="flex items-center justify-between p-3 bg-background rounded">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                        <span className="text-muted-foreground font-bold">G</span>
                      </div>
                      <div>
                        <p className="font-semibold">Buscar no Google</p>
                        <p className="text-xs text-muted-foreground">
                          Verificar manualmente na web
                        </p>
                      </div>
                    </div>
                    <a 
                      href={`https://www.google.com/search?q=${encodeURIComponent(
                        `${leadSelecionado.nome_completo || leadSelecionado.razao_social || ''} ${leadSelecionado.profissao || ''} ${leadSelecionado.cidade || ''}`.trim()
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center h-9 px-3 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground text-sm font-medium"
                    >
                      🔍 Buscar no Google
                    </a>
                  </div>
                </div>
              </Card>

              {/* SEÇÃO 2: DADOS COLETADOS */}
              <Card className="p-4">
                <h3 className="font-bold mb-3">📋 Dados Coletados</h3>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Nome Completo</p>
                    <p className="font-semibold">{leadSelecionado.nome_completo || leadSelecionado.razao_social || 'N/A'}</p>
                  </div>
                  
                  <div>
                    <p className="text-muted-foreground">Score</p>
                    <p className="text-2xl font-bold">{leadSelecionado.score || 0}/100</p>
                  </div>
                  
                  <div>
                    <p className="text-muted-foreground">Profissão/Setor</p>
                    <p className="font-semibold">{leadSelecionado.profissao || leadSelecionado.setor || 'N/A'}</p>
                  </div>
                  
                  {leadSelecionado.especialidade && (
                    <div>
                      <p className="text-muted-foreground">Especialidade</p>
                      <p className="font-semibold">{leadSelecionado.especialidade}</p>
                    </div>
                  )}
                  
                  <div>
                    <p className="text-muted-foreground">Localização</p>
                    <p className="font-semibold">
                      {leadSelecionado.cidade}/{leadSelecionado.estado}
                    </p>
                  </div>
                  
                  {leadSelecionado.telefone && (
                    <div>
                      <p className="text-muted-foreground">Telefone</p>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{leadSelecionado.telefone}</p>
                        {leadSelecionado.whatsapp_status === 'valid' || leadSelecionado.whatsapp ? (
                          <Badge variant="default" className="bg-green-500 text-xs">
                            ✓ WhatsApp
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Não verificado
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {leadSelecionado.email && (
                    <div>
                      <p className="text-muted-foreground">Email</p>
                      <p className="font-semibold">{leadSelecionado.email}</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* SEÇÃO 3: ENRIQUECIMENTO E POSTS IA */}
              <Card className="p-4 bg-purple-50 dark:bg-purple-950/30">
                <h3 className="font-bold mb-3 flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Enriquecimento + Posts IA
                </h3>
                
                <div className="space-y-4">
                  {/* Botão Enriquecer */}
                  <Button 
                    className="w-full"
                    variant="outline"
                    onClick={() => handleEnriquecerLead(leadSelecionado)}
                    disabled={enriquecendoLead}
                  >
                    {enriquecendoLead ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Enriquecendo...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        🔍 Enriquecer (Buscar Telefone, Email, Redes)
                      </>
                    )}
                  </Button>

                  {/* Gerador de Posts IA */}
                  <div className="border-t pt-4 space-y-3">
                    <p className="text-sm font-semibold">📱 Gerar Post para Redes Sociais</p>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">Rede Social</label>
                        <Select value={redeSocialSelecionada} onValueChange={setRedeSocialSelecionada}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                            <SelectItem value="Instagram">Instagram</SelectItem>
                            <SelectItem value="Facebook">Facebook</SelectItem>
                            <SelectItem value="Twitter">Twitter/X</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <label className="text-xs text-muted-foreground">Objetivo</label>
                        <Select value={objetivoPost} onValueChange={setObjetivoPost}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gerar_curiosidade">Gerar Curiosidade</SelectItem>
                            <SelectItem value="agendar_demo">Agendar Demo</SelectItem>
                            <SelectItem value="networking">Networking</SelectItem>
                            <SelectItem value="branding">Branding</SelectItem>
                            <SelectItem value="educacao">Educar</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground">Seu Produto/Serviço</label>
                      <Input 
                        value={produtoDescricao}
                        onChange={(e) => setProdutoDescricao(e.target.value)}
                        placeholder="Ex: Sistema de CRM para vendas"
                      />
                    </div>

                    <Button 
                      className="w-full"
                      onClick={handleGerarPostIA}
                      disabled={gerandoPost}
                    >
                      {gerandoPost ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Gerando post...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          🤖 Gerar Post com IA
                        </>
                      )}
                    </Button>

                    {/* Post Gerado */}
                    {postGerado && (
                      <div className="mt-4 p-4 bg-background rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="secondary">{postGerado.rede}</Badge>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={handleCopiarPost}
                          >
                            {copiado ? (
                              <>
                                <Check className="w-3 h-3 mr-1" />
                                Copiado!
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 mr-1" />
                                Copiar
                              </>
                            )}
                          </Button>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{postGerado.post}</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* SEÇÃO 4: VALIDAÇÃO MANUAL */}
              <Card className="p-4 bg-yellow-50 dark:bg-yellow-950/30">
                <h3 className="font-bold mb-3">✅ Validação Manual</h3>
                
                <div className="space-y-3">
                  <p className="text-sm">
                    Você verificou este lead nas redes sociais? Confirme se é um perfil REAL:
                  </p>

                  <div className="flex gap-2">
                    <Button 
                      className="flex-1 bg-green-500 hover:bg-green-600"
                      onClick={() => handleValidarLead(leadSelecionado.id, true)}
                    >
                      ✅ Lead Verificado (É REAL)
                    </Button>
                    
                    <Button 
                      className="flex-1 bg-red-500 hover:bg-red-600"
                      onClick={() => handleValidarLead(leadSelecionado.id, false)}
                    >
                      ❌ Lead Falso (REMOVER)
                    </Button>
                  </div>

                  {leadSelecionado.validado_manualmente && leadSelecionado.validado_em && (
                    <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded">
                      <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                        ✓ Lead validado em {new Date(leadSelecionado.validado_em).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              {/* SEÇÃO: ATRIBUIR VENDEDOR */}
              {vendedores.length > 0 && (
                <Card className="p-4 bg-blue-50 dark:bg-blue-950/30">
                  <h3 className="font-bold mb-3">👥 Atribuir Vendedor</h3>
                  
                  <Select
                    value={(leadSelecionado as any).vendedor_id || 'nenhum'}
                    onValueChange={async (v) => {
                      const tabela = leadSelecionado.tipo === 'b2c' ? 'leads_b2c' : 'leads_b2b';
                      const vendedorId = v === 'nenhum' ? null : v;
                      
                      await supabase
                        .from(tabela)
                        .update({ vendedor_id: vendedorId })
                        .eq('id', leadSelecionado.id);

                      // Registrar atribuição
                      if (vendedorId) {
                        const { data: { user } } = await supabase.auth.getUser();
                        await supabase.from('lead_atribuicoes').insert({
                          lead_id: leadSelecionado.id,
                          lead_tipo: leadSelecionado.tipo,
                          vendedor_id: vendedorId,
                          atribuido_por: user?.id,
                          motivo: 'Atribuição manual'
                        });
                      }

                      toast.success('Vendedor atribuído!');
                      loadLeads(campanhaFiltro);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione vendedor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Sem vendedor</SelectItem>
                      {vendedores.map(v => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.nome} {v.especialidade && `(${v.especialidade})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Card>
              )}

              {/* SEÇÃO 4: CONTATOS E AÇÕES */}
              <div className="space-y-2">
                <h4 className="font-semibold">📞 Contatos Rápidos</h4>
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

              {/* SEÇÃO 5: METADADOS TÉCNICOS */}
              <details className="text-xs">
                <summary className="cursor-pointer font-semibold mb-2">
                  🔍 Ver Metadados Técnicos
                </summary>
                <pre className="bg-muted p-3 rounded overflow-x-auto text-xs">
{JSON.stringify({
  id: leadSelecionado.id,
  fonte: leadSelecionado.fonte,
  score: leadSelecionado.score,
  pipeline_status: leadSelecionado.pipeline_status,
  criado_em: leadSelecionado.created_at,
  campanha_id: leadSelecionado.campanha_id,
  whatsapp_status: leadSelecionado.whatsapp_status,
  linkedin_url: leadSelecionado.linkedin_url,
  instagram_username: leadSelecionado.instagram_username
}, null, 2)}
                </pre>
              </details>

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

      {/* MODAL DE APROVAÇÃO INDIVIDUAL - Preview antes de enviar */}
      <Dialog open={!!previewIndividual} onOpenChange={() => setPreviewIndividual(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Aprovar Mensagem para Envio
            </DialogTitle>
          </DialogHeader>

          {previewIndividual && (
            <div className="space-y-4">
              {/* Info do Lead */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-lg font-semibold">
                      {(previewIndividual.lead.nome_completo || previewIndividual.lead.razao_social || '?')[0]}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-semibold">
                      {previewIndividual.lead.nome_completo || previewIndividual.lead.razao_social}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {previewIndividual.lead.profissao || previewIndividual.lead.setor} • {previewIndividual.lead.cidade}/{previewIndividual.lead.estado}
                    </p>
                  </div>
                  <Badge className="ml-auto">
                    Score: {previewIndividual.lead.score || 0}
                  </Badge>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  <p>📱 {previewIndividual.lead.whatsapp || previewIndividual.lead.telefone}</p>
                </div>
              </div>

              {/* Estratégia da IA */}
              {previewIndividual.strategy && (
                <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2 text-blue-700 dark:text-blue-300">
                    🤖 Estratégia da IA
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Perfil:</p>
                      <p>{previewIndividual.strategy.perfil_comportamental || 'Profissional'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Tom:</p>
                      <p>{previewIndividual.strategy.tom_mensagem || 'Consultivo'}</p>
                    </div>
                    {previewIndividual.strategy.dores_identificadas?.length > 0 && (
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Dores identificadas:</p>
                        <p>{previewIndividual.strategy.dores_identificadas.join(', ')}</p>
                      </div>
                    )}
                    {previewIndividual.strategy.abordagem_recomendada && (
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Abordagem:</p>
                        <p>{previewIndividual.strategy.abordagem_recomendada}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Mensagem - Editável */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">💬 Mensagem para Enviar</label>
                  <Badge variant="outline">Você pode editar</Badge>
                </div>
                <Textarea
                  value={mensagemEditada}
                  onChange={(e) => setMensagemEditada(e.target.value)}
                  rows={6}
                  className="resize-none"
                  placeholder="Mensagem a ser enviada..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {mensagemEditada.length} caracteres
                </p>
              </div>

              {/* Preview Visual */}
              <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-lg">
                <h4 className="font-semibold mb-2 text-green-700 dark:text-green-300">
                  📱 Preview no WhatsApp
                </h4>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm max-w-sm">
                  <p className="text-sm whitespace-pre-wrap">{mensagemEditada}</p>
                  <p className="text-xs text-muted-foreground mt-2 text-right">
                    {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ✓
                  </p>
                </div>
              </div>

              {/* Ações */}
              <div className="flex gap-2 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setPreviewIndividual(null)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleEnviarMensagemAprovada}
                  disabled={enviandoMensagemAprovada || !mensagemEditada.trim()}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {enviandoMensagemAprovada ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      ✅ Aprovar e Enviar
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
