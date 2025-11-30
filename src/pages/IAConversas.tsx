import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Bot, User, Send, UserCheck, Target, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Conversa {
  id: string;
  phone_number: string;
  contact_name: string | null;
  modo_atendimento: string;
  last_message_at: string | null;
  metadata: any;
  origem: string;
  tipo_contato: string;
  lead_id: string | null;
  vendedor_id?: string | null;
}

interface Mensagem {
  id: string;
  content: string;
  role: string;
  created_at: string;
  metadata?: any;
}

interface Vendedor {
  id: string;
  nome: string;
  especialidade?: string;
}

export default function IAConversas() {
  const navigate = useNavigate();
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [conversaSelecionada, setConversaSelecionada] = useState<Conversa | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('prospeccao');
  const [filtroModo, setFiltroModo] = useState('todas');
  const [filtroVendedor, setFiltroVendedor] = useState('todos');
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);
  const previousMensagensLength = useRef(0);

  // Scroll automático APENAS quando novas mensagens chegam E usuário está no final
  const scrollToBottom = () => {
    if (messagesContainerRef.current && shouldAutoScroll.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  // Verificar se usuário está próximo do final antes de auto-scroll
  const handleMessagesScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      // Se estiver a menos de 100px do final, permite auto-scroll
      shouldAutoScroll.current = scrollHeight - scrollTop - clientHeight < 100;
    }
  };

  useEffect(() => {
    // Só faz scroll se mensagens aumentaram (nova mensagem) e estava no final
    if (mensagens.length > previousMensagensLength.current) {
      scrollToBottom();
    }
    previousMensagensLength.current = mensagens.length;
  }, [mensagens]);

  useEffect(() => {
    carregarConversas();
    loadVendedores();
    const interval = setInterval(carregarConversas, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadVendedores = async () => {
    const { data } = await supabase
      .from('vendedores')
      .select('id, nome, especialidade')
      .eq('ativo', true);
    setVendedores(data || []);
  };

  useEffect(() => {
    if (conversaSelecionada) {
      carregarMensagens(conversaSelecionada.id);
      const interval = setInterval(() => {
        carregarMensagens(conversaSelecionada.id);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [conversaSelecionada]);

  const carregarConversas = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('last_message_at', { ascending: false });

      if (error) {
        console.error('Erro ao carregar conversas:', error);
        return;
      }

      console.log('📊 Conversas carregadas:', data?.length);
      setConversas(data || []);
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const carregarMensagens = async (conversationId: string) => {
    const { data, error } = await supabase
      .from('whatsapp_conversation_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Erro ao carregar mensagens:', error);
      return;
    }

    setMensagens(data || []);
  };

  const assumirConversa = async (conversa: Conversa) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({
        modo_atendimento: 'humano',
        assumido_por: user.id,
        assumido_em: new Date().toISOString()
      })
      .eq('id', conversa.id);

    if (!error) {
      toast.success('✅ Você assumiu esta conversa!');
      carregarConversas();
      setConversaSelecionada({ ...conversa, modo_atendimento: 'humano' });
    } else {
      toast.error('Erro ao assumir conversa');
    }
  };

  const devolverParaIA = async (conversa: Conversa) => {
    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({
        modo_atendimento: 'ia',
        assumido_por: null,
        assumido_em: null
      })
      .eq('id', conversa.id);

    if (!error) {
      toast.success('🤖 IA voltou a atender!');
      carregarConversas();
      setConversaSelecionada({ ...conversa, modo_atendimento: 'ia' });
    } else {
      toast.error('Erro ao devolver para IA');
    }
  };

  const marcarComoCliente = async (conversa: Conversa) => {
    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({ tipo_contato: 'cliente' })
      .eq('id', conversa.id);

    if (!error) {
      toast.success('✅ Marcado como Cliente!');
      carregarConversas();
      setConversaSelecionada({ ...conversa, tipo_contato: 'cliente' });
    }
  };

  const enviarMensagem = async () => {
    if (!novaMensagem.trim() || !conversaSelecionada) return;

    setEnviando(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.functions.invoke('send-wuzapi-message', {
        body: {
          phoneNumber: conversaSelecionada.phone_number,
          message: novaMensagem
        }
      });

      if (error) {
        toast.error('Erro ao enviar: ' + error.message);
        return;
      }

      await supabase.from('whatsapp_conversation_messages').insert({
        conversation_id: conversaSelecionada.id,
        role: 'assistant',
        content: novaMensagem
      });

      await supabase
        .from('whatsapp_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversaSelecionada.id);

      toast.success('✅ Mensagem enviada!');
      setNovaMensagem('');
      carregarMensagens(conversaSelecionada.id);

    } catch (error: any) {
      console.error('Erro:', error);
      toast.error('Erro: ' + error.message);
    } finally {
      setEnviando(false);
    }
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 13) {
      return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
    }
    return phone;
  };

  // SEPARAR conversas: Prospecção vs Clientes (NUNCA misturar!)
  const conversasProspeccao = conversas.filter(c => 
    c.origem === 'prospeccao' || c.lead_id
  );
  
  const conversasClientes = conversas.filter(c => 
    c.origem === 'campanha' && !c.lead_id
  );

  // Filtrar dentro da aba ativa
  const conversasFiltradas = (() => {
    let base = abaAtiva === 'prospeccao' ? conversasProspeccao : 
               abaAtiva === 'clientes' ? conversasClientes : conversas;
    
    if (filtroModo !== 'todas') {
      base = base.filter(c => 
        filtroModo === 'ia' ? (c.modo_atendimento === 'ia' || !c.modo_atendimento) : c.modo_atendimento === 'humano'
      );
    }

    // Filtro por vendedor
    if (filtroVendedor !== 'todos') {
      base = base.filter(c => c.vendedor_id === filtroVendedor);
    }
    
    return base;
  })();

  const countByMode = (modo: string) => conversasFiltradas.filter(c => 
    modo === 'ia' ? (c.modo_atendimento === 'ia' || !c.modo_atendimento) : c.modo_atendimento === 'humano'
  ).length;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* HEADER FIXO NO TOPO */}
      <div className="sticky top-0 z-50 bg-background border-b px-6 py-4 shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">💬 IA Conversas</h1>
        </div>
      </div>

      {/* CONTEÚDO SCROLLÁVEL */}
      <div className="flex-1 overflow-auto p-6">

      {/* ABAS PRINCIPAIS: PROSPECÇÃO vs CLIENTES (SEPARADAS!) */}
      <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="mb-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="prospeccao" className="gap-2">
            <Target className="w-4 h-4" />
            🎯 Prospecção ({conversasProspeccao.length})
          </TabsTrigger>
          <TabsTrigger value="clientes" className="gap-2">
            <Users className="w-4 h-4" />
            🛒 Clientes ({conversasClientes.length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Descrição da aba */}
      <div className={`mb-4 p-3 rounded-lg border ${
        abaAtiva === 'prospeccao' 
          ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800' 
          : 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
      }`}>
        <p className="text-sm">
          {abaAtiva === 'prospeccao' 
            ? '🎯 Leads B2B/B2C de campanhas de prospecção ativa' 
            : '🛒 Clientes da base que responderam campanhas de produtos'
          }
        </p>
      </div>

      {/* FILTROS DE MODO */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <Button
          variant={filtroModo === 'todas' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFiltroModo('todas')}
        >
          Todas ({conversasFiltradas.length})
        </Button>
        <Button
          variant={filtroModo === 'ia' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFiltroModo('ia')}
        >
          <Bot className="w-4 h-4 mr-1" /> IA Ativa ({countByMode('ia')})
        </Button>
        <Button
          variant={filtroModo === 'humano' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFiltroModo('humano')}
        >
          <User className="w-4 h-4 mr-1" /> Você Atendendo ({countByMode('humano')})
        </Button>

        {vendedores.length > 0 && (
          <Select value={filtroVendedor} onValueChange={setFiltroVendedor}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar por vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os vendedores</SelectItem>
              {vendedores.map(v => (
                <SelectItem key={v.id} value={v.id}>
                  👤 {v.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LISTA DE CONVERSAS */}
        <Card className={`lg:col-span-1 ${
          abaAtiva === 'prospeccao' 
            ? 'border-blue-200 dark:border-blue-800' 
            : 'border-green-200 dark:border-green-800'
        }`}>
          <CardHeader className={`${
            abaAtiva === 'prospeccao' 
              ? 'bg-blue-50 dark:bg-blue-950/30' 
              : 'bg-green-50 dark:bg-green-950/30'
          }`}>
            <CardTitle className="flex items-center gap-2">
              {abaAtiva === 'prospeccao' ? <Target className="w-5 h-5" /> : <Users className="w-5 h-5" />}
              {abaAtiva === 'prospeccao' ? '🎯 Prospecção' : '🛒 Clientes'} ({conversasFiltradas.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              {loading ? (
                <p className="p-4 text-sm text-muted-foreground text-center">
                  Carregando...
                </p>
              ) : conversasFiltradas.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    {abaAtiva === 'prospeccao' 
                      ? 'Nenhum prospect ainda' 
                      : 'Nenhum cliente na base'
                    }
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {abaAtiva === 'prospeccao' 
                      ? 'Aborde leads no Funil para iniciar conversas' 
                      : 'Clientes aparecem quando respondem campanhas de produtos'
                    }
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {conversasFiltradas.map(conv => (
                    <div
                      key={conv.id}
                      className={`p-4 cursor-pointer hover:bg-accent border-b transition-colors ${
                        conversaSelecionada?.id === conv.id ? 'bg-accent border-l-4 border-l-primary' : ''
                      } ${conv.lead_id ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}
                      onClick={() => setConversaSelecionada(conv)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-start gap-3 flex-1">
                          <Avatar className="w-10 h-10">
                            <AvatarFallback className={`text-primary-foreground ${
                              conv.lead_id ? 'bg-blue-500' : conv.tipo_contato === 'cliente' ? 'bg-green-500' : 'bg-primary'
                            }`}>
                              {conv.lead_id ? '🎯' : conv.tipo_contato === 'cliente' ? '👤' : '💬'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {conv.contact_name || formatPhone(conv.phone_number)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatPhone(conv.phone_number)}
                            </p>
                            {conv.lead_id && (
                              <Badge variant="outline" className="text-xs mt-1 bg-blue-100 dark:bg-blue-900 border-blue-300">
                                🎯 Prospect
                              </Badge>
                            )}
                            {conv.origem === 'prospeccao' && !conv.lead_id && (
                              <Badge variant="outline" className="text-xs mt-1">
                                Prospecção
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant={conv.modo_atendimento === 'humano' ? 'default' : 'secondary'}>
                            {conv.modo_atendimento === 'humano' ? '👤' : '🤖'}
                          </Badge>
                          {conv.metadata?.score && (
                            <span className={`text-xs font-medium ${
                              conv.metadata.score >= 80 ? 'text-red-500' : conv.metadata.score >= 50 ? 'text-yellow-500' : 'text-blue-500'
                            }`}>
                              {conv.metadata.score >= 80 ? '🔥' : conv.metadata.score >= 50 ? '🟡' : '❄️'} {conv.metadata.score}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-xs text-muted-foreground">
                        {conv.last_message_at 
                          ? new Date(conv.last_message_at).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'Sem mensagens'
                        }
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* CHAT */}
        <Card className="lg:col-span-2">
          {!conversaSelecionada ? (
            <CardContent className="h-[700px] flex items-center justify-center">
              <div className="text-center">
                <p className="text-muted-foreground mb-2">
                  Selecione uma conversa para ver as mensagens
                </p>
                <p className="text-xs text-muted-foreground">
                  👈 Clique em um contato na lista ao lado
                </p>
              </div>
            </CardContent>
          ) : (
            <>
              <CardHeader className="border-b">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                        {conversaSelecionada.tipo_contato === 'cliente' ? '👤' : '🎯'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">
                        {conversaSelecionada.contact_name || formatPhone(conversaSelecionada.phone_number)}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {formatPhone(conversaSelecionada.phone_number)}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {(conversaSelecionada.modo_atendimento === 'ia' || !conversaSelecionada.modo_atendimento) ? (
                      <Button
                        onClick={() => assumirConversa(conversaSelecionada)}
                        className="bg-green-500 hover:bg-green-600"
                        size="sm"
                      >
                        <User className="w-4 h-4 mr-2" /> Assumir Esta Conversa
                      </Button>
                    ) : (
                      <Button
                        onClick={() => devolverParaIA(conversaSelecionada)}
                        variant="outline"
                        size="sm"
                      >
                        <Bot className="w-4 h-4 mr-2" /> Devolver para IA
                      </Button>
                    )}

                    {(conversaSelecionada.tipo_contato === 'lead' || !conversaSelecionada.tipo_contato) && (
                      <Button
                        onClick={() => marcarComoCliente(conversaSelecionada)}
                        variant="outline"
                        size="sm"
                      >
                        <UserCheck className="w-4 h-4 mr-2" /> Marcar como Cliente
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Badge 
                    variant={conversaSelecionada.modo_atendimento === 'humano' ? 'default' : 'secondary'}
                  >
                    {conversaSelecionada.modo_atendimento === 'humano' 
                      ? '👤 Você está atendendo' 
                      : '🤖 IA está atendendo'
                    }
                  </Badge>

                  <Badge variant="outline">
                    {(conversaSelecionada.tipo_contato === 'lead' || !conversaSelecionada.tipo_contato) ? '🎯 Lead' : '👥 Cliente'}
                  </Badge>

                  {conversaSelecionada.origem && (
                    <Badge variant={conversaSelecionada.origem === 'prospeccao' ? 'default' : 'outline'}>
                      {conversaSelecionada.origem === 'prospeccao' ? '🎯 Prospecção Ativa' : `Origem: ${conversaSelecionada.origem}`}
                    </Badge>
                  )}

                  {conversaSelecionada.lead_id && (
                    <Badge variant="default" className="bg-blue-500">
                      🔗 Lead Vinculado
                    </Badge>
                  )}
                </div>

                {/* CARD DE INFO DO LEAD (se tiver lead vinculado) */}
                {conversaSelecionada.lead_id && conversaSelecionada.metadata && (
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900">
                        🎯 Lead de Prospecção
                      </Badge>
                      {conversaSelecionada.metadata?.score && (
                        <Badge variant={conversaSelecionada.metadata.score >= 80 ? 'default' : 'secondary'}>
                          Score: {conversaSelecionada.metadata.score}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {conversaSelecionada.metadata?.profissao && (
                        <p><strong>Profissão:</strong> {conversaSelecionada.metadata.profissao}</p>
                      )}
                      {conversaSelecionada.metadata?.especialidade && (
                        <p><strong>Especialidade:</strong> {conversaSelecionada.metadata.especialidade}</p>
                      )}
                      {conversaSelecionada.metadata?.setor && (
                        <p><strong>Setor:</strong> {conversaSelecionada.metadata.setor}</p>
                      )}
                      {(conversaSelecionada.metadata?.cidade || conversaSelecionada.metadata?.estado) && (
                        <p><strong>Local:</strong> {conversaSelecionada.metadata.cidade}/{conversaSelecionada.metadata.estado}</p>
                      )}
                    </div>

                    <div className="flex gap-2 mt-3">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => navigate(`/leads-funil?campanha=${conversaSelecionada.metadata?.campanha_id || ''}`)}
                      >
                        <Target className="w-3 h-3 mr-1" />
                        Ver no Funil
                      </Button>
                    </div>
                  </div>
                )}
              </CardHeader>

              <CardContent className="p-0 flex flex-col">
                {/* MENSAGENS */}
                <div 
                  ref={messagesContainerRef}
                  onScroll={handleMessagesScroll}
                  className="h-[450px] overflow-y-auto"
                >
                  <div className="p-4">
                    {mensagens.length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground py-8">
                        Nenhuma mensagem ainda
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {mensagens.map(msg => {
                          const isFromBusiness = msg.role === 'assistant';
                          const isAutoSent = msg.metadata?.auto_sent === true;
                          
                          return (
                            <div
                              key={msg.id}
                              className={`flex ${isFromBusiness ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[70%] rounded-2xl p-3 ${
                                  isFromBusiness
                                    ? 'bg-primary text-primary-foreground rounded-br-md'
                                    : 'bg-muted rounded-bl-md'
                                }`}
                              >
                                <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                                
                                <div className={`flex items-center gap-2 mt-1 ${
                                  isFromBusiness ? 'justify-end' : 'justify-start'
                                }`}>
                                  <span className={`text-xs ${
                                    isFromBusiness ? 'opacity-70' : 'text-muted-foreground'
                                  }`}>
                                    {new Date(msg.created_at).toLocaleTimeString('pt-BR', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                  
                                  {isAutoSent && (
                                    <Badge 
                                      variant="outline" 
                                      className={`text-[10px] px-1 py-0 h-4 ${
                                        isFromBusiness ? 'border-primary-foreground/30 text-primary-foreground/70' : ''
                                      }`}
                                    >
                                      🤖 Auto
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {/* Scroll anchor */}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </div>
                </div>

                {/* INPUT DE MENSAGEM */}
                {conversaSelecionada.modo_atendimento === 'humano' ? (
                  <div className="border-t p-4">
                    <div className="flex gap-2">
                      <Input
                        value={novaMensagem}
                        onChange={(e) => setNovaMensagem(e.target.value)}
                        placeholder="Digite sua mensagem..."
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            enviarMensagem();
                          }
                        }}
                        disabled={enviando}
                      />
                      <Button
                        onClick={enviarMensagem}
                        disabled={enviando || !novaMensagem.trim()}
                      >
                        {enviando ? '⏳' : <Send className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Enter para enviar • Você está respondendo manualmente
                    </p>
                  </div>
                ) : (
                  <div className="border-t p-4 bg-muted/50">
                    <p className="text-sm text-center">
                      🤖 IA está respondendo automaticamente.{' '}
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 h-auto"
                        onClick={() => assumirConversa(conversaSelecionada)}
                      >
                        Clique aqui para assumir
                      </Button>
                    </p>
                  </div>
                )}
              </CardContent>
            </>
          )}
        </Card>
      </div>
      </div>
    </div>
  );
}