import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { 
  MessageSquare, 
  Send, 
  Bot, 
  User, 
  LogOut, 
  Phone,
  Clock,
  CheckCircle2,
  Circle,
  Volume2,
  VolumeX
} from 'lucide-react';

interface VendedorSession {
  id: string;
  nome: string;
  email: string;
  especialidade: string;
}

interface Conversa {
  id: string;
  phone_number: string;
  contact_name: string | null;
  modo_atendimento: string;
  last_message_at: string | null;
  metadata: Record<string, unknown>;
  origem: string | null;
  tipo_contato: string | null;
  ultima_mensagem_role?: string;
  ultima_mensagem_cliente_at?: string | null; // Última msg do CLIENTE (user)
}

interface Mensagem {
  id: string;
  content: string;
  role: string;
  created_at: string;
}

export default function VendedorPainel() {
  const navigate = useNavigate();
  const [vendedor, setVendedor] = useState<VendedorSession | null>(null);
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [conversaSelecionada, setConversaSelecionada] = useState<Conversa | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [inputMensagem, setInputMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [stats, setStats] = useState({ total: 0, ia: 0, humano: 0, ativos: 0 });
  const [filtro, setFiltro] = useState<'todos' | 'ativos' | 'inativos'>('todos');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const clientesAtivosAnterioresRef = useRef<string[]>([]);
  
  // Hook de notificação sonora
  const { enabled: somEnabled, toggleSound, playSound, testSound } = useNotificationSound();

  // Verificar se cliente está ativo (enviou mensagem nos últimos 30 min)
  const isClienteAtivo = (conversa: Conversa): boolean => {
    // Usar ultima_mensagem_cliente_at (última msg do CLIENTE especificamente)
    const dataCliente = conversa.ultima_mensagem_cliente_at;
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 Verificando cliente:', conversa.contact_name || conversa.phone_number);
    console.log('📅 ultima_mensagem_cliente_at:', dataCliente);
    
    if (!dataCliente) {
      console.log('❌ Sem data de última mensagem do cliente');
      return false;
    }
    
    const agora = new Date();
    const dataUltimaMensagemCliente = new Date(dataCliente);
    const diferencaMinutos = (agora.getTime() - dataUltimaMensagemCliente.getTime()) / (1000 * 60);
    
    console.log('⏰ Agora:', agora.toISOString());
    console.log('📨 Última msg cliente:', dataUltimaMensagemCliente.toISOString());
    console.log('⏱️ Diferença:', Math.round(diferencaMinutos), 'minutos');
    
    // 🟢 ATIVO se CLIENTE enviou mensagem nos últimos 30 minutos
    const ativo = diferencaMinutos <= 30;
    
    console.log(ativo ? '🟢 ATIVO!' : '⚪ Inativo');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    return ativo;
  };

  useEffect(() => {
    const session = localStorage.getItem('vendedor_session');
    if (!session) {
      navigate('/vendedor-login');
      return;
    }
    
    const vendedorData = JSON.parse(session);
    setVendedor(vendedorData);
    carregarConversas(vendedorData.id);

    const interval = setInterval(() => {
      carregarConversas(vendedorData.id);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (conversaSelecionada) {
      carregarMensagens(conversaSelecionada.id);
      const interval = setInterval(() => {
        carregarMensagens(conversaSelecionada.id);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [conversaSelecionada]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  // 💰 DETECTAR NOVOS CLIENTES ATIVOS E TOCAR SOM DE CAIXA REGISTRADORA
  useEffect(() => {
    if (!conversas.length) return;

    // Identificar clientes ativos AGORA
    const clientesAtivosAgora = conversas
      .filter(isClienteAtivo)
      .map(c => c.id);

    // Identificar NOVOS clientes ativos (que não estavam antes)
    const novosAtivos = clientesAtivosAgora.filter(
      id => !clientesAtivosAnterioresRef.current.includes(id)
    );

    console.log('🔔 Clientes ativos anteriores:', clientesAtivosAnterioresRef.current.length);
    console.log('🔔 Clientes ativos agora:', clientesAtivosAgora.length);
    console.log('🆕 Novos clientes ativos:', novosAtivos.length);

    if (novosAtivos.length > 0) {
      console.log('💰 TOCANDO SOM DE CAIXA REGISTRADORA!');
      
      // 🎵 TOCAR SOM DE CAIXA REGISTRADORA
      playSound('caixa');
      
      // Buscar nomes dos clientes novos ativos
      const nomesClientes = conversas
        .filter(c => novosAtivos.includes(c.id))
        .map(c => c.contact_name || c.phone_number)
        .join(', ');

      // Toast visual
      toast.success(`💰 Cliente interagindo!`, {
        description: nomesClientes,
        duration: 5000,
      });
    }

    // Atualizar referência de ativos anteriores
    clientesAtivosAnterioresRef.current = clientesAtivosAgora;
  }, [conversas, playSound]);

  const carregarConversas = async (vendedorId: string) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 BUSCANDO CONVERSAS DO VENDEDOR');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 Vendedor logado ID:', vendedorId);
    
    const { data, error } = await supabase
      .from('whatsapp_conversations')
      .select('id, phone_number, contact_name, modo_atendimento, last_message_at, metadata, origem, tipo_contato, vendedor_id')
      .eq('vendedor_id', vendedorId)
      .order('last_message_at', { ascending: false });

    console.log('📊 Total conversas encontradas:', data?.length || 0);

    if (!error && data) {
      // Buscar última mensagem DO CLIENTE (role='user') de cada conversa
      const conversasComRole = await Promise.all(
        data.map(async (conv) => {
          // Buscar última mensagem geral
          const { data: ultimaMensagemGeral } = await supabase
            .from('whatsapp_conversation_messages')
            .select('role')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          // Buscar última mensagem do CLIENTE especificamente (role='user')
          const { data: ultimaMensagemCliente } = await supabase
            .from('whatsapp_conversation_messages')
            .select('created_at')
            .eq('conversation_id', conv.id)
            .eq('role', 'user')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          return {
            ...conv,
            ultima_mensagem_role: ultimaMensagemGeral?.role || null,
            ultima_mensagem_cliente_at: ultimaMensagemCliente?.created_at || null
          } as Conversa;
        })
      );

      if (conversasComRole.length > 0) {
        console.log('📋 Conversas:', conversasComRole.map(c => ({
          id: c.id,
          phone: c.phone_number,
          vendedor: (c as { vendedor_id?: string }).vendedor_id,
          origem: c.origem,
          ativo: isClienteAtivo(c)
        })));
      } else {
        console.log('⚠️ NENHUMA conversa encontrada para este vendedor');
        
        const { data: todasConversas } = await supabase
          .from('whatsapp_conversations')
          .select('id, phone_number, vendedor_id, origem')
          .order('created_at', { ascending: false })
          .limit(10);
        
        console.log('🔍 Últimas 10 conversas no banco (debug):', todasConversas);
      }
      
      setConversas(conversasComRole);
      
      const ativos = conversasComRole.filter(c => isClienteAtivo(c)).length;
      setStats({
        total: conversasComRole.length,
        ia: conversasComRole.filter(c => c.modo_atendimento === 'ia').length,
        humano: conversasComRole.filter(c => c.modo_atendimento === 'humano').length,
        ativos
      });
    }
    
    if (error) {
      console.error('❌ Erro ao buscar conversas:', error);
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  const carregarMensagens = async (conversationId: string) => {
    const { data, error } = await supabase
      .from('whatsapp_conversation_messages')
      .select('id, content, role, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMensagens(data as Mensagem[]);
      
      // Atualizar role da última mensagem na conversa selecionada
      if (data.length > 0) {
        const ultimaMsg = data[data.length - 1];
        setConversas(prev => prev.map(c => 
          c.id === conversationId 
            ? { ...c, ultima_mensagem_role: ultimaMsg.role }
            : c
        ));
      }
    }
  };

  const assumirConversa = async (conversa: Conversa) => {
    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({ 
        modo_atendimento: 'humano',
        updated_at: new Date().toISOString()
      })
      .eq('id', conversa.id);

    if (error) {
      toast.error('Erro ao assumir conversa');
      return;
    }

    // ✅ ATUALIZAR ESTADO LOCAL IMEDIATAMENTE para mostrar campo de resposta
    const conversaAtualizada = { ...conversa, modo_atendimento: 'humano' };
    setConversaSelecionada(conversaAtualizada);
    setConversas(prev => prev.map(c => c.id === conversa.id ? conversaAtualizada : c));
    
    toast.success('✅ Conversa assumida! Você pode responder agora.');
    if (vendedor) carregarConversas(vendedor.id);
  };

  const devolverParaIA = async (conversa: Conversa) => {
    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({ 
        modo_atendimento: 'ia',
        updated_at: new Date().toISOString()
      })
      .eq('id', conversa.id);

    if (error) {
      toast.error('Erro ao devolver conversa');
      return;
    }

    // ✅ ATUALIZAR ESTADO LOCAL IMEDIATAMENTE
    const conversaAtualizada = { ...conversa, modo_atendimento: 'ia' };
    setConversaSelecionada(conversaAtualizada);
    setConversas(prev => prev.map(c => c.id === conversa.id ? conversaAtualizada : c));

    toast.success('🤖 Conversa devolvida para a IA');
    if (vendedor) carregarConversas(vendedor.id);
  };

  const enviarMensagem = async () => {
    if (!inputMensagem.trim()) {
      toast.error('Digite uma mensagem');
      return;
    }
    if (!conversaSelecionada) {
      toast.error('Selecione uma conversa');
      return;
    }
    if (!vendedor) {
      toast.error('Vendedor não identificado');
      return;
    }
    if (conversaSelecionada.modo_atendimento !== 'humano') {
      toast.error('Assuma a conversa primeiro para responder!');
      return;
    }

    setEnviando(true);
    console.log('📤 Enviando mensagem para:', conversaSelecionada.phone_number);
    
    try {
      // 1. Enviar via edge function (CORRIGIDO: usar phoneNumber não phone)
      console.log('📤 Chamando send-wuzapi-message...');
      console.log('Phone:', conversaSelecionada.phone_number);
      console.log('Message:', inputMensagem);
      
      const { data, error: sendError } = await supabase.functions.invoke('send-wuzapi-message', {
        body: {
          phoneNumber: conversaSelecionada.phone_number, // ✅ CORRIGIDO: era "phone", agora é "phoneNumber"
          message: inputMensagem
        }
      });

      console.log('📨 Resposta do envio:', data);
      console.log('📨 Erro (se houver):', sendError);
      
      if (sendError) {
        console.error('❌ Erro no envio:', sendError);
        throw new Error(sendError.message || 'Erro ao enviar mensagem');
      }

      // 2. Salvar mensagem no banco
      const { error: insertError } = await supabase.from('whatsapp_conversation_messages').insert({
        conversation_id: conversaSelecionada.id,
        content: inputMensagem,
        role: 'assistant',
        metadata: { sent_by_vendedor: vendedor.nome, vendedor_id: vendedor.id }
      });

      if (insertError) {
        console.error('❌ Erro ao salvar mensagem:', insertError);
      }

      // 3. Atualizar última mensagem da conversa
      await supabase
        .from('whatsapp_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversaSelecionada.id);

      // 4. Limpar e recarregar
      setInputMensagem('');
      await carregarMensagens(conversaSelecionada.id);
      toast.success('✅ Mensagem enviada!');
      
    } catch (err: unknown) {
      console.error('❌ Erro completo ao enviar:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(`Erro ao enviar: ${errorMessage}`);
    } finally {
      setEnviando(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('vendedor_session');
    navigate('/vendedor-login');
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    return phone;
  };

  // Filtrar e ordenar conversas (ativos primeiro)
  const conversasFiltradas = conversas
    .filter(conv => {
      if (filtro === 'ativos') return isClienteAtivo(conv);
      if (filtro === 'inativos') return !isClienteAtivo(conv);
      return true;
    })
    .sort((a, b) => {
      const ativoA = isClienteAtivo(a);
      const ativoB = isClienteAtivo(b);
      
      // Ativos primeiro
      if (ativoA && !ativoB) return -1;
      if (!ativoA && ativoB) return 1;
      
      // Depois ordena por última mensagem
      const dataA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const dataB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return dataB - dataA;
    });

  if (!vendedor) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
              {vendedor.nome.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="font-bold text-lg">{vendedor.nome}</h1>
              <p className="text-sm text-muted-foreground">{vendedor.especialidade || 'Vendedor'}</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex gap-4 text-sm">
              <div className="text-center">
                <p className="font-bold text-xl">{stats.total}</p>
                <p className="text-muted-foreground">Conversas</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-xl text-green-500">{stats.ativos}</p>
                <p className="text-muted-foreground">🟢 Ativos</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-xl text-blue-500">{stats.humano}</p>
                <p className="text-muted-foreground">Assumidas</p>
              </div>
            </div>

            {/* Controle de Som */}
            <div className="flex items-center gap-2">
              <Button
                variant={somEnabled ? 'default' : 'outline'}
                size="sm"
                onClick={toggleSound}
                title={somEnabled ? 'Sons ativados' : 'Sons desativados'}
              >
                {somEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={testSound}
                title="Testar som"
              >
                🔔
              </Button>
            </div>

            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        <div className="w-80 border-r bg-card">
          <div className="p-4 border-b">
            <h2 className="font-semibold flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4" />
              Minhas Conversas
              {stats.ativos > 0 && (
                <Badge className="bg-green-500 text-white animate-pulse ml-auto">
                  🟢 {stats.ativos}
                </Badge>
              )}
            </h2>
            
            {/* Filtros */}
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={filtro === 'todos' ? 'default' : 'outline'}
                onClick={() => setFiltro('todos')}
                className="flex-1 text-xs"
              >
                📋 Todos ({conversas.length})
              </Button>
              <Button
                size="sm"
                variant={filtro === 'ativos' ? 'default' : 'outline'}
                onClick={() => setFiltro('ativos')}
                className={cn("flex-1 text-xs", filtro === 'ativos' && "bg-green-500 hover:bg-green-600")}
              >
                🟢 Ativos ({stats.ativos})
              </Button>
              <Button
                size="sm"
                variant={filtro === 'inativos' ? 'default' : 'outline'}
                onClick={() => setFiltro('inativos')}
                className="flex-1 text-xs"
              >
                ⚪ Outros
              </Button>
            </div>
          </div>

          <ScrollArea className="h-[calc(100vh-180px)]">
            {conversasFiltradas.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma conversa {filtro === 'ativos' ? 'ativa' : filtro === 'inativos' ? 'inativa' : 'atribuída'}</p>
              </div>
            ) : (
              conversasFiltradas.map(conversa => {
                const ativo = isClienteAtivo(conversa);
                
                return (
                  <div
                    key={conversa.id}
                    onClick={() => setConversaSelecionada(conversa)}
                    className={cn(
                      "p-4 border-b cursor-pointer transition-all",
                      "hover:shadow-md",
                      // VERDE se cliente ativo
                      ativo && "bg-green-50 dark:bg-green-950/30 border-l-4 border-l-green-500",
                      // Normal se não ativo
                      !ativo && "hover:bg-accent",
                      // Destacar se selecionada
                      conversaSelecionada?.id === conversa.id && "ring-2 ring-primary bg-accent"
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {/* Avatar com indicador de ativo */}
                        <div className="relative">
                          <Avatar className={cn(
                            "w-8 h-8",
                            ativo && "ring-2 ring-green-500"
                          )}>
                            <AvatarFallback className={cn(
                              "text-xs",
                              ativo ? "bg-green-100 text-green-700" : "bg-primary/10 text-primary"
                            )}>
                              {(conversa.contact_name || conversa.phone_number).charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          
                          {/* Bolinha verde pulsante */}
                          {ativo && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-card animate-pulse" />
                          )}
                        </div>
                        
                        <div>
                          <p className={cn(
                            "font-medium text-sm",
                            ativo && "text-green-700 dark:text-green-400"
                          )}>
                            {conversa.contact_name || formatPhone(conversa.phone_number)}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {formatPhone(conversa.phone_number)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-1">
                        {/* Badge de ativo */}
                        {ativo && (
                          <Badge className="bg-green-500 text-white text-xs">
                            🟢 Ativo
                          </Badge>
                        )}
                        
                        {/* Badge de modo */}
                        <Badge 
                          variant={conversa.modo_atendimento === 'ia' ? 'secondary' : 'default'}
                          className="text-xs"
                        >
                          {conversa.modo_atendimento === 'ia' ? (
                            <><Bot className="w-3 h-3 mr-1" /> IA</>
                          ) : (
                            <><User className="w-3 h-3 mr-1" /> Você</>
                          )}
                        </Badge>
                      </div>
                    </div>
                    
                    {conversa.last_message_at && (
                      <p className={cn(
                        "text-xs flex items-center gap-1",
                        ativo ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                      )}>
                        <Clock className="w-3 h-3" />
                        {new Date(conversa.last_message_at).toLocaleString('pt-BR')}
                        {ativo && " • Aguardando resposta"}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </ScrollArea>
        </div>

        <div className="flex-1 flex flex-col">
          {conversaSelecionada ? (
            <>
              <div className={cn(
                "p-4 border-b flex items-center justify-between",
                isClienteAtivo(conversaSelecionada) ? "bg-green-50 dark:bg-green-950/30" : "bg-card"
              )}>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className={cn(
                      isClienteAtivo(conversaSelecionada) && "ring-2 ring-green-500"
                    )}>
                      <AvatarFallback className={cn(
                        isClienteAtivo(conversaSelecionada) ? "bg-green-100 text-green-700" : "bg-primary/10 text-primary"
                      )}>
                        {(conversaSelecionada.contact_name || conversaSelecionada.phone_number).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {isClienteAtivo(conversaSelecionada) && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-card animate-pulse" />
                    )}
                  </div>
                  <div>
                    <p className={cn(
                      "font-semibold",
                      isClienteAtivo(conversaSelecionada) && "text-green-700 dark:text-green-400"
                    )}>
                      {conversaSelecionada.contact_name || formatPhone(conversaSelecionada.phone_number)}
                      {isClienteAtivo(conversaSelecionada) && (
                        <Badge className="bg-green-500 text-white text-xs ml-2">
                          🟢 Cliente Ativo
                        </Badge>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatPhone(conversaSelecionada.phone_number)}
                    </p>
                  </div>
                </div>

                {/* BOTÕES BEM VISÍVEIS */}
                <div className="flex gap-3">
                  {conversaSelecionada.modo_atendimento === 'ia' ? (
                    <Button 
                      size="lg" 
                      onClick={() => assumirConversa(conversaSelecionada)}
                      className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6"
                    >
                      <User className="w-5 h-5 mr-2" />
                      👤 Assumir Conversa
                    </Button>
                  ) : (
                    <Button 
                      size="lg" 
                      variant="outline" 
                      onClick={() => devolverParaIA(conversaSelecionada)}
                      className="border-blue-500 text-blue-600 hover:bg-blue-50 font-semibold px-6"
                    >
                      <Bot className="w-5 h-5 mr-2" />
                      🤖 Devolver para IA
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Badge de status atual */}
              <div className="px-4 py-2 border-b bg-muted/30">
                {conversaSelecionada.modo_atendimento === 'humano' ? (
                  <Badge className="bg-green-600 text-white">
                    ✅ Você está atendendo - Campo de resposta abaixo
                  </Badge>
                ) : (
                  <Badge className="bg-blue-600 text-white">
                    🤖 IA está respondendo - Clique "Assumir" para responder manualmente
                  </Badge>
                )}
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {mensagens.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === 'assistant' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                          msg.role === 'assistant'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <p className={`text-xs mt-1 ${
                          msg.role === 'assistant' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        }`}>
                          {new Date(msg.created_at).toLocaleTimeString('pt-BR', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {conversaSelecionada.modo_atendimento === 'humano' && (
                <div className="p-4 border-t bg-card">
                  <div className="flex gap-2">
                    <Input
                      value={inputMensagem}
                      onChange={(e) => setInputMensagem(e.target.value)}
                      placeholder="Digite sua mensagem..."
                      onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && enviarMensagem()}
                      disabled={enviando}
                    />
                    <Button onClick={enviarMensagem} disabled={enviando || !inputMensagem.trim()}>
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    Você assumiu esta conversa. A IA não responderá automaticamente.
                  </p>
                </div>
              )}

              {conversaSelecionada.modo_atendimento === 'ia' && (
                <div className="p-4 border-t bg-muted/50 text-center">
                  <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                    <Bot className="w-4 h-4" />
                    A IA está respondendo automaticamente. Clique em &quot;Assumir Conversa&quot; para responder manualmente.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Selecione uma conversa</p>
                <p className="text-sm">Clique em uma conversa à esquerda para visualizar</p>
                {stats.ativos > 0 && (
                  <Badge className="bg-green-500 text-white mt-4 animate-pulse">
                    🟢 {stats.ativos} cliente{stats.ativos > 1 ? 's' : ''} ativo{stats.ativos > 1 ? 's' : ''} aguardando!
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
