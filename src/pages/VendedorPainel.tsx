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
import { 
  MessageSquare, 
  Send, 
  Bot, 
  User, 
  LogOut, 
  Phone,
  Clock,
  CheckCircle2,
  Circle
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

  // Verificar se cliente está ativo (última mensagem dele nos últimos 30 min)
  const isClienteAtivo = (conversa: Conversa): boolean => {
    if (!conversa.last_message_at) return false;
    
    // Se última mensagem foi do vendedor/assistant, não está ativo
    if (conversa.ultima_mensagem_role === 'assistant') return false;
    
    const agora = new Date();
    const dataUltimaMensagem = new Date(conversa.last_message_at);
    const diferencaMinutos = (agora.getTime() - dataUltimaMensagem.getTime()) / (1000 * 60);
    
    // Ativo se mensagem veio nos últimos 30 minutos
    return diferencaMinutos <= 30;
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
      // Buscar última mensagem de cada conversa para saber se é do cliente
      const conversasComRole = await Promise.all(
        data.map(async (conv) => {
          const { data: ultimaMensagem } = await supabase
            .from('whatsapp_conversation_messages')
            .select('role')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          return {
            ...conv,
            ultima_mensagem_role: ultimaMensagem?.role || null
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
    await supabase
      .from('whatsapp_conversations')
      .update({ 
        modo_atendimento: 'humano',
        updated_at: new Date().toISOString()
      })
      .eq('id', conversa.id);

    toast.success('Conversa assumida! A IA não responderá mais.');
    if (vendedor) carregarConversas(vendedor.id);
  };

  const devolverParaIA = async (conversa: Conversa) => {
    await supabase
      .from('whatsapp_conversations')
      .update({ 
        modo_atendimento: 'ia',
        updated_at: new Date().toISOString()
      })
      .eq('id', conversa.id);

    toast.success('Conversa devolvida para a IA');
    if (vendedor) carregarConversas(vendedor.id);
  };

  const enviarMensagem = async () => {
    if (!inputMensagem.trim() || !conversaSelecionada || !vendedor) return;

    setEnviando(true);
    try {
      const { error: sendError } = await supabase.functions.invoke('send-wuzapi-message', {
        body: {
          phone: conversaSelecionada.phone_number,
          message: inputMensagem,
          userId: vendedor.id
        }
      });

      if (sendError) throw sendError;

      await supabase.from('whatsapp_conversation_messages').insert({
        conversation_id: conversaSelecionada.id,
        content: inputMensagem,
        role: 'assistant',
        metadata: { sent_by_vendedor: vendedor.nome }
      });

      await supabase
        .from('whatsapp_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversaSelecionada.id);

      setInputMensagem('');
      carregarMensagens(conversaSelecionada.id);
      toast.success('Mensagem enviada!');
    } catch (err) {
      console.error('Erro ao enviar:', err);
      toast.error('Erro ao enviar mensagem');
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

                <div className="flex gap-2">
                  {conversaSelecionada.modo_atendimento === 'ia' ? (
                    <Button size="sm" onClick={() => assumirConversa(conversaSelecionada)}>
                      <User className="w-4 h-4 mr-2" />
                      Assumir Conversa
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => devolverParaIA(conversaSelecionada)}>
                      <Bot className="w-4 h-4 mr-2" />
                      Devolver para IA
                    </Button>
                  )}
                </div>
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
